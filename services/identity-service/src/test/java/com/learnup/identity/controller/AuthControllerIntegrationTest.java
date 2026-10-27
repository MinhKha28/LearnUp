package com.learnup.identity.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.RefreshTokenRequest;
import com.learnup.identity.dto.RegisterRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.TenantUnavailableException;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";

    @Autowired
    private com.learnup.identity.service.JwtTokenService jwtTokenService;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TenantAccessClient tenantAccessClient;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private com.learnup.identity.repository.LoginThrottleRepository loginThrottleRepository;

    @Autowired
    private com.learnup.identity.repository.PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        loginThrottleRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    private static Stream<Arguments> publicRegistrationAttempts() {
        return Stream.of("/api/v1/auth/register", "/api/auth/register")
                .flatMap(path -> Arrays.stream(UserRole.values()).map(role -> Arguments.of(path, role)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/v3/api-docs", "/v3/api-docs.yaml", "/v3/api-docs/swagger-config", "/swagger-ui.html", "/swagger-ui/index.html"})
    void shouldNotExposeDocumentationByDefault(String path) throws Exception {
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest(name = "{0} cannot create {1} with a caller-chosen Organization")
    @MethodSource("publicRegistrationAttempts")
    void shouldNotExposePublicRegistration(String path, UserRole role) throws Exception {
        RegisterRequest request = new RegisterRequest("attacker", "attacker@example.com",
                "attackerPass123", "Attacker", role, UUID.randomUUID());

        mockMvc.perform(post(path)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist());

        assertThat(userRepository.count()).isZero();
        assertThat(refreshTokenRepository.count()).isZero();
        assertThat(passwordResetTokenRepository.count()).isZero();
        verifyNoInteractions(tenantAccessClient);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth/register", "/api/auth/register"})
    void shouldNotAllowRegistrationWithDefaultRoleOrDuplicateIdentity(String path) throws Exception {
        User existing = createUserFixture("existing_user", "existing@example.com", "existingPass123",
                "Existing User", UserRole.LEARNER, UUID.randomUUID());
        String refreshToken = loginAndGetRefreshToken(existing.getEmail(), "existingPass123");
        String passwordHash = existing.getPasswordHash();
        RegisterRequest request = new RegisterRequest(existing.getUsername(), existing.getEmail(),
                "replacementPass123", "Replacement", null, null);

        mockMvc.perform(post(path)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist());

        assertThat(userRepository.count()).isEqualTo(1);
        assertThat(userRepository.findById(existing.getId()).orElseThrow().getPasswordHash()).isEqualTo(passwordHash);
        assertThat(refreshTokenRepository.count()).isEqualTo(1);
        assertThat(passwordResetTokenRepository.count()).isZero();
        refreshWith(refreshToken).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Should successfully login with valid credentials")
    void shouldLoginSuccessfully() throws Exception {
        User user = createUserFixture("instructor1", "instructor1@learnup.com", "mySecretPass",
                "Instructor A", UserRole.INSTRUCTOR, UUID.randomUUID());

        LoginRequest login = new LoginRequest(user.getEmail(), "mySecretPass");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andExpect(jsonPath("$.data.user.id").value(user.getId().toString()));
        verify(tenantAccessClient).check(user.getId());
    }

    @Test
    @DisplayName("Should reject invalid password or non-existent user with 401 Unauthorized")
    void shouldRejectInvalidLogin() throws Exception {
        LoginRequest invalid = new LoginRequest("non_existent_user", "wrongPass");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Should refresh access token and rotate refresh token")
    void shouldRefreshTokenAndRotate() throws Exception {
        createUserFixture("refresher", "refresher@learnup.com", "pass123456", "Refresher", UserRole.LEARNER, null);
        String initialRefreshToken = loginAndGetRefreshToken("refresher@learnup.com", "pass123456");

        // Refresh token call
        RefreshTokenRequest refreshReq = new RefreshTokenRequest(initialRefreshToken);
        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andReturn();

        // Attempting to reuse old refresh token should be rejected (revoked!)
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("REFRESH_TOKEN_REUSED"));
    }

    @Test
    @DisplayName("Should retrieve current user profile without exposing password or refresh token")
    void shouldGetMeProfile() throws Exception {
        User user = createUserFixture("profileUser", "profile@learnup.com", "pass123456",
                "Profile User", UserRole.ORGANIZER, UUID.randomUUID());

        mockMvc.perform(get("/api/users/me")
                        .with(asGateway(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.data.username").value("profileUser"))
                .andExpect(jsonPath("$.data.email").value("profile@learnup.com"))
                .andExpect(jsonPath("$.data.role").value("ORGANIZER"))
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist());

        // Also verify /api/auth/me works identically
        mockMvc.perform(get("/api/auth/me")
                        .with(asGateway(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("profileUser"));
    }

    @Test
    @DisplayName("Should successfully support /api/v1 route prefix for auth and user operations")
    void shouldSupportV1RoutePrefix() throws Exception {
        User user = createUserFixture("v1user", "v1user@learnup.com", "secret12345",
                "V1 User", UserRole.LEARNER, null);

        // Login via /api/v1/auth/login
        LoginRequest login = new LoginRequest("v1user", "secret12345");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Get me via /api/v1/users/me
        mockMvc.perform(get("/api/v1/users/me")
                        .with(asGateway(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("v1user"));
    }

    @Test
    @DisplayName("Should authenticate all four roles using explicit isolated credential fixtures")
    void shouldLoginAllProvisionedRoles() throws Exception {
        String fixturePassword = "SyntheticRoleFixturePassword123!";
        UUID organizationId = UUID.randomUUID();
        User admin = createUserFixture("admin", "admin@learnup.local", fixturePassword,
                "Test Admin", UserRole.ADMIN, null);
        User organizer = createUserFixture("organizer", "organizer@learnup.local", fixturePassword,
                "Test Organizer", UserRole.ORGANIZER, organizationId);
        User instructor = createUserFixture("instructor", "instructor@learnup.local", fixturePassword,
                "Test Instructor", UserRole.INSTRUCTOR, organizationId);
        User learner = createUserFixture("learner", "learner@learnup.local", fixturePassword,
                "Test Learner", UserRole.LEARNER, organizationId);

        assertThat(admin.getUsername()).isEqualTo("admin");
        assertThat(admin.getEmail()).isEqualTo("admin@learnup.local");
        assertThat(admin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(admin.getOrganizationId()).isNull();

        assertThat(organizer.getUsername()).isEqualTo("organizer");
        assertThat(organizer.getEmail()).isEqualTo("organizer@learnup.local");
        assertThat(organizer.getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(organizer.getOrganizationId()).isEqualTo(organizationId);

        assertThat(instructor.getUsername()).isEqualTo("instructor");
        assertThat(instructor.getEmail()).isEqualTo("instructor@learnup.local");
        assertThat(instructor.getRole()).isEqualTo(UserRole.INSTRUCTOR);
        assertThat(instructor.getOrganizationId()).isEqualTo(organizationId);

        assertThat(learner.getUsername()).isEqualTo("learner");
        assertThat(learner.getEmail()).isEqualTo("learner@learnup.local");
        assertThat(learner.getRole()).isEqualTo(UserRole.LEARNER);
        assertThat(learner.getOrganizationId()).isEqualTo(organizationId);

        // Tenant access is mocked in this isolated test; these fixtures are not deployment accounts.
        String[] demoEmails = {"admin@learnup.local", "organizer@learnup.local", "instructor@learnup.local", "learner@learnup.local"};
        UserRole[] demoRoles = {UserRole.ADMIN, UserRole.ORGANIZER, UserRole.INSTRUCTOR, UserRole.LEARNER};

        for (int i = 0; i < demoEmails.length; i++) {
            String email = demoEmails[i];
            UserRole expectedRole = demoRoles[i];

            LoginRequest loginReq = new LoginRequest(email, fixturePassword);
            MvcResult loginRes = mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.accessToken").isString())
                    .andExpect(jsonPath("$.data.refreshToken").isString())
                    .andExpect(jsonPath("$.data.user.email").value(email))
                    .andExpect(jsonPath("$.data.user.role").value(expectedRole.name()))
                    .andReturn();

            String token = objectMapper.readTree(loginRes.getResponse().getContentAsString())
                    .path("data").path("accessToken").asText();

            // 3. Verify /api/v1/auth/me returns user for the authenticated session
            User userObj = userRepository.findByEmail(email).orElseThrow();
            mockMvc.perform(get("/api/v1/auth/me")
                            .with(asGateway(userObj)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.email").value(email));
        }

        // 4. Verify invalid password rejected
        LoginRequest badPass = new LoginRequest("admin@learnup.local", "WrongPassword999");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badPass)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("UC06: Should successfully logout and revoke refresh token")
    void shouldLogoutAndRevokeRefreshToken() throws Exception {
        User user = createUserFixture("logoutUser", "logout@learnup.com", "pass123456", "Logout User", UserRole.LEARNER, null);
        String refreshToken = loginAndGetRefreshToken("logout@learnup.com", "pass123456");
        assertThat(refreshToken).isNotBlank();

        // Perform logout
        com.learnup.identity.dto.LogoutRequest logoutRequest = new com.learnup.identity.dto.LogoutRequest(refreshToken);
        mockMvc.perform(post("/api/v1/auth/logout")
                        .with(asGateway(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(logoutRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Subsequent refresh token request with revoked token must fail with 401
        RefreshTokenRequest refreshReq = new RefreshTokenRequest(refreshToken);
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("UC08: Should change password and invalidate old password and sessions")
    void shouldChangePasswordAndInvalidateOldPassword() throws Exception {
        User user = createUserFixture("changePassUser", "changepass@learnup.com", "initialPass123",
                "Change Pass User", UserRole.INSTRUCTOR, null);
        String originalRefreshToken = loginAndGetRefreshToken(user.getEmail(), "initialPass123");

        // 1. Wrong current password -> 400 BAD_REQUEST
        com.learnup.identity.dto.ChangePasswordRequest wrongCurrent = new com.learnup.identity.dto.ChangePasswordRequest(
                "incorrectPassword", "newSecurePassword123", "newSecurePassword123"
        );
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(asGateway(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongCurrent)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // 2. Mismatched confirm password -> 400 BAD_REQUEST
        com.learnup.identity.dto.ChangePasswordRequest mismatch = new com.learnup.identity.dto.ChangePasswordRequest(
                "initialPass123", "newSecurePassword123", "differentPassword123"
        );
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(asGateway(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mismatch)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // 3. Valid change password -> 200 OK
        com.learnup.identity.dto.ChangePasswordRequest validChange = new com.learnup.identity.dto.ChangePasswordRequest(
                "initialPass123", "newSecurePassword123", "newSecurePassword123"
        );
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(asGateway(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validChange)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        refreshWith(originalRefreshToken).andExpect(status().isUnauthorized());

        // 4. Old password rejected at login
        LoginRequest oldLogin = new LoginRequest("changepass@learnup.com", "initialPass123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oldLogin)))
                .andExpect(status().isUnauthorized());

        // 5. New password accepted at login
        LoginRequest newLogin = new LoginRequest("changepass@learnup.com", "newSecurePassword123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("UC07: Should handle forgot password and reset password flow")
    void shouldHandleForgotPasswordAndResetPasswordFlow() throws Exception {
        User user = createUserFixture("forgotUser", "forgot@learnup.com", "oldPassword123",
                "Forgot User", UserRole.LEARNER, null);
        String originalRefreshToken = loginAndGetRefreshToken(user.getEmail(), "oldPassword123");

        // 1. Request forgot password
        com.learnup.identity.dto.ForgotPasswordRequest forgotReq = new com.learnup.identity.dto.ForgotPasswordRequest("forgot@learnup.com");
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgotReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verify token generated in database
        assertThat(passwordResetTokenRepository.count()).isEqualTo(1);

        // 2. Set up known raw token for reset verification
        String rawResetToken = "known-reset-token-" + UUID.randomUUID();
        java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
        String tokenHash = java.util.HexFormat.of().formatHex(digest.digest(rawResetToken.getBytes(java.nio.charset.StandardCharsets.UTF_8)));

        com.learnup.identity.domain.PasswordResetToken manualToken = new com.learnup.identity.domain.PasswordResetToken();
        manualToken.setId(UUID.randomUUID());
        manualToken.setUserId(user.getId());
        manualToken.setTokenHash(tokenHash);
        manualToken.setExpiresAt(java.time.Instant.now().plusSeconds(900));
        passwordResetTokenRepository.save(manualToken);

        // 3. Reset password with valid token
        com.learnup.identity.dto.ResetPasswordRequest resetReq = new com.learnup.identity.dto.ResetPasswordRequest(
                rawResetToken, "brandNewPassword123", "brandNewPassword123"
        );
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        refreshWith(originalRefreshToken).andExpect(status().isUnauthorized());

        // 4. Verify user can login with new password
        LoginRequest resetLogin = new LoginRequest("forgot@learnup.com", "brandNewPassword123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // 5. Reusing the same reset token must be rejected
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"ORGANIZER", "INSTRUCTOR", "LEARNER"})
    @DisplayName("Internal API: Should set credentials via POST /api/internal/credentials with valid x-internal-key")
    void shouldSetCredentialsViaInternalApiWithValidKey(UserRole role) throws Exception {
        UUID newUserId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        com.learnup.identity.dto.internal.SetCredentialsRequest request =
                new com.learnup.identity.dto.internal.SetCredentialsRequest(newUserId, "provisionedPass123");
        request.setEmail("provisioned@abc.vn");
        request.setFullName("Provisioned User");
        request.setRole(role);
        request.setOrganizationId(organizationId);

        // Call internal API with valid internal key
        mockMvc.perform(post("/api/internal/credentials")
                        .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist());

        // Match Tenant's payload (no username), retaining its canonical ID and metadata.
        User provisioned = userRepository.findById(newUserId).orElseThrow();
        assertThat(provisioned.getUsername()).isEqualTo("user_" + newUserId).hasSize(41);
        assertThat(provisioned.getEmail()).isEqualTo(request.getEmail());
        assertThat(provisioned.getRole()).isEqualTo(role);
        assertThat(provisioned.getOrganizationId()).isEqualTo(organizationId);
        assertThat(provisioned.getFullName()).isEqualTo("Provisioned User");
        assertThat(provisioned.getPasswordHash()).startsWith("$2a$").isNotEqualTo(request.getPassword());
        assertThat(passwordEncoder.matches(request.getPassword(), provisioned.getPasswordHash())).isTrue();
        assertThat(refreshTokenRepository.count()).isZero();

        // Verify user can now login
        LoginRequest loginReq = new LoginRequest("provisioned@abc.vn", "provisionedPass123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andExpect(jsonPath("$.data.user.id").value(newUserId.toString()))
                .andExpect(jsonPath("$.data.user.role").value(role.name()))
                .andExpect(jsonPath("$.data.user.organizationId").value(organizationId.toString()));
        verify(tenantAccessClient).check(newUserId);
    }

    @Test
    @DisplayName("Internal API: Should reject POST /api/internal/credentials without valid x-internal-key with 403 Forbidden")
    void shouldRejectInternalApiWithoutValidKey() throws Exception {
        UUID newUserId = UUID.randomUUID();
        com.learnup.identity.dto.internal.SetCredentialsRequest request =
                new com.learnup.identity.dto.internal.SetCredentialsRequest(newUserId, "somePass123");

        // Missing key
        mockMvc.perform(post("/api/internal/credentials")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        // Wrong key
        mockMvc.perform(post("/api/internal/credentials")
                        .header(HeaderConstants.X_INTERNAL_KEY, "wrong-fake-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    private User createUserFixture(String username, String email, String password, String fullName,
                                   UserRole role, UUID organizationId) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setFullName(fullName);
        user.setRole(role);
        user.setOrganizationId(organizationId);
        user.setEnabled(true);
        return userRepository.saveAndFlush(user);
    }

    private String createUserAndGetRefreshToken(String username, String password) throws Exception {
        createUserFixture(username, username + "@learnup.com", password, "Member", UserRole.LEARNER, UUID.randomUUID());
        return loginAndGetRefreshToken(username, password);
    }

    private String loginAndGetRefreshToken(String identifier, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(identifier, password))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("refreshToken").asText();
    }

    @Test
    @DisplayName("BR-27: Should reject sign-in with 403 and the tenant reason when the account is deactivated")
    void shouldRejectSignInWhenTenantDeniesAccess() throws Exception {
        createUserAndGetRefreshToken("deactivated_member", "memberPass123");
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(false, null, "ACCOUNT_DEACTIVATED"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("deactivated_member", "memberPass123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("ACCOUNT_DEACTIVATED"));
    }

    @Test
    @DisplayName("BR-27: Should answer like a wrong password when the account does not exist in tenant-service")
    void shouldHideAccountNotFoundAsInvalidCredentials() throws Exception {
        createUserAndGetRefreshToken("orphan_member", "memberPass123");
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(false, null, "ACCOUNT_NOT_FOUND"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("orphan_member", "memberPass123"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("BR-27: Should fail closed with 503 when tenant-service is unavailable")
    void shouldFailClosedWhenTenantUnavailable() throws Exception {
        createUserAndGetRefreshToken("offline_member", "memberPass123");
        when(tenantAccessClient.check(any())).thenThrow(new TenantUnavailableException(null));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("offline_member", "memberPass123"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("TENANT_UNAVAILABLE"));
    }

    @Test
    @DisplayName("BR-27: Should reject refresh and revoke every session when the subscription is suspended")
    void shouldRejectRefreshAndRevokeSessionsWhenDenied() throws Exception {
        String refreshToken = createUserAndGetRefreshToken("suspended_member", "memberPass123");
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(false, null, "SUBSCRIPTION_SUSPENDED"));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshTokenRequest(refreshToken))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("SUBSCRIPTION_SUSPENDED"));

        UUID userId = userRepository.findByUsername("suspended_member").orElseThrow().getId();
        assertThat(refreshTokenRepository.findAll()).noneMatch(token -> token.getUserId().equals(userId));
    }

    @Test
    @DisplayName("Internal API: Should hand an email over from stale credentials to a new userId (re-registration)")
    void shouldReassignEmailFromStaleUserOnReRegistration() throws Exception {
        UUID oldUserId = UUID.randomUUID();
        UUID newUserId = UUID.randomUUID();

        when(tenantAccessClient.exists(oldUserId)).thenReturn(false);

        for (UUID id : new UUID[] {oldUserId, newUserId}) {
            com.learnup.identity.dto.internal.SetCredentialsRequest request =
                    new com.learnup.identity.dto.internal.SetCredentialsRequest(id, "reRegisterPass123");
            request.setEmail("re-register@abc.vn");
            request.setRole(UserRole.ORGANIZER);

            mockMvc.perform(post("/api/internal/credentials")
                            .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }

        assertThat(userRepository.findById(oldUserId)).isPresent().get().satisfies(old -> {
            assertThat(old.getEmail()).isNull();
            assertThat(old.getUsername()).isEqualTo("user_" + oldUserId);
            assertThat(passwordEncoder.matches("reRegisterPass123", old.getPasswordHash())).isTrue();
        });
        assertThat(userRepository.count()).isEqualTo(2);
        verify(tenantAccessClient).exists(oldUserId);

        LoginRequest loginReq = new LoginRequest("re-register@abc.vn", "reRegisterPass123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.id").value(newUserId.toString()))
                .andExpect(jsonPath("$.data.user.role").value(UserRole.ORGANIZER.name()));
    }

    private void attemptLogin(String username, String password, org.springframework.test.web.servlet.ResultMatcher expected) throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(username, password))))
                .andExpect(expected);
    }

    @Test
    @DisplayName("UC05: Should lock sign-in after 5 failed attempts, even when the next password is correct")
    void shouldLockSignInAfterRepeatedFailures() throws Exception {
        createUserAndGetRefreshToken("guessed_member", "memberPass123");

        for (int attempt = 0; attempt < 5; attempt++) {
            attemptLogin("guessed_member", "wrongPass" + attempt, status().isUnauthorized());
        }

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("guessed_member", "memberPass123"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("TOO_MANY_ATTEMPTS"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().exists("Retry-After"));
    }

    @Test
    @DisplayName("UC05: Should lock unknown emails the same way so account existence is not revealed")
    void shouldLockUnknownEmailTheSameWay() throws Exception {
        for (int attempt = 0; attempt < 5; attempt++) {
            attemptLogin("nobody@learnup.com", "anyPass" + attempt, status().isUnauthorized());
        }
        attemptLogin("nobody@learnup.com", "anyPass", status().isTooManyRequests());
    }

    @Test
    @DisplayName("UC05: Should reset the failure counter after a successful sign-in")
    void shouldResetFailuresAfterSuccessfulSignIn() throws Exception {
        createUserAndGetRefreshToken("careful_member", "memberPass123");

        for (int attempt = 0; attempt < 4; attempt++) {
            attemptLogin("careful_member", "wrongPass" + attempt, status().isUnauthorized());
        }
        attemptLogin("careful_member", "memberPass123", status().isOk());

        for (int attempt = 0; attempt < 4; attempt++) {
            attemptLogin("careful_member", "wrongPass" + attempt, status().isUnauthorized());
        }
        attemptLogin("careful_member", "memberPass123", status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions refreshWith(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RefreshTokenRequest(refreshToken))));
    }

    @Test
    @DisplayName("UC05: Should detect reuse of a rotated refresh token and revoke the whole sign-in family")
    void shouldRevokeFamilyWhenRotatedRefreshTokenIsReused() throws Exception {
        String firstToken = createUserAndGetRefreshToken("reused_member", "memberPass123");

        MvcResult rotated = refreshWith(firstToken).andExpect(status().isOk()).andReturn();
        String secondToken = objectMapper.readTree(rotated.getResponse().getContentAsString())
                .path("data").path("refreshToken").asText();

        refreshWith(firstToken)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("REFRESH_TOKEN_REUSED"));

        refreshWith(secondToken)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("UC05: Should keep rotating normally while each refresh token is used once")
    void shouldRotateRefreshTokensInTheSameFamily() throws Exception {
        String token = createUserAndGetRefreshToken("rotating_member", "memberPass123");

        for (int round = 0; round < 3; round++) {
            MvcResult result = refreshWith(token).andExpect(status().isOk()).andReturn();
            token = objectMapper.readTree(result.getResponse().getContentAsString())
                    .path("data").path("refreshToken").asText();
        }

        assertThat(refreshTokenRepository.findAll())
                .extracting(com.learnup.identity.domain.RefreshToken::getFamilyId)
                .containsOnly(refreshTokenRepository.findAll().get(0).getFamilyId());
    }

    @Test
    @DisplayName("UC06: Should treat a refresh token revoked by sign-out as invalid, not as reuse")
    void shouldNotFlagSignedOutTokenAsReuse() throws Exception {
        String token = createUserAndGetRefreshToken("signed_out_member", "memberPass123");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .with(asGateway(userRepository.findByUsername("signed_out_member").orElseThrow()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new com.learnup.identity.dto.LogoutRequest(token))))
                .andExpect(status().isOk());

        refreshWith(token)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    private static Stream<Arguments> protectedRequests() {
        return Stream.of("/api/v1", "/api").flatMap(prefix -> Stream.of(
                Arguments.of("GET", prefix + "/auth/me"), Arguments.of("GET", prefix + "/users/me"),
                Arguments.of("POST", prefix + "/auth/logout"), Arguments.of("POST", prefix + "/auth/change-password")));
    }

    @ParameterizedTest
    @MethodSource("protectedRequests")
    void shouldRejectDirectAndSpoofedUserRequests(String method, String path) throws Exception {
        User victim = createUserFixture("victim", "victim@example.com", "currentPass123",
                "Victim", UserRole.LEARNER, UUID.randomUUID());
        String refresh = loginAndGetRefreshToken(victim.getEmail(), "currentPass123");
        String bearer = "Bearer " + jwtTokenService.generateAccessToken(victim);
        String body = path.endsWith("logout") ? "{\"logoutAll\":true}" :
                "{\"currentPassword\":\"currentPass123\",\"newPassword\":\"attackerPass123\",\"confirmPassword\":\"attackerPass123\"}";

        mockMvc.perform(request(HttpMethod.valueOf(method), path).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(spoofedRequest(method, path, victim).content(body))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(spoofedRequest(method, path, victim).content(body).header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isUnauthorized());
        for (String invalidKey : new String[] {"wrong-private-key", "learnup-internal-secret"}) {
            mockMvc.perform(spoofedRequest(method, path, victim).content(body)
                            .header(HttpHeaders.AUTHORIZATION, bearer).header(HeaderConstants.X_INTERNAL_KEY, invalidKey))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(spoofedRequest(method, path, victim).content(body)
                        .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY))
                .andExpect(status().isUnauthorized());

        assertThat(userRepository.findById(victim.getId()).orElseThrow().getPasswordHash()).isEqualTo(victim.getPasswordHash());
        assertThat(refreshTokenRepository.count()).isEqualTo(1);
        refreshWith(refresh).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth/me", "/api/auth/me", "/api/v1/users/me", "/api/users/me"})
    void shouldUseVerifiedJwtSubjectInsteadOfForwardedIdentity(String path) throws Exception {
        User caller = createUserFixture("caller", "caller@example.com", "callerPass123", "Caller",
                UserRole.LEARNER, UUID.randomUUID());
        User victim = createUserFixture("victim", "victim@example.com", "victimPass123", "Victim",
                UserRole.ORGANIZER, UUID.randomUUID());

        mockMvc.perform(spoofedRequest("GET", path, victim).with(asGateway(caller)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(caller.getId().toString()))
                .andExpect(jsonPath("$.data.role").value(caller.getRole().name()))
                .andExpect(jsonPath("$.data.organizationId").value(caller.getOrganizationId().toString()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1", "/api"})
    void shouldBindLogoutAllToVerifiedSubject(String prefix) throws Exception {
        User caller = createUserFixture("caller", "caller@example.com", "callerPass123", "Caller",
                UserRole.LEARNER, UUID.randomUUID());
        User victim = createUserFixture("victim", "victim@example.com", "victimPass123", "Victim",
                UserRole.LEARNER, UUID.randomUUID());
        String callerRefresh = loginAndGetRefreshToken(caller.getEmail(), "callerPass123");
        String victimRefresh = loginAndGetRefreshToken(victim.getEmail(), "victimPass123");

        mockMvc.perform(spoofedRequest("POST", prefix + "/auth/logout", victim)
                        .with(asGateway(caller)).content("{\"logoutAll\":true}"))
                .andExpect(status().isOk());

        assertThat(refreshTokenRepository.findAll()).allMatch(token -> token.getUserId().equals(victim.getId()));
        refreshWith(callerRefresh).andExpect(status().isUnauthorized());
        refreshWith(victimRefresh).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1", "/api"})
    void shouldBindPasswordChangeToVerifiedSubject(String prefix) throws Exception {
        // Knowing the same current password must still not allow selecting another subject through headers.
        User caller = createUserFixture("caller", "caller@example.com", "sharedOldPass123", "Caller",
                UserRole.LEARNER, UUID.randomUUID());
        User victim = createUserFixture("victim", "victim@example.com", "sharedOldPass123", "Victim",
                UserRole.LEARNER, UUID.randomUUID());

        mockMvc.perform(spoofedRequest("POST", prefix + "/auth/change-password", victim).with(asGateway(caller))
                        .content("{\"currentPassword\":\"sharedOldPass123\",\"newPassword\":\"newCallerPass123\",\"confirmPassword\":\"newCallerPass123\"}"))
                .andExpect(status().isOk());

        assertThat(passwordEncoder.matches("newCallerPass123",
                userRepository.findById(caller.getId()).orElseThrow().getPasswordHash())).isTrue();
        assertThat(userRepository.findById(victim.getId()).orElseThrow().getPasswordHash()).isEqualTo(victim.getPasswordHash());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1", "/api"})
    void shouldKeepPublicAuthenticationAliasesUsableWithUntrustedHeaders(String prefix) throws Exception {
        User user = createUserFixture("public_user", "public@example.com", "currentPass123", "Public User",
                UserRole.LEARNER, UUID.randomUUID());
        MvcResult login = mockMvc.perform(spoofedRequest("POST", prefix + "/auth/login", user)
                        .content(objectMapper.writeValueAsString(new LoginRequest(user.getEmail(), "currentPass123"))))
                .andExpect(status().isOk()).andReturn();
        String refresh = objectMapper.readTree(login.getResponse().getContentAsString()).path("data").path("refreshToken").asText();
        mockMvc.perform(spoofedRequest("POST", prefix + "/auth/refresh", user)
                        .content(objectMapper.writeValueAsString(new RefreshTokenRequest(refresh))))
                .andExpect(status().isOk());
        mockMvc.perform(spoofedRequest("POST", prefix + "/auth/forgot-password", user)
                        .content("{\"email\":\"public@example.com\"}"))
                .andExpect(status().isOk());

        String rawReset = "test-reset-" + UUID.randomUUID();
        var resetToken = new com.learnup.identity.domain.PasswordResetToken();
        resetToken.setUserId(user.getId());
        resetToken.setTokenHash(java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(rawReset.getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        resetToken.setExpiresAt(java.time.Instant.now().plusSeconds(900));
        passwordResetTokenRepository.save(resetToken);
        mockMvc.perform(spoofedRequest("POST", prefix + "/auth/reset-password", user)
                        .content(objectMapper.writeValueAsString(new com.learnup.identity.dto.ResetPasswordRequest(
                                rawReset, "newPublicPass123", "newPublicPass123"))))
                .andExpect(status().isOk());
        loginAndGetRefreshToken(user.getEmail(), "newPublicPass123");
    }

    @ParameterizedTest
    @ValueSource(strings = {"learnup-internal-secret", "wrong-internal-key"})
    void shouldRejectUntrustedCredentialProvisioning(String key) throws Exception {
        var credentials = new com.learnup.identity.dto.internal.SetCredentialsRequest(UUID.randomUUID(), "provisionedPass123");
        mockMvc.perform(post("/api/internal/credentials").header(HeaderConstants.X_INTERNAL_KEY, key)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isForbidden());
        assertThat(userRepository.count()).isZero();
        assertThat(refreshTokenRepository.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth/logout", "/api/auth/logout"})
    void shouldKeepExpiredAccessLogoutProtected(String path) throws Exception {
        User user = createUserFixture("expired_user", "expired@example.com", "currentPass123", "Expired User",
                UserRole.LEARNER, UUID.randomUUID());
        String refresh = loginAndGetRefreshToken(user.getEmail(), "currentPass123");
        var expiredConfig = new com.learnup.identity.config.JwtConfig();
        expiredConfig.setSecret("testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!");
        expiredConfig.setAccessTokenExpirationMinutes(-1);
        String expiredAccess = new com.learnup.identity.service.JwtTokenService(expiredConfig).generateAccessToken(user);

        mockMvc.perform(post(path).header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredAccess)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"logoutAll\":true}"))
                .andExpect(status().isUnauthorized());
        // ID-S1 is separate: an expired access token must not silently authorize logout-all here.
        refreshWith(refresh).andExpect(status().isOk());
    }

    private MockHttpServletRequestBuilder spoofedRequest(String method, String path, User victim) {
        return request(HttpMethod.valueOf(method), path).contentType(MediaType.APPLICATION_JSON)
                .header(HeaderConstants.X_USER_ID, victim.getId().toString())
                .header(HeaderConstants.X_USER_ROLE, "ADMIN")
                .header(HeaderConstants.X_ORGANIZATION_ID, UUID.randomUUID().toString());
    }

    private RequestPostProcessor asGateway(User user) {
        // Real signed access token and channel credential, not a mocked Spring principal.
        return request -> {
            request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + jwtTokenService.generateAccessToken(user));
            request.addHeader(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY);
            return request;
        };
    }
}
