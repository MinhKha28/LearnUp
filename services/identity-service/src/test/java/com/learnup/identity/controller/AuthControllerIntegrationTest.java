package com.learnup.identity.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.AuthResponse;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.RefreshTokenRequest;
import com.learnup.identity.dto.RegisterRequest;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
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
}
