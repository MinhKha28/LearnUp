package com.learnup.identity.controller;

import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.GoogleSignInException;
import com.learnup.identity.exception.TenantUnavailableException;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import com.learnup.identity.service.GoogleIdTokenVerifier;
import com.learnup.identity.service.GoogleIdTokenVerifier.VerifiedGoogleIdentity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UC05.1 end-to-end through the real controller, security chain, persistence and token issuance. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GoogleSignInControllerIntegrationTest {

    private static final String CREDENTIAL = "header.payload.signature";
    private static final UUID ORG = UUID.randomUUID();

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private LoginThrottleRepository loginThrottleRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @MockBean private TenantAccessClient tenantAccessClient;
    @MockBean private GoogleIdTokenVerifier verifier;

    @BeforeEach
    void setUp() {
        loginThrottleRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
    }

    private User user(String email, UserRole role, boolean enabled) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("user_" + UUID.randomUUID().toString().replace("-", ""));
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("existingPassword123"));
        user.setFullName("Existing User");
        user.setRole(role);
        user.setOrganizationId(role == UserRole.ADMIN ? null : ORG);
        user.setEnabled(enabled);
        return userRepository.saveAndFlush(user);
    }

    private void googleSays(String email) {
        when(verifier.verify(CREDENTIAL)).thenReturn(new VerifiedGoogleIdentity("google-sub-1", email));
    }

    private ResultActions signIn(String path) throws Exception {
        return mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content("{\"credential\":\"" + CREDENTIAL + "\"}"));
    }

    @ParameterizedTest(name = "{0} signs in with Google")
    @EnumSource(value = UserRole.class, names = {"ORGANIZER", "INSTRUCTOR", "LEARNER"})
    void eligibleRolesReceiveTheStandardSession(UserRole role) throws Exception {
        User existing = user("member@example.com", role, true);
        googleSays("member@example.com");

        signIn("/api/v1/auth/google")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.accessMode").value("Full"))
                .andExpect(jsonPath("$.data.user.id").value(existing.getId().toString()))
                .andExpect(jsonPath("$.data.user.role").value(role.name()))
                .andExpect(jsonPath("$.data.user.passwordHash").doesNotExist());

        assertThat(refreshTokenRepository.count()).isEqualTo(1);
        verify(tenantAccessClient).check(existing.getId());
        User after = userRepository.findById(existing.getId()).orElseThrow();
        assertThat(after.getPasswordHash()).isEqualTo(existing.getPasswordHash());
        assertThat(after.getEmail()).isEqualTo("member@example.com");
    }

    @Test
    void legacyAliasPathIsSupported() throws Exception {
        user("member@example.com", UserRole.LEARNER, true);
        googleSays("member@example.com");
        signIn("/api/auth/google").andExpect(status().isOk());
    }

    @Test
    void unknownGoogleEmailIsRejectedAndNoAccountIsCreated() throws Exception {
        user("someone.else@example.com", UserRole.LEARNER, true);
        googleSays("stranger@example.com");

        signIn("/api/v1/auth/google")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.ACCOUNT_NOT_LINKED))
                .andExpect(jsonPath("$.data").doesNotExist());

        assertThat(userRepository.count()).isEqualTo(1);
        assertThat(refreshTokenRepository.count()).isZero();
        verify(tenantAccessClient, never()).check(any());
    }

    @Test
    void releasedCredentialWithNullEmailCannotBeReached() throws Exception {
        // Released credentials (Identity V5) keep their row but lose the email, so the old owner is unreachable.
        User released = user("released@example.com", UserRole.LEARNER, true);
        released.setEmail(null);
        userRepository.saveAndFlush(released);
        googleSays("released@example.com");
        signIn("/api/v1/auth/google")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.ACCOUNT_NOT_LINKED));
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    void platformAdminCannotUseGoogleSignIn() throws Exception {
        user("admin@example.com", UserRole.ADMIN, true);
        googleSays("admin@example.com");

        signIn("/api/v1/auth/google")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.NOT_ALLOWED));

        assertThat(refreshTokenRepository.count()).isZero();
        verify(tenantAccessClient, never()).check(any());
    }

    @Test
    void disabledCredentialIsRejected() throws Exception {
        user("member@example.com", UserRole.LEARNER, false);
        googleSays("member@example.com");
        signIn("/api/v1/auth/google")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ORGANIZATION_NOT_ACTIVE", "ACCOUNT_DEACTIVATED", "SUBSCRIPTION_ENDED", "ORGANIZATION_SUSPENDED"})
    void tenantEligibilityDenialsMatchPasswordLogin(String reason) throws Exception {
        User existing = user("member@example.com", UserRole.ORGANIZER, true);
        googleSays("member@example.com");
        when(tenantAccessClient.check(eq(existing.getId()))).thenReturn(new SignInAccess(false, null, reason));

        signIn("/api/v1/auth/google")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value(reason));
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    void tenantDeletedAccountIsTreatedAsNotLinked() throws Exception {
        User existing = user("member@example.com", UserRole.LEARNER, true);
        googleSays("member@example.com");
        when(tenantAccessClient.check(eq(existing.getId()))).thenReturn(new SignInAccess(false, null, "ACCOUNT_NOT_FOUND"));

        signIn("/api/v1/auth/google")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.ACCOUNT_NOT_LINKED));
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    void tenantOutageFailsClosed() throws Exception {
        user("member@example.com", UserRole.LEARNER, true);
        googleSays("member@example.com");
        when(tenantAccessClient.check(any())).thenThrow(new TenantUnavailableException(new RuntimeException("down")));

        signIn("/api/v1/auth/google")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("TENANT_UNAVAILABLE"));
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    void invalidGoogleCredentialIsRejectedBeforeAnyLookup() throws Exception {
        user("member@example.com", UserRole.LEARNER, true);
        when(verifier.verify(CREDENTIAL)).thenThrow(GoogleSignInException.invalidCredential(null));

        signIn("/api/v1/auth/google")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.CREDENTIAL_INVALID));
        verify(tenantAccessClient, never()).check(any());
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @Test
    void unconfiguredGoogleSignInIsUnavailable() throws Exception {
        when(verifier.verify(CREDENTIAL)).thenThrow(GoogleSignInException.unavailable(null));
        signIn("/api/v1/auth/google")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.UNAVAILABLE));
    }

    @Test
    void blankCredentialIsAValidationError() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"credential\":\"\"}"))
                .andExpect(status().isBadRequest());
        verify(verifier, never()).verify(any());
    }

    @Test
    void passwordLoginIsUnchangedForAccountsThatAlsoUseGoogle() throws Exception {
        user("member@example.com", UserRole.LEARNER, true);
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"member@example.com\",\"password\":\"existingPassword123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
        verify(verifier, never()).verify(any());
    }
}
