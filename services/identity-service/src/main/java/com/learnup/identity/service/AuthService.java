package com.learnup.identity.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.*;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.RefreshTokenReusedException;
import com.learnup.identity.exception.SignInDeniedException;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import com.learnup.identity.mapper.UserMapper;
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
    private final TenantAccessClient tenantAccessClient;
    private final LoginThrottleService loginThrottleService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final com.learnup.identity.repository.PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final UserMapper userMapper;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       com.learnup.identity.repository.PasswordResetTokenRepository passwordResetTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenService jwtTokenService,
                       TenantAccessClient tenantAccessClient,
                       LoginThrottleService loginThrottleService,
                       UserMapper userMapper) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.tenantAccessClient = tenantAccessClient;
        this.loginThrottleService = loginThrottleService;
        this.userMapper = userMapper;
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String identifier = request.getUsername().trim();
        loginThrottleService.assertNotLocked(identifier);

        User user = userRepository.findByUsernameOrEmail(identifier, identifier.toLowerCase()).orElse(null);
        if (user == null) {
            loginThrottleService.recordFailure(identifier);
            throw BusinessException.unauthorized("Invalid username or password");
        }

        if (!user.isEnabled()) {
            log.warn("Login attempt for disabled account: '{}'", identifier);
            throw BusinessException.unauthorized("User account is disabled");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Invalid password attempt for account: '{}'", identifier);
            loginThrottleService.recordFailure(identifier);
            throw BusinessException.unauthorized("Invalid username or password");
        }
        loginThrottleService.reset(identifier);

        SignInAccess access = tenantAccessClient.check(user.getId());
        if (!access.allowed()) {
            log.warn("Sign-in denied for user [{}]: {}", user.getId(), access.reason());
            if ("ACCOUNT_NOT_FOUND".equals(access.reason())) {
                throw BusinessException.unauthorized("Invalid username or password");
            }
            throw new SignInDeniedException(access.reason());
        }

        log.info("User [{}] successfully authenticated", user.getUsername());

        String accessToken = jwtTokenService.generateAccessToken(user);
        String rawRefreshToken = createAndPersistRefreshToken(user.getId());
        UserResponse userResponse = userMapper.toResponse(user);

        AuthResponse response = AuthResponse.of(accessToken, rawRefreshToken, jwtTokenService.getAccessTokenExpirationSeconds(), userResponse);
        response.setAccessMode(access.accessMode());
        return response;
    }

    @Transactional(noRollbackFor = {SignInDeniedException.class, RefreshTokenReusedException.class})
    public AuthResponse refresh(RefreshTokenRequest request) {
        String rawToken = request.getRefreshToken().trim();
        String tokenHash = hashToken(rawToken);

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
                .orElseThrow(() -> BusinessException.unauthorized("Invalid, expired, or revoked refresh token"));

        if (refreshToken.wasRotated()) {
            int revoked = refreshTokenRepository.revokeFamily(refreshToken.getFamilyId(), Instant.now());
            log.warn("Refresh token reuse detected for user [{}]; revoked {} token(s) of family [{}]",
                    refreshToken.getUserId(), revoked, refreshToken.getFamilyId());
            throw new RefreshTokenReusedException();
        }

        if (!refreshToken.isValid()) {
            log.warn("Invalid or revoked refresh token used for user ID [{}]", refreshToken.getUserId());
            throw BusinessException.unauthorized("Invalid, expired, or revoked refresh token");
        }

        User user = userRepository.findById(refreshToken.getUserId())
                .orElseThrow(() -> BusinessException.unauthorized("User account not found"));

        if (!user.isEnabled()) {
            throw BusinessException.unauthorized("User account is disabled");
        }

        SignInAccess access = tenantAccessClient.check(user.getId());
        if (!access.allowed()) {
            refreshTokenRepository.deleteByUserId(user.getId());
            log.warn("Refresh denied and sessions revoked for user [{}]: {}", user.getId(), access.reason());
            throw new SignInDeniedException(access.reason());
        }

        // Revoke the old refresh token (Token Rotation)
        IssuedRefreshToken next = issueRefreshToken(user.getId(), refreshToken.getFamilyId());
        refreshToken.revoke();
        refreshToken.setReplacedBy(next.id());
        refreshTokenRepository.save(refreshToken);

        // Generate new token pair
        String newAccessToken = jwtTokenService.generateAccessToken(user);
        String newRawRefreshToken = next.rawToken();
        UserResponse userResponse = userMapper.toResponse(user);

        AuthResponse response = AuthResponse.of(newAccessToken, newRawRefreshToken, jwtTokenService.getAccessTokenExpirationSeconds(), userResponse);
        response.setAccessMode(access.accessMode());
        return response;
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        if (userId == null) {
            throw BusinessException.unauthorized("Authentication required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User with ID " + userId + " not found"));

        return userMapper.toResponse(user);
    }

    @Transactional
    public void logout(LogoutRequest request, UUID authenticatedUserId) {
        if (request != null && Boolean.TRUE.equals(request.getLogoutAll())) {
            if (authenticatedUserId != null) {
                refreshTokenRepository.deleteByUserId(authenticatedUserId);
                log.info("All active refresh tokens revoked for user [{}]", authenticatedUserId);
                return;
            }
        }

        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            String tokenHash = hashToken(request.getRefreshToken().trim());
            refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(token -> {
                token.revoke();
                refreshTokenRepository.save(token);
                log.info("Refresh token revoked for user [{}]", token.getUserId());
            });
            return;
        }

        if (authenticatedUserId != null) {
            refreshTokenRepository.deleteByUserId(authenticatedUserId);
            log.info("Refresh tokens deleted for user [{}]", authenticatedUserId);
        }
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        if (userId == null) {
            throw BusinessException.unauthorized("Authentication required to change password");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw BusinessException.badRequest("New password and confirmation password do not match");
        }

        if (request.getNewPassword().equals(request.getCurrentPassword())) {
            throw BusinessException.badRequest("New password cannot be the same as the current password");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            log.warn("Password change failed for user [{}]: invalid current password", userId);
            throw BusinessException.badRequest("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword().trim()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        // Security best practice: Revoke all existing sessions upon password change
        refreshTokenRepository.deleteByUserId(userId);
        log.info("Password successfully changed and all sessions revoked for user [{}]", userId);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !user.isEnabled()) {
            // Mitigate email enumeration attack: return quietly without disclosing email
            // non-existence
            log.info("Forgot password requested for non-existent or disabled email: '{}'", email);
            return;
        }

        // Clean up any stale tokens for this user
        passwordResetTokenRepository.deleteByUserId(user.getId());

        String rawToken = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        String tokenHash = hashToken(rawToken);
        Instant expiresAt = Instant.now().plus(15, ChronoUnit.MINUTES);

        com.learnup.identity.domain.PasswordResetToken resetToken = new com.learnup.identity.domain.PasswordResetToken();
        resetToken.setId(UUID.randomUUID());
        resetToken.setUserId(user.getId());
        resetToken.setTokenHash(tokenHash);
        resetToken.setExpiresAt(expiresAt);

        passwordResetTokenRepository.save(resetToken);
        log.info("Generated password reset token for user [{}] (email: '{}'). Reset token: {}",
                user.getId(), email, rawToken);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw BusinessException.badRequest("New password and confirmation password do not match");
        }

        String rawToken = request.getToken().trim();
        String tokenHash = hashToken(rawToken);

        com.learnup.identity.domain.PasswordResetToken resetToken = passwordResetTokenRepository
                .findByTokenHash(tokenHash)
                .orElseThrow(
                        () -> BusinessException.badRequest("Invalid, expired, or already used password reset token"));

        if (!resetToken.isValid()) {
            throw BusinessException.badRequest("Invalid, expired, or already used password reset token");
        }

        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> BusinessException.notFound("User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword().trim()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        // Mark reset token as consumed
        resetToken.markUsed();
        passwordResetTokenRepository.save(resetToken);

        // Revoke all refresh tokens
        refreshTokenRepository.deleteByUserId(user.getId());
        log.info("Password successfully reset via reset token for user [{}]", user.getId());
    }

    @Transactional
    public void setCredentials(com.learnup.identity.dto.internal.SetCredentialsRequest request) {
        UUID userId = request.getUserId();
        String rawPassword = request.getPassword().trim();
        // Tenant là nguồn sự thật về tài khoản (BR-30: email duy nhất trong các tài
        // khoản chưa xóa).
        // Email đã thuộc một userId khác nghĩa là tài khoản cũ đã bị tenant xóa mềm
        // (đăng ký lại theo BR-276, đăng ký quá hạn theo BR-7/BR-31) -> giải phóng
        // email cho userId mới.
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            releaseEmailFromOtherUser(request.getEmail().trim().toLowerCase(), userId);
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            String username = (request.getUsername() != null && !request.getUsername().isBlank())
                    ? request.getUsername().trim()
                    : "user_" + userId.toString().substring(0, 8);
            String email = (request.getEmail() != null && !request.getEmail().isBlank())
                    ? request.getEmail().trim().toLowerCase()
                    : userId + "@learnup.local";
            UserRole role = request.getRole() != null ? request.getRole() : UserRole.LEARNER;

            user = new User();
            user.setId(userId);
            user.setUsername(username);
            user.setEmail(email);
            user.setFullName(request.getFullName());
            user.setRole(role);
            user.setOrganizationId(request.getOrganizationId());
            user.setEnabled(true);
            user.setCreatedAt(Instant.now());
        } else {
            if (request.getUsername() != null && !request.getUsername().isBlank()) {
                user.setUsername(request.getUsername().trim());
            }
            if (request.getEmail() != null && !request.getEmail().isBlank()) {
                user.setEmail(request.getEmail().trim().toLowerCase());
            }
            if (request.getRole() != null) {
                user.setRole(request.getRole());
            }
            if (request.getOrganizationId() != null) {
                user.setOrganizationId(request.getOrganizationId());
            }
        }

        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        // Revoke all existing refresh tokens if password is reset/updated
        refreshTokenRepository.deleteByUserId(userId);
        log.info("Credentials successfully set for user [{}]", userId);
    }

    /**
     * Xóa thông tin đăng nhập cũ đang giữ email của một userId khác.
     * refresh_tokens và password_reset_tokens của user cũ tự xóa theo (ON DELETE
     * CASCADE).
     */
    private void releaseEmailFromOtherUser(String email, UUID ownerId) {
        userRepository.findByEmail(email)
                .filter(other -> !other.getId().equals(ownerId))
                .ifPresent(other -> {
                    userRepository.delete(other);
                    // DELETE phải xuống DB ngay; nếu để Hibernate tự flush thì INSERT chạy trước và
                    // vẫn vướng UNIQUE(email)
                    userRepository.flush();
                    log.info("Released email from stale credentials of user [{}] for user [{}]",
                            other.getId(), ownerId);
                });
    }

    private String createAndPersistRefreshToken(UUID userId) {
        return issueRefreshToken(userId, null).rawToken();
    }

    private IssuedRefreshToken issueRefreshToken(UUID userId, UUID familyId) {
        String rawToken = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        String tokenHash = hashToken(rawToken);

        Instant expiresAt = Instant.now().plus(jwtTokenService.getRefreshTokenExpirationDays(), ChronoUnit.DAYS);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setId(UUID.randomUUID());
        refreshToken.setUserId(userId);
        refreshToken.setTokenHash(tokenHash);
        refreshToken.setExpiresAt(expiresAt);
        refreshToken.setFamilyId(familyId);

        refreshTokenRepository.save(refreshToken);
        return new IssuedRefreshToken(refreshToken.getId(), rawToken);
    }

    private record IssuedRefreshToken(UUID id, String rawToken) {
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
