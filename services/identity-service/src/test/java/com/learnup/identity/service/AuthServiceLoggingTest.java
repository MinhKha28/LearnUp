package com.learnup.identity.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.learnup.common.context.CorrelationContext;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.AuthResponse;
import com.learnup.identity.dto.ForgotPasswordRequest;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.SignInDeniedException;
import com.learnup.identity.mapper.UserMapper;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AuthServiceLoggingTest {

    private static final UUID USER_ID = UUID.fromString("01900000-0000-7000-8000-00000000a301");
    private static final String CORRELATION_ID = "01900000-0000-7000-8000-00000000a302";
    private static final String IDENTIFIER = "synthetic-auth-secret-identifier@example.test";
    private static final String PASSWORD = "SyntheticPrivatePassword123!";
    private static final String PASSWORD_HASH = "synthetic-private-password-hash";
    private static final String ACCESS_TOKEN = "synthetic-private-access-token";

    private UserRepository userRepository;
    private RefreshTokenRepository refreshTokenRepository;
    private PasswordResetTokenRepository resetTokenRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenService jwtTokenService;
    private TenantAccessClient tenantAccessClient;
    private LoginThrottleService loginThrottleService;
    private AuthService authService;
    private User user;
    private Logger logger;
    private ListAppender<ILoggingEvent> logs;
    private Level originalLevel;
    private boolean originalAdditive;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        refreshTokenRepository = mock(RefreshTokenRepository.class);
        resetTokenRepository = mock(PasswordResetTokenRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenService = mock(JwtTokenService.class);
        tenantAccessClient = mock(TenantAccessClient.class);
        loginThrottleService = mock(LoginThrottleService.class);
        RecoveryRequestLimiter recoveryLimiter = mock(RecoveryRequestLimiter.class);
        when(recoveryLimiter.allow(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(true);
        authService = new AuthService(userRepository, refreshTokenRepository, resetTokenRepository,
                passwordEncoder, jwtTokenService, tenantAccessClient, loginThrottleService, mock(UserMapper.class),
                recoveryLimiter, mock(PasswordRecoveryDelivery.class));
        user = new User();
        user.setId(USER_ID);
        user.setUsername(IDENTIFIER);
        user.setEmail(IDENTIFIER);
        user.setPasswordHash(PASSWORD_HASH);
        user.setRole(UserRole.LEARNER);
        user.setEnabled(true);
        CorrelationContext.setCorrelationId(CORRELATION_ID);

        logger = (Logger) LoggerFactory.getLogger(AuthService.class);
        originalLevel = logger.getLevel();
        originalAdditive = logger.isAdditive();
        logger.setLevel(Level.INFO);
        logger.setAdditive(false);
        logs = new ListAppender<>();
        logs.setContext(logger.getLoggerContext());
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(logs);
        logs.stop();
        logger.setLevel(originalLevel);
        logger.setAdditive(originalAdditive);
        CorrelationContext.clear();
    }

    @Test
    void shouldPersistOnlyTheExpectedResetTokenHashWithoutLoggingTheRawTokenOrHash() throws Exception {
        UUID first = UUID.fromString("01900000-0000-7000-8000-00000000a311");
        UUID second = UUID.fromString("01900000-0000-7000-8000-00000000a312");
        UUID tokenId = UUID.fromString("01900000-0000-7000-8000-00000000a313");
        String rawToken = first + "-" + second;
        String expectedHash = sha256(rawToken);
        when(userRepository.findByEmailForUpdate(IDENTIFIER)).thenReturn(Optional.of(user));
        Instant before = Instant.now();

        try (MockedStatic<UUID> uuids = mockStatic(UUID.class, CALLS_REAL_METHODS)) {
            uuids.when(UUID::randomUUID).thenReturn(first, second, tokenId);
            authService.forgotPassword(new ForgotPasswordRequest(IDENTIFIER));
        }

        Instant after = Instant.now();
        ArgumentCaptor<PasswordResetToken> captured = ArgumentCaptor.forClass(PasswordResetToken.class);
        var ordered = inOrder(resetTokenRepository);
        ordered.verify(resetTokenRepository).deleteByUserId(USER_ID);
        ordered.verify(resetTokenRepository).save(captured.capture());
        PasswordResetToken saved = captured.getValue();
        assertThat(saved.getId()).isEqualTo(tokenId);
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getTokenHash()).isEqualTo(expectedHash).hasSize(64).isNotEqualTo(rawToken);
        assertThat(saved.getExpiresAt()).isBetween(before.plusSeconds(900), after.plusSeconds(900));
        assertThat(saved.getUsedAt()).isNull();
        assertSingleSafeEvent("password_recovery_token_created", true);
        assertSecretsAbsent(rawToken, expectedHash);
    }

    @Test
    void shouldLogDisabledLoginWithoutEchoingTheSuppliedIdentifier() {
        user.setEnabled(false);
        when(userRepository.findByUsernameOrEmailForUpdate(IDENTIFIER, IDENTIFIER)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest(IDENTIFIER, PASSWORD)))
                .isInstanceOf(BusinessException.class);

        assertSingleSafeEvent("login_rejected", true);
        assertThat(logs.list.getFirst().getFormattedMessage()).contains("reason=ACCOUNT_DISABLED");
        assertSecretsAbsent();
        verifyNoInteractions(passwordEncoder, tenantAccessClient);
    }

    @Test
    void shouldLogInvalidPasswordWithoutEchoingTheIdentifierPasswordOrHash() {
        when(userRepository.findByUsernameOrEmailForUpdate(IDENTIFIER, IDENTIFIER)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest(IDENTIFIER, PASSWORD)))
                .isInstanceOf(BusinessException.class);

        assertSingleSafeEvent("login_rejected", true);
        assertThat(logs.list.getFirst().getFormattedMessage()).contains("reason=INVALID_PASSWORD");
        assertSecretsAbsent();
        verify(loginThrottleService).recordFailure(IDENTIFIER);
        verifyNoInteractions(tenantAccessClient);
    }

    @Test
    void shouldLogSuccessfulLoginWithoutEchoingCredentialsOrIssuedTokens() throws Exception {
        allowPasswordVerification();
        when(tenantAccessClient.check(USER_ID)).thenReturn(new SignInAccess(true, "Full", null));
        when(jwtTokenService.generateAccessToken(user)).thenReturn(ACCESS_TOKEN);
        when(jwtTokenService.getAccessTokenExpirationSeconds()).thenReturn(900L);
        when(jwtTokenService.getRefreshTokenExpirationDays()).thenReturn(7L);

        AuthResponse response = authService.login(new LoginRequest(IDENTIFIER, PASSWORD));

        ArgumentCaptor<RefreshToken> captured = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captured.capture());
        assertThat(response.getAccessToken()).isEqualTo(ACCESS_TOKEN);
        assertThat(captured.getValue().getTokenHash()).isEqualTo(sha256(response.getRefreshToken()));
        assertSingleSafeEvent("login_succeeded", true);
        assertSecretsAbsent(response.getRefreshToken(), captured.getValue().getTokenHash());
    }

    @Test
    void shouldLogUnknownRecoveryWithoutEchoingTheSuppliedEmail() {
        when(userRepository.findByEmailForUpdate(IDENTIFIER)).thenReturn(Optional.empty());

        authService.forgotPassword(new ForgotPasswordRequest(IDENTIFIER));

        assertSingleSafeEvent("password_recovery_ignored", false);
        assertThat(logs.list.getFirst().getFormattedMessage()).contains("reason=ACCOUNT_UNAVAILABLE");
        assertSecretsAbsent();
        verifyNoInteractions(resetTokenRepository);
    }

    @Test
    void shouldLogDisabledRecoveryWithoutEchoingTheSuppliedEmail() {
        user.setEnabled(false);
        when(userRepository.findByEmailForUpdate(IDENTIFIER)).thenReturn(Optional.of(user));

        authService.forgotPassword(new ForgotPasswordRequest(IDENTIFIER));

        assertSingleSafeEvent("password_recovery_ignored", false);
        assertSecretsAbsent();
        verifyNoInteractions(resetTokenRepository);
    }

    @Test
    void shouldNotEchoAnUnexpectedTenantRejectionReason() {
        String upstreamSecret = "synthetic-secret-in-upstream-reason";
        allowPasswordVerification();
        when(tenantAccessClient.check(USER_ID)).thenReturn(new SignInAccess(false, null, upstreamSecret));

        assertThatThrownBy(() -> authService.login(new LoginRequest(IDENTIFIER, PASSWORD)))
                .isInstanceOfSatisfying(SignInDeniedException.class,
                        failure -> assertThat(failure.getReason()).isEqualTo("ACCESS_DENIED"))
                .hasMessage("Sign-in is not allowed");

        assertSingleSafeEvent("login_rejected", true);
        assertThat(logs.list.getFirst().getFormattedMessage()).contains("reason=ACCESS_DENIED");
        assertSecretsAbsent(upstreamSecret);
        verify(jwtTokenService, never()).generateAccessToken(user);
    }

    @Test
    void shouldNotEchoAnUntrustedCorrelationValueInAuthenticationLogs() {
        String correlationSecret = "synthetic-private-value-in-correlation-header";
        CorrelationContext.setCorrelationId(correlationSecret);
        when(userRepository.findByEmailForUpdate(IDENTIFIER)).thenReturn(Optional.empty());

        authService.forgotPassword(new ForgotPasswordRequest(IDENTIFIER));

        assertThat(logs.list).hasSize(1);
        assertThat(logs.list.getFirst().getFormattedMessage())
                .contains("event=password_recovery_ignored", "correlation_id=unavailable");
        assertSecretsAbsent(correlationSecret);
    }

    private void allowPasswordVerification() {
        when(userRepository.findByUsernameOrEmailForUpdate(IDENTIFIER, IDENTIFIER)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
    }

    private void assertSingleSafeEvent(String event, boolean identifiesUser) {
        assertThat(logs.list).hasSize(1);
        String message = logs.list.getFirst().getFormattedMessage();
        assertThat(message).contains("event=" + event, "correlation_id=" + CORRELATION_ID);
        assertThat(UUID.fromString(CORRELATION_ID).toString()).isEqualTo(CORRELATION_ID);
        if (identifiesUser) {
            assertThat(message).contains("user_id=" + USER_ID);
        }
    }

    private void assertSecretsAbsent(String... additionalSecrets) {
        for (ILoggingEvent event : logs.list) {
            assertThat(event.getThrowableProxy()).isNull();
            assertNoSecrets(event.getMessage(), additionalSecrets);
            assertNoSecrets(event.getFormattedMessage(), additionalSecrets);
            if (event.getArgumentArray() != null) {
                for (Object argument : event.getArgumentArray()) {
                    assertNoSecrets(String.valueOf(argument), additionalSecrets);
                }
            }
        }
    }

    private void assertNoSecrets(String diagnostic, String[] additionalSecrets) {
        assertThat(diagnostic).doesNotContain(IDENTIFIER, PASSWORD, PASSWORD_HASH, ACCESS_TOKEN);
        for (String secret : additionalSecrets) {
            assertThat(diagnostic).doesNotContain(secret);
        }
    }

    private String sha256(String rawToken) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
    }
}
