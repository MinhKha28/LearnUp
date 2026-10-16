package com.learnup.identity.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.AuthResponse;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

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
    private com.learnup.identity.config.DevAccountSeeder devAccountSeeder;

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

    @Test
    @DisplayName("Should successfully register a new learner and store BCrypt password hash")
    void shouldRegisterNewUser() throws Exception {
        UUID orgId = UUID.randomUUID();
        RegisterRequest request = new RegisterRequest(
                "learner1",
                "learner1@learnup.com",
                "securePassword123",
                "Nguyen Van Learner",
                UserRole.LEARNER,
                orgId
        );

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andReturn();

        // Verify password was hashed and plaintext is never in DB
        User userInDb = userRepository.findByUsername("learner1").orElseThrow();
        assertThat(userInDb.getPasswordHash()).startsWith("$2a$");
        assertThat(userInDb.getPasswordHash()).isNotEqualTo("securePassword123");
        assertThat(userInDb.getEmail()).isEqualTo("learner1@learnup.com");
        assertThat(userInDb.getRole()).isEqualTo(UserRole.LEARNER);
        assertThat(userInDb.getOrganizationId()).isEqualTo(orgId);
    }

    @Test
    @DisplayName("Should reject registration with duplicate username or email with 409 Conflict")
    void shouldRejectDuplicateRegistration() throws Exception {
        RegisterRequest first = new RegisterRequest("john_doe", "john@example.com", "pass123", "John Doe", UserRole.LEARNER, null);
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(first)))
                .andExpect(status().isCreated());

        // Duplicate username
        RegisterRequest dupUsername = new RegisterRequest("john_doe", "other@example.com", "pass123", "Other", UserRole.LEARNER, null);
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dupUsername)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        // Duplicate email
        RegisterRequest dupEmail = new RegisterRequest("other_user", "john@example.com", "pass123", "Other", UserRole.LEARNER, null);
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dupEmail)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    @DisplayName("Should reject self-registration as platform ADMIN with 403 Forbidden")
    void shouldRejectAdminSelfRegistration() throws Exception {
        RegisterRequest adminRequest = new RegisterRequest(
                "malicious_admin",
                "hacker@example.com",
                "hackerPass123",
                "Attacker",
                UserRole.ADMIN,
                null
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Should successfully login with valid credentials")
    void shouldLoginSuccessfully() throws Exception {
        RegisterRequest register = new RegisterRequest("instructor1", "instructor1@learnup.com", "mySecretPass", "Instructor A", UserRole.INSTRUCTOR, null);
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        LoginRequest login = new LoginRequest("instructor1", "mySecretPass");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString());
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
        RegisterRequest register = new RegisterRequest("refresher", "refresher@learnup.com", "pass123456", "Refresher", UserRole.LEARNER, null);
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated())
                .andReturn();

        String rawResponse = registerResult.getResponse().getContentAsString();
        AuthResponse authData = objectMapper.readTree(rawResponse).get("data").traverse(objectMapper).readValueAs(AuthResponse.class);
        String initialRefreshToken = authData.getRefreshToken();

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
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Should retrieve current user profile without exposing password or refresh token")
    void shouldGetMeProfile() throws Exception {
        RegisterRequest register = new RegisterRequest("profileUser", "profile@learnup.com", "pass123456", "Profile User", UserRole.ORGANIZER, UUID.randomUUID());
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        User user = userRepository.findByUsername("profileUser").orElseThrow();

        mockMvc.perform(get("/api/users/me")
                        .header(HeaderConstants.X_USER_ID, user.getId().toString())
                        .header(HeaderConstants.X_USER_ROLE, user.getRole().name()))
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
                        .header(HeaderConstants.X_USER_ID, user.getId().toString())
                        .header(HeaderConstants.X_USER_ROLE, user.getRole().name()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("profileUser"));
    }

    @Test
    @DisplayName("Should successfully support /api/v1 route prefix for auth and user operations")
    void shouldSupportV1RoutePrefix() throws Exception {
        RegisterRequest register = new RegisterRequest(
                "v1user",
                "v1user@learnup.com",
                "secret12345",
                "V1 User",
                UserRole.LEARNER,
                null
        );

        // Register via /api/v1/auth/register
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString());

        // Login via /api/v1/auth/login
        LoginRequest login = new LoginRequest("v1user", "secret12345");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        User user = userRepository.findByUsername("v1user").orElseThrow();

        // Get me via /api/v1/users/me
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HeaderConstants.X_USER_ID, user.getId().toString())
                        .header(HeaderConstants.X_USER_ROLE, user.getRole().name()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("v1user"));
    }

    @Test
    @DisplayName("Should successfully seed and authenticate all canonical demo accounts (ADMIN, ORGANIZER, INSTRUCTOR, LEARNER)")
    void shouldSeedAndLoginAllDevAccounts() throws Exception {
        // Run seed
        devAccountSeeder.seedAccounts();

        // 1. Verify records exist in database with correct tenant IDs
        User admin = userRepository.findById(com.learnup.identity.config.DevAccountSeeder.ADMIN_ID).orElseThrow();
        assertThat(admin.getUsername()).isEqualTo("admin");
        assertThat(admin.getEmail()).isEqualTo("admin@learnup.local");
        assertThat(admin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(admin.getOrganizationId()).isNull();

        User organizer = userRepository.findById(com.learnup.identity.config.DevAccountSeeder.ORGANIZER_ID).orElseThrow();
        assertThat(organizer.getUsername()).isEqualTo("organizer");
        assertThat(organizer.getEmail()).isEqualTo("organizer@learnup.local");
        assertThat(organizer.getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(organizer.getOrganizationId()).isEqualTo(com.learnup.identity.config.DevAccountSeeder.DEMO_ORG_ID);

        User instructor = userRepository.findById(com.learnup.identity.config.DevAccountSeeder.INSTRUCTOR_ID).orElseThrow();
        assertThat(instructor.getUsername()).isEqualTo("instructor");
        assertThat(instructor.getEmail()).isEqualTo("instructor@learnup.local");
        assertThat(instructor.getRole()).isEqualTo(UserRole.INSTRUCTOR);
        assertThat(instructor.getOrganizationId()).isEqualTo(com.learnup.identity.config.DevAccountSeeder.DEMO_ORG_ID);

        User learner = userRepository.findById(com.learnup.identity.config.DevAccountSeeder.LEARNER_ID).orElseThrow();
        assertThat(learner.getUsername()).isEqualTo("learner");
        assertThat(learner.getEmail()).isEqualTo("learner@learnup.local");
        assertThat(learner.getRole()).isEqualTo(UserRole.LEARNER);
        assertThat(learner.getOrganizationId()).isEqualTo(com.learnup.identity.config.DevAccountSeeder.DEMO_ORG_ID);

        // 2. Verify all 4 accounts can login using default password "LearnUp@123" by email
        String[] demoEmails = {"admin@learnup.local", "organizer@learnup.local", "instructor@learnup.local", "learner@learnup.local"};
        UserRole[] demoRoles = {UserRole.ADMIN, UserRole.ORGANIZER, UserRole.INSTRUCTOR, UserRole.LEARNER};

        for (int i = 0; i < demoEmails.length; i++) {
            String email = demoEmails[i];
            UserRole expectedRole = demoRoles[i];

            LoginRequest loginReq = new LoginRequest(email, "LearnUp@123");
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
                            .header(HeaderConstants.X_USER_ID, userObj.getId().toString())
                            .header(HeaderConstants.X_USER_ROLE, expectedRole.name()))
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
        RegisterRequest register = new RegisterRequest("logoutUser", "logout@learnup.com", "pass123456", "Logout User", UserRole.LEARNER, null);
        MvcResult regRes = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated())
                .andReturn();

        String rawResponse = regRes.getResponse().getContentAsString();
        String refreshToken = objectMapper.readTree(rawResponse).path("data").path("refreshToken").asText();
        assertThat(refreshToken).isNotBlank();

        // Perform logout
        com.learnup.identity.dto.LogoutRequest logoutRequest = new com.learnup.identity.dto.LogoutRequest(refreshToken);
        mockMvc.perform(post("/api/v1/auth/logout")
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
        RegisterRequest register = new RegisterRequest("changePassUser", "changepass@learnup.com", "initialPass123", "Change Pass User", UserRole.INSTRUCTOR, null);
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        User user = userRepository.findByUsername("changePassUser").orElseThrow();

        // 1. Wrong current password -> 400 BAD_REQUEST
        com.learnup.identity.dto.ChangePasswordRequest wrongCurrent = new com.learnup.identity.dto.ChangePasswordRequest(
                "incorrectPassword", "newSecurePassword123", "newSecurePassword123"
        );
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header(HeaderConstants.X_USER_ID, user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongCurrent)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // 2. Mismatched confirm password -> 400 BAD_REQUEST
        com.learnup.identity.dto.ChangePasswordRequest mismatch = new com.learnup.identity.dto.ChangePasswordRequest(
                "initialPass123", "newSecurePassword123", "differentPassword123"
        );
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header(HeaderConstants.X_USER_ID, user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mismatch)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // 3. Valid change password -> 200 OK
        com.learnup.identity.dto.ChangePasswordRequest validChange = new com.learnup.identity.dto.ChangePasswordRequest(
                "initialPass123", "newSecurePassword123", "newSecurePassword123"
        );
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header(HeaderConstants.X_USER_ID, user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validChange)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

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
        RegisterRequest register = new RegisterRequest("forgotUser", "forgot@learnup.com", "oldPassword123", "Forgot User", UserRole.LEARNER, null);
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        User user = userRepository.findByEmail("forgot@learnup.com").orElseThrow();

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

    @Test
    @DisplayName("Internal API: Should set credentials via POST /api/internal/credentials with valid x-internal-key")
    void shouldSetCredentialsViaInternalApiWithValidKey() throws Exception {
        UUID newUserId = UUID.randomUUID();
        com.learnup.identity.dto.internal.SetCredentialsRequest request =
                new com.learnup.identity.dto.internal.SetCredentialsRequest(newUserId, "provisionedPass123");
        request.setEmail("provisioned@abc.vn");
        request.setUsername("provisioned_user");
        request.setRole(UserRole.INSTRUCTOR);

        // Call internal API with valid internal key
        mockMvc.perform(post("/api/internal/credentials")
                        .header(HeaderConstants.X_INTERNAL_KEY, "test-internal-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verify user can now login
        LoginRequest loginReq = new LoginRequest("provisioned@abc.vn", "provisionedPass123");
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.user.id").value(newUserId.toString()))
                .andExpect(jsonPath("$.data.user.role").value(UserRole.INSTRUCTOR.name()));
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

    private String registerAndGetRefreshToken(String username, String password) throws Exception {
        RegisterRequest register = new RegisterRequest(username, username + "@learnup.com", password, "Member", UserRole.LEARNER, UUID.randomUUID());
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("refreshToken").asText();
    }

    @Test
    @DisplayName("BR-27: Should reject sign-in with 403 and the tenant reason when the account is deactivated")
    void shouldRejectSignInWhenTenantDeniesAccess() throws Exception {
        registerAndGetRefreshToken("deactivated_member", "memberPass123");
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
        registerAndGetRefreshToken("orphan_member", "memberPass123");
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
        registerAndGetRefreshToken("offline_member", "memberPass123");
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
        String refreshToken = registerAndGetRefreshToken("suspended_member", "memberPass123");
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

        for (UUID id : new UUID[] {oldUserId, newUserId}) {
            com.learnup.identity.dto.internal.SetCredentialsRequest request =
                    new com.learnup.identity.dto.internal.SetCredentialsRequest(id, "reRegisterPass123");
            request.setEmail("re-register@abc.vn");
            request.setRole(UserRole.ORGANIZER);

            mockMvc.perform(post("/api/internal/credentials")
                            .header(HeaderConstants.X_INTERNAL_KEY, "test-internal-secret")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }

        assertThat(userRepository.findById(oldUserId)).isEmpty();

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
        registerAndGetRefreshToken("guessed_member", "memberPass123");

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
        registerAndGetRefreshToken("careful_member", "memberPass123");

        for (int attempt = 0; attempt < 4; attempt++) {
            attemptLogin("careful_member", "wrongPass" + attempt, status().isUnauthorized());
        }
        attemptLogin("careful_member", "memberPass123", status().isOk());

        for (int attempt = 0; attempt < 4; attempt++) {
            attemptLogin("careful_member", "wrongPass" + attempt, status().isUnauthorized());
        }
        attemptLogin("careful_member", "memberPass123", status().isOk());
    }
}
