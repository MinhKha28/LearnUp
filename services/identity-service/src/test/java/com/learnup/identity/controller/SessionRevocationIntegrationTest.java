package com.learnup.identity.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.config.JwtConfig;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import com.learnup.identity.service.JwtTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UC06: ending a session must work even after the access JWT expired, and only for that session. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class SessionRevocationIntegrationTest {

    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final String JWT_SECRET = "testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!";
    private static final String PASSWORD = "currentPass123";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private LoginThrottleRepository loginThrottleRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenService jwtTokenService;
    @MockBean private TenantAccessClient tenantAccessClient;

    private record Session(String accessToken, String refreshToken) { }

    @BeforeEach
    void setUp() {
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        loginThrottleRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    private User user(String email) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("user_" + UUID.randomUUID().toString().replace("-", ""));
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Member");
        user.setRole(UserRole.LEARNER);
        user.setOrganizationId(UUID.randomUUID());
        user.setEnabled(true);
        return userRepository.saveAndFlush(user);
    }

    private Session login(User user) throws Exception {
        String body = mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + user.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).path("data");
        return new Session(data.path("accessToken").asText(), data.path("refreshToken").asText());
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refreshToken + "\"}"));
    }

    private Session rotate(String refreshToken) throws Exception {
        String body = refresh(refreshToken).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).path("data");
        return new Session(data.path("accessToken").asText(), data.path("refreshToken").asText());
    }

    /** What the browser sends: no access token required (the Gateway route is public). */
    private ResultActions revoke(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/revoke").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refreshToken + "\"}"));
    }

    private String expiredAccessToken(User user) {
        JwtConfig expired = new JwtConfig();
        expired.setSecret(JWT_SECRET);
        expired.setAccessTokenExpirationMinutes(-1);
        return new JwtTokenService(expired).generateAccessToken(user);
    }

    private ResultActions authenticatedLogout(String accessToken, String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/logout")
                .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long activeTokens(UUID userId) {
        return refreshTokenRepository.findAll().stream()
                .filter(t -> t.getUserId().equals(userId) && t.isValid()).count();
    }

    // ---- the reported scenario ------------------------------------------------------------------

    @Test
    @DisplayName("Expired access token: protected /logout stays 401, but /revoke ends the session")
    void expiredAccessTokenDoesNotPreventLogout() throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);

        authenticatedLogout(expiredAccessToken(alice), "{\"refreshToken\":\"" + session.refreshToken() + "\"}")
                .andExpect(status().isUnauthorized());
        assertThat(activeTokens(alice.getId())).isEqualTo(1); // the old gap: nothing was revoked

        mockMvc.perform(post("/api/v1/auth/revoke")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredAccessToken(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + session.refreshToken() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").value("Session ended"));

        refresh(session.refreshToken()).andExpect(status().isUnauthorized());
        assertThat(activeTokens(alice.getId())).isZero();
    }

    @Test
    @DisplayName("Single-device logout ends only this device's session")
    void revokeEndsOnlyThisDevice() throws Exception {
        User alice = user("alice@example.com");
        Session laptop = login(alice);
        Session phone = login(alice);

        revoke(laptop.refreshToken()).andExpect(status().isOk());

        refresh(laptop.refreshToken()).andExpect(status().isUnauthorized());
        refresh(phone.refreshToken()).andExpect(status().isOk());
    }

    @Test
    void legacyAliasPathWorks() throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);
        mockMvc.perform(post("/api/auth/revoke").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + session.refreshToken() + "\"}"))
                .andExpect(status().isOk());
        refresh(session.refreshToken()).andExpect(status().isUnauthorized());
    }

    // ---- neutral, idempotent behaviour ---------------------------------------------------------

    @Test
    @DisplayName("Unknown token: neutral 200 and no session is touched")
    void unknownTokenIsNeutral() throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);

        revoke(UUID.randomUUID() + "-" + UUID.randomUUID()).andExpect(status().isOk());

        assertThat(activeTokens(alice.getId())).isEqualTo(1);
        refresh(session.refreshToken()).andExpect(status().isOk());
    }

    @Test
    void expiredRefreshTokenIsNeutralAndStaysUnusable() throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);
        RefreshToken stored = refreshTokenRepository.findAll().get(0);
        stored.setExpiresAt(Instant.now().minusSeconds(60));
        refreshTokenRepository.saveAndFlush(stored);

        revoke(session.refreshToken()).andExpect(status().isOk());
        refresh(session.refreshToken()).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Repeated logout is safe and always answers the same way")
    void repeatedRevokeIsIdempotent() throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);
        for (int i = 0; i < 3; i++) {
            revoke(session.refreshToken()).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.message").value("Session ended"));
        }
        refresh(session.refreshToken()).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"refreshToken\":\"\"}", "{\"refreshToken\":\"   \"}", "{}"})
    void malformedRequestIsRejected(String body) throws Exception {
        mockMvc.perform(post("/api/v1/auth/revoke").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void oversizedTokenIsRejected() throws Exception {
        revoke("x".repeat(513)).andExpect(status().isBadRequest());
    }

    // ---- rotation races -------------------------------------------------------------------------

    @Test
    @DisplayName("Logging out with the token read just before a rotation also ends the rotated successor")
    void revokeWithRotatedTokenEndsTheSuccessor() throws Exception {
        User alice = user("alice@example.com");
        Session first = login(alice);
        Session rotated = rotate(first.refreshToken());

        revoke(first.refreshToken()).andExpect(status().isOk());

        refresh(rotated.refreshToken()).andExpect(status().isUnauthorized());
        assertThat(activeTokens(alice.getId())).isZero();
    }

    @RepeatedTest(5)
    @DisplayName("Concurrent refresh and logout never leave a live session behind")
    void concurrentRefreshAndRevokeLeaveNoActiveSession() throws Exception {
        User alice = user("alice" + UUID.randomUUID() + "@example.com");
        Session session = login(alice);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<String> refreshed = CompletableFuture.supplyAsync(() -> {
                try {
                    start.await();
                    String body = refresh(session.refreshToken()).andReturn().getResponse().getContentAsString();
                    return objectMapper.readTree(body).path("data").path("refreshToken").asText(null);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }, pool);
            CompletableFuture<Integer> revoked = CompletableFuture.supplyAsync(() -> {
                try {
                    start.await();
                    return revoke(session.refreshToken()).andReturn().getResponse().getStatus();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }, pool);
            start.countDown();
            String successor = refreshed.get(30, TimeUnit.SECONDS);
            assertThat(revoked.get(30, TimeUnit.SECONDS)).isEqualTo(200);

            assertThat(activeTokens(alice.getId())).isZero();
            if (successor != null) {
                refresh(successor).andExpect(status().isUnauthorized());
            }
        } finally {
            pool.shutdownNow();
        }
    }

    // ---- authorization and isolation ------------------------------------------------------------

    @Test
    @DisplayName("Revoking one user's session never affects another user")
    void revokeIsIsolatedPerUser() throws Exception {
        User alice = user("alice@example.com");
        User bob = user("bob@example.com");
        Session alices = login(alice);
        Session bobs = login(bob);

        revoke(alices.refreshToken()).andExpect(status().isOk());

        refresh(bobs.refreshToken()).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Authenticated /logout ignores a refresh token that belongs to someone else")
    void authenticatedLogoutCannotRevokeAnotherUsersSession() throws Exception {
        User alice = user("alice@example.com");
        User mallory = user("mallory@example.com");
        Session alices = login(alice);
        Session mallorys = login(mallory);

        authenticatedLogout(mallorys.accessToken(), "{\"refreshToken\":\"" + alices.refreshToken() + "\"}")
                .andExpect(status().isOk());

        refresh(alices.refreshToken()).andExpect(status().isOk());
        assertThat(activeTokens(mallory.getId())).isEqualTo(1);
    }

    @Test
    @DisplayName("Authenticated /logout with the caller's own token ends that session family")
    void authenticatedLogoutRevokesOwnSessionFamily() throws Exception {
        User alice = user("alice@example.com");
        Session first = login(alice);
        Session rotated = rotate(first.refreshToken());

        authenticatedLogout(rotated.accessToken(), "{\"refreshToken\":\"" + first.refreshToken() + "\"}")
                .andExpect(status().isOk());

        refresh(rotated.refreshToken()).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("logoutAll still needs a valid access token and only ends the caller's sessions")
    void logoutAllStaysAuthenticatedAndScoped() throws Exception {
        User alice = user("alice@example.com");
        User bob = user("bob@example.com");
        Session laptop = login(alice);
        Session phone = login(alice);
        Session bobs = login(bob);

        authenticatedLogout(expiredAccessToken(alice), "{\"logoutAll\":true}").andExpect(status().isUnauthorized());
        assertThat(activeTokens(alice.getId())).isEqualTo(2);

        authenticatedLogout(laptop.accessToken(), "{\"logoutAll\":true}").andExpect(status().isOk());

        refresh(laptop.refreshToken()).andExpect(status().isUnauthorized());
        refresh(phone.refreshToken()).andExpect(status().isUnauthorized());
        refresh(bobs.refreshToken()).andExpect(status().isOk());
    }

    @Test
    @DisplayName("revoke has no logout-all mode: extra fields cannot widen it")
    void revokeCannotBeWidenedToLogoutAll() throws Exception {
        User alice = user("alice@example.com");
        Session laptop = login(alice);
        Session phone = login(alice);

        mockMvc.perform(post("/api/v1/auth/revoke").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + laptop.refreshToken() + "\",\"logoutAll\":true,\"userId\":\""
                                + alice.getId() + "\"}"))
                .andExpect(status().isOk());

        refresh(phone.refreshToken()).andExpect(status().isOk());
    }

    // ---- compatibility with password change ------------------------------------------------------

    @Test
    @DisplayName("After a password change every session is gone; a later logout is still neutral")
    void logoutAfterPasswordChangeIsNeutral() throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtTokenService.generateAccessToken(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"brandNewPass456\","
                                + "\"confirmPassword\":\"brandNewPass456\"}"))
                .andExpect(status().isOk());

        revoke(session.refreshToken()).andExpect(status().isOk());
        refresh(session.refreshToken()).andExpect(status().isUnauthorized());
    }

    // ---- secrecy -------------------------------------------------------------------------------

    @Test
    void refreshTokenIsNeverLogged(CapturedOutput output) throws Exception {
        User alice = user("alice@example.com");
        Session session = login(alice);
        revoke(session.refreshToken()).andExpect(status().isOk());
        revoke("unknown-" + session.refreshToken()).andExpect(status().isOk());

        assertThat(output.getAll()).doesNotContain(session.refreshToken());
        assertThat(output.getAll()).contains("event=session_revoked");
    }
}
