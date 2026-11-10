package com.learnup.identity.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.ChangePasswordRequest;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.ResetPasswordRequest;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import com.learnup.identity.service.JwtTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UC05 (password sign-in) and UC08 (change password) hardening, plus the UC07 interaction: account state
 * is only revealed after the password is verified, stored (trimmed) and typed passwords match consistently,
 * new passwords respect BCrypt's 72-byte limit, and current-password guesses are throttled per account.
 * Runs on the H2 test profile with a mocked Tenant access check; no persistent database is used.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordCredentialHardeningIntegrationTest {

    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final String PASSWORD = "currentPass123";
    private static final String NEW_PASSWORD = "replacementPass456";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtTokenService jwtTokenService;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private LoginThrottleRepository loginThrottleRepository;
    @SpyBean private PasswordEncoder passwordEncoder;
    @MockBean private TenantAccessClient tenantAccessClient;

    @BeforeEach
    void setUp() {
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        loginThrottleRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ---------------------------------------------------------------- UC05: account-state disclosure

    @Test
    @DisplayName("UC05: a disabled account with a wrong password gets the generic answer, not its state")
    void disabledAccountIsNotRevealedWithoutThePassword() throws Exception {
        User user = createUser("disabled@learnup.test", PASSWORD, false);

        login(user.getEmail(), "wrongPassword1")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Invalid username or password"));

        assertThat(loginThrottleRepository.findById(user.getEmail())).isPresent();
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    @DisplayName("UC05: a disabled account is only reported after the correct password, and gets no session")
    void disabledAccountIsReportedOnlyAfterTheCorrectPassword() throws Exception {
        User user = createUser("disabled2@learnup.test", PASSWORD, false);

        login(user.getEmail(), PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("User account is disabled"))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist());

        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    @DisplayName("UC05: password guessing against a disabled account is throttled like any other account")
    void disabledAccountGuessingIsThrottled() throws Exception {
        User user = createUser("disabled3@learnup.test", PASSWORD, false);
        for (int attempt = 0; attempt < 5; attempt++) {
            login(user.getEmail(), "wrongPassword" + attempt).andExpect(status().isUnauthorized());
        }

        login(user.getEmail(), PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    @DisplayName("UC05: an unknown account costs the same BCrypt check as a known one")
    void unknownAccountRunsAPasswordCheck() throws Exception {
        clearInvocations(passwordEncoder);

        login("nobody@learnup.test", "whateverPass1").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Invalid username or password"));

        verify(passwordEncoder, times(1)).matches(anyString(), anyString());
    }

    @Test
    @DisplayName("UC05: a valid enabled account still signs in, and Tenant is consulted only after the password")
    void validAccountSignsIn() throws Exception {
        User user = createUser("valid@learnup.test", PASSWORD, true);

        login(user.getEmail(), "wrongPassword1").andExpect(status().isUnauthorized());
        verify(tenantAccessClient, times(0)).check(user.getId());

        login(user.getEmail(), PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refreshToken").isString());
        assertThat(loginThrottleRepository.findById(user.getEmail())).isEmpty();
    }

    // ---------------------------------------------------------------- UC05: whitespace consistency

    @Test
    @DisplayName("UC05/UC07: a password set with surrounding spaces keeps working when typed the same way")
    void paddedPasswordSetByResetStillSignsIn() throws Exception {
        User user = createUser("padded@learnup.test", PASSWORD, true);
        String token = issueResetToken(user);

        resetPassword(token, "  paddedPass789  ").andExpect(status().isOk());

        login(user.getEmail(), "  paddedPass789  ").andExpect(status().isOk());
        login(user.getEmail(), "paddedPass789").andExpect(status().isOk());
    }

    @Test
    @DisplayName("UC05: a legacy hash of an untrimmed password is still accepted exactly as typed")
    void legacyUntrimmedHashStillSignsIn() throws Exception {
        User user = createUser("legacy@learnup.test", " legacyPass123 ", true);
        String storedHash = userRepository.findById(user.getId()).orElseThrow().getPasswordHash();

        login(user.getEmail(), " legacyPass123 ").andExpect(status().isOk());
        assertThat(userRepository.findById(user.getId()).orElseThrow().getPasswordHash()).isEqualTo(storedHash);
    }

    @Test
    @DisplayName("UC05: a blank-padded password is never reduced to an empty password")
    void whitespaceOnlyPasswordNeverMatches() throws Exception {
        User user = createUser("blank@learnup.test", PASSWORD, true);
        login(user.getEmail(), "      ").andExpect(status().isBadRequest());
        login(user.getEmail(), " " + PASSWORD + "x ").andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- UC08: throttling

    @Test
    @DisplayName("UC08: five wrong current passwords lock password change, even for the correct password next")
    void currentPasswordGuessingIsThrottled() throws Exception {
        User user = createUser("guess@learnup.test", PASSWORD, true);
        String refreshToken = loginAndGetRefreshToken(user.getEmail(), PASSWORD);
        String hashBefore = passwordHash(user);

        for (int attempt = 0; attempt < 5; attempt++) {
            changePassword(user, "wrongCurrent" + attempt, NEW_PASSWORD)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.message").value("Current password is incorrect"));
        }

        changePassword(user, PASSWORD, NEW_PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("TOO_MANY_ATTEMPTS"))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER));

        assertThat(passwordHash(user)).isEqualTo(hashBefore);
        refresh(refreshToken).andExpect(status().isOk()); // the lock does not end existing sessions
    }

    @Test
    @DisplayName("UC08: a successful change clears earlier failures")
    void successfulChangeResetsFailures() throws Exception {
        User user = createUser("reset-count@learnup.test", PASSWORD, true);
        for (int attempt = 0; attempt < 4; attempt++) {
            changePassword(user, "wrongCurrent" + attempt, NEW_PASSWORD).andExpect(status().isBadRequest());
        }
        changePassword(user, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());

        changePassword(user, "wrongAgain", "anotherPass789").andExpect(status().isBadRequest());
        changePassword(user, NEW_PASSWORD, "anotherPass789").andExpect(status().isOk());
    }

    @Test
    @DisplayName("UC08: the password-change lock is per account and independent of sign-in")
    void passwordChangeLockIsScoped() throws Exception {
        User locked = createUser("locked@learnup.test", PASSWORD, true);
        User other = createUser("other@learnup.test", PASSWORD, true);
        for (int attempt = 0; attempt < 5; attempt++) {
            changePassword(locked, "wrongCurrent" + attempt, NEW_PASSWORD).andExpect(status().isBadRequest());
        }

        login(locked.getEmail(), PASSWORD).andExpect(status().isOk());
        changePassword(other, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("UC08: failed sign-ins with a crafted identifier cannot lock another account's password change")
    void signInCannotLockPasswordChange() throws Exception {
        User user = createUser("victim@learnup.test", PASSWORD, true);
        String crafted = "PASSWORD-CHANGE:" + user.getId();
        for (int attempt = 0; attempt < 6; attempt++) {
            login(crafted, "wrongPassword" + attempt);
        }

        changePassword(user, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- UC08: new-password policy

    @Test
    @DisplayName("UC08: a new password shorter than 6 characters once trimmed is rejected")
    void paddedShortPasswordIsRejected() throws Exception {
        User user = createUser("short@learnup.test", PASSWORD, true);
        String hashBefore = passwordHash(user);

        changePassword(user, PASSWORD, "   abc    ").andExpect(status().isBadRequest());

        assertThat(passwordHash(user)).isEqualTo(hashBefore);
    }

    @Test
    @DisplayName("UC08: a new password over BCrypt's 72-byte limit is rejected; exactly 72 bytes is accepted")
    void bcryptByteLimitIsEnforced() throws Exception {
        User user = createUser("long@learnup.test", PASSWORD, true);
        String seventyFiveBytes = "€".repeat(25); // 25 characters, 3 bytes each
        String seventyTwoBytes = "a".repeat(72);

        changePassword(user, PASSWORD, seventyFiveBytes).andExpect(status().isBadRequest());
        changePassword(user, PASSWORD, seventyTwoBytes).andExpect(status().isOk());

        login(user.getEmail(), seventyTwoBytes).andExpect(status().isOk());
        login(user.getEmail(), "a".repeat(71) + "b").andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("UC08: a new password equal to the current one apart from spaces is rejected")
    void sameStoredPasswordIsRejected() throws Exception {
        User user = createUser("same@learnup.test", PASSWORD, true);

        changePassword(user, PASSWORD, "  " + PASSWORD + " ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("New password cannot be the same as the current password"));
    }

    @Test
    @DisplayName("UC08/UC05: a padded new password signs in typed either way and ends the old sessions")
    void paddedChangedPasswordSignsIn() throws Exception {
        User user = createUser("padded-change@learnup.test", PASSWORD, true);
        String refreshToken = loginAndGetRefreshToken(user.getEmail(), PASSWORD);

        changePassword(user, PASSWORD, " " + NEW_PASSWORD + " ").andExpect(status().isOk());

        refresh(refreshToken).andExpect(status().isUnauthorized());
        login(user.getEmail(), PASSWORD).andExpect(status().isUnauthorized());
        login(user.getEmail(), " " + NEW_PASSWORD + " ").andExpect(status().isOk());
        login(user.getEmail(), NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("UC08: a current password typed with stray spaces is accepted like at sign-in")
    void paddedCurrentPasswordIsAccepted() throws Exception {
        User user = createUser("padded-current@learnup.test", PASSWORD, true);
        changePassword(user, " " + PASSWORD + " ", NEW_PASSWORD).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- UC07 / provisioning interaction

    @Test
    @DisplayName("UC07: an over-long reset password is rejected without consuming the link")
    void resetRejectsOverLongPasswordWithoutConsumingTheLink() throws Exception {
        User user = createUser("reset-long@learnup.test", PASSWORD, true);
        String token = issueResetToken(user);

        resetPassword(token, "€".repeat(25)).andExpect(status().isBadRequest());
        resetPassword(token, NEW_PASSWORD).andExpect(status().isOk());
        login(user.getEmail(), NEW_PASSWORD).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"  abc  ", "€€€€€€€€€€€€€€€€€€€€€€€€€"})
    @DisplayName("Activation: credential provisioning applies the same stored-password limits")
    void provisioningAppliesTheSamePolicy(String password) throws Exception {
        UUID userId = UUID.randomUUID();
        SetCredentialsRequest request = new SetCredentialsRequest(userId, password);
        request.setEmail("activation@learnup.test");
        request.setFullName("Activation User");
        request.setRole(UserRole.LEARNER);
        request.setOrganizationId(UUID.randomUUID());

        mockMvc.perform(post("/api/internal/credentials")
                        .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findById(userId)).isEmpty();
    }

    // ---------------------------------------------------------------- helpers

    private User createUser(String email, String password, boolean enabled) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setFullName("Test User");
        user.setRole(UserRole.LEARNER);
        user.setOrganizationId(UUID.randomUUID());
        user.setEnabled(enabled);
        return userRepository.saveAndFlush(user);
    }

    private String passwordHash(User user) {
        return userRepository.findById(user.getId()).orElseThrow().getPasswordHash();
    }

    private ResultActions login(String identifier, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(identifier, password))));
    }

    private String loginAndGetRefreshToken(String identifier, String password) throws Exception {
        MvcResult result = login(identifier, password).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("refreshToken").asText();
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("refreshToken", refreshToken))));
    }

    private ResultActions changePassword(User user, String current, String next) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/change-password")
                .with(asGateway(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChangePasswordRequest(current, next, next))));
    }

    private ResultActions resetPassword(String token, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ResetPasswordRequest(token, password, password))));
    }

    private String issueResetToken(User user) throws Exception {
        String rawToken = "synthetic-reset-" + UUID.randomUUID();
        PasswordResetToken token = new PasswordResetToken();
        token.setId(UUID.randomUUID());
        token.setUserId(user.getId());
        token.setTokenHash(HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8))));
        token.setExpiresAt(Instant.now().plus(15, ChronoUnit.MINUTES));
        passwordResetTokenRepository.saveAndFlush(token);
        return rawToken;
    }

    private RequestPostProcessor asGateway(User user) {
        return request -> {
            request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + jwtTokenService.generateAccessToken(user));
            request.addHeader(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY);
            return request;
        };
    }
}
