package com.learnup.identity.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.*;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenService jwtTokenService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw BusinessException.conflict("Username is already in use");
        }

        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw BusinessException.conflict("Email address is already registered");
        }

        // Privilege Escalation Prevention
        UserRole targetRole = request.getRole() != null ? request.getRole() : UserRole.LEARNER;
        if (targetRole == UserRole.ADMIN) {
            log.warn("Attempt to self-register as platform ADMIN rejected for user '{}'", request.getUsername());
            throw BusinessException.forbidden("Cannot self-register as platform ADMIN");
        }

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(request.getUsername().trim());
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName() != null ? request.getFullName().trim() : null);
        user.setRole(targetRole);
        user.setOrganizationId(request.getOrganizationId());
        user.setEnabled(true);

        User savedUser = userRepository.save(user);
        log.info("Registered new user [{}] with role [{}] and id [{}]",
                savedUser.getUsername(), savedUser.getRole(), savedUser.getId());

        String accessToken = jwtTokenService.generateAccessToken(savedUser);
        String rawRefreshToken = createAndPersistRefreshToken(savedUser.getId());
        UserResponse userResponse = UserResponse.fromUser(savedUser);

        return AuthResponse.of(accessToken, rawRefreshToken, jwtTokenService.getAccessTokenExpirationSeconds(), userResponse);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String identifier = request.getUsername().trim();

        User user = userRepository.findByUsernameOrEmail(identifier, identifier.toLowerCase())
                .orElseThrow(() -> BusinessException.unauthorized("Invalid username or password"));

        if (!user.isEnabled()) {
            log.warn("Login attempt for disabled account: '{}'", identifier);
            throw BusinessException.unauthorized("User account is disabled");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Invalid password attempt for account: '{}'", identifier);
            throw BusinessException.unauthorized("Invalid username or password");
        }

        log.info("User [{}] successfully authenticated", user.getUsername());

        String accessToken = jwtTokenService.generateAccessToken(user);
        String rawRefreshToken = createAndPersistRefreshToken(user.getId());
        UserResponse userResponse = UserResponse.fromUser(user);

        return AuthResponse.of(accessToken, rawRefreshToken, jwtTokenService.getAccessTokenExpirationSeconds(), userResponse);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String rawToken = request.getRefreshToken().trim();
        String tokenHash = hashToken(rawToken);

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> BusinessException.unauthorized("Invalid, expired, or revoked refresh token"));

        if (!refreshToken.isValid()) {
            log.warn("Invalid or revoked refresh token used for user ID [{}]", refreshToken.getUserId());
            throw BusinessException.unauthorized("Invalid, expired, or revoked refresh token");
        }

        User user = userRepository.findById(refreshToken.getUserId())
                .orElseThrow(() -> BusinessException.unauthorized("User account not found"));

        if (!user.isEnabled()) {
            throw BusinessException.unauthorized("User account is disabled");
        }

        // Revoke the old refresh token (Token Rotation)
        refreshToken.revoke();
        refreshTokenRepository.save(refreshToken);

        // Generate new token pair
        String newAccessToken = jwtTokenService.generateAccessToken(user);
        String newRawRefreshToken = createAndPersistRefreshToken(user.getId());
        UserResponse userResponse = UserResponse.fromUser(user);

        return AuthResponse.of(newAccessToken, newRawRefreshToken, jwtTokenService.getAccessTokenExpirationSeconds(), userResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        if (userId == null) {
            throw BusinessException.unauthorized("Authentication required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User with ID " + userId + " not found"));

        return UserResponse.fromUser(user);
    }

    private String createAndPersistRefreshToken(UUID userId) {
        String rawToken = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        String tokenHash = hashToken(rawToken);

        Instant expiresAt = Instant.now().plus(jwtTokenService.getRefreshTokenExpirationDays(), ChronoUnit.DAYS);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setId(UUID.randomUUID());
        refreshToken.setUserId(userId);
        refreshToken.setTokenHash(tokenHash);
        refreshToken.setExpiresAt(expiresAt);

        refreshTokenRepository.save(refreshToken);
        return rawToken;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
