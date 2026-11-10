package com.learnup.identity.controller;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.TenantUnavailableException;
import com.learnup.identity.exception.IdentityExceptionHandler;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.ApplicationContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real Identity filter/controller/service/repositories; isolated H2 and mocked Tenant, not deployed E2E. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthenticationLoggingIntegrationTest {
    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final String PASSWORD = "SyntheticLoggingPassword123!";
    private static final String SECRET = "synthetic-private-request-value";
    private static final String CORRELATION_ID = "01900000-0000-7000-8000-00000000a401";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository users;
    @Autowired private RefreshTokenRepository refreshTokens;
    @Autowired private PasswordResetTokenRepository resetTokens;
    @Autowired private LoginThrottleRepository throttles;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ApplicationContext context;
    @MockBean private TenantAccessClient tenantAccessClient;

    private Logger root;
    private ListAppender<ILoggingEvent> logs;
    private final List<String> secrets = new ArrayList<>();

    @BeforeEach
    void setUp() {
        throttles.deleteAll();
        resetTokens.deleteAll();
        refreshTokens.deleteAll();
        users.deleteAll();
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        secrets.clear();
        secrets.addAll(List.of(INTERNAL_KEY, PASSWORD, SECRET));
        root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        logs = new ListAppender<>();
        logs.setContext(root.getLoggerContext());
        logs.start();
        root.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        root.detachAppender(logs);
        logs.stop();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth", "/api/auth"})
    void shouldKeepAuthenticationContractsWithoutLoggingSecrets(String base) throws Exception {
        User user = provision();
        secrets.add(user.getPasswordHash());
        JsonNode login = login(base, user, PASSWORD);
        String access = token(login, "accessToken");
        String refresh = token(login, "refreshToken");
        JsonNode rotated = data(perform(post(base + "/refresh"), Map.of("refreshToken", refresh), 200));
        String nextRefresh = token(rotated, "refreshToken");
        token(rotated, "accessToken");
        perform(trusted(post(base + "/logout"), access), Map.of("refreshToken", nextRefresh), 200);
        assertSafeError(perform(post(base + "/refresh"), Map.of("refreshToken", nextRefresh), 401));

        String changed = "SyntheticChangedPassword123!";
        secrets.add(changed);
        assertSafeError(perform(trusted(post(base + "/change-password"), access),
                Map.of("currentPassword", SECRET, "newPassword", changed, "confirmPassword", changed), 400));
        perform(trusted(post(base + "/change-password"), access),
                Map.of("currentPassword", PASSWORD, "newPassword", changed, "confirmPassword", changed), 200);
        login(base, user, changed);
        secrets.add(users.findById(user.getId()).orElseThrow().getPasswordHash());

        MvcResult recovery = perform(post(base + "/forgot-password"), Map.of("email", user.getEmail()), 200);
        assertSafeError(recovery);
        assertThat(data(recovery).properties()).extracting(Map.Entry::getKey).containsExactly("message");
        assertThat(resetTokens.findAll()).singleElement().satisfies(stored -> {
            assertThat(stored.getTokenHash()).matches("[a-f0-9]{64}");
            secrets.add(stored.getTokenHash());
        });
        // Email delivery is intentionally not implemented. Seed a known hash to exercise consumption.
        resetTokens.deleteAll();
        String rawReset = "synthetic-private-reset-token";
        String resetPassword = "SyntheticResetPassword123!";
        secrets.addAll(List.of(rawReset, resetPassword));
        PasswordResetToken reset = new PasswordResetToken();
        reset.setId(UUID.randomUUID());
        reset.setUserId(user.getId());
        reset.setTokenHash(sha256(rawReset));
        reset.setExpiresAt(Instant.now().plusSeconds(900));
        resetTokens.saveAndFlush(reset);
        secrets.add(reset.getTokenHash());
        Map<String, String> resetBody = Map.of("token", rawReset, "newPassword", resetPassword, "confirmPassword", resetPassword);
        perform(post(base + "/reset-password"), resetBody, 200);
        assertSafeError(perform(post(base + "/reset-password"), resetBody, 400));
        login(base, user, resetPassword);
        secrets.add(users.findById(user.getId()).orElseThrow().getPasswordHash());
        assertLogsSafe();
        assertThat(diagnostics()).contains("event=password_recovery_token_created", "user_id=" + user.getId(),
                "correlation_id=" + CORRELATION_ID);
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing-key", "invalid-key", "invalid-access-v1", "invalid-access-legacy"})
    void shouldRejectInvalidInternalOrAccessCredentialsWithoutEchoingThem(String scenario) throws Exception {
        boolean internal = scenario.endsWith("key");
        String path = internal ? "/api/internal/credentials"
                : scenario.endsWith("v1") ? "/api/v1/auth/me" : "/api/auth/me";
        var request = internal ? post(path) : get(path);
        request.header(HttpHeaders.AUTHORIZATION, "Bearer " + SECRET)
                .header(HeaderConstants.X_CORRELATION_ID, SECRET);
        if (!scenario.equals("missing-key")) {
            request.header(HeaderConstants.X_INTERNAL_KEY, internal ? SECRET : INTERNAL_KEY);
        }
        MvcResult result = mvc.perform(request.contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("userId", UUID.randomUUID(), "password", PASSWORD))))
                .andExpect(status().is(internal ? 403 : 401)).andReturn();
        assertSafeError(result);
        assertThat(UUID.fromString(result.getResponse().getHeader(HeaderConstants.X_CORRELATION_ID))).isNotNull();
        assertThat(users.count()).isZero();
        assertThat(refreshTokens.count()).isZero();
        assertLogsSafe();
        assertThat(diagnostics()).contains("event=authentication_rejected", internal
                ? "reason=INVALID_INTERNAL_CREDENTIAL" : "reason=INVALID_ACCESS_CREDENTIAL");
    }

    @ParameterizedTest
    @ValueSource(strings = {"uuid", "enum", "malformed", "validation"})
    void shouldNotPrintMalformedOrInvalidCredentialBodies(String scenario) throws Exception {
        Map<String, Object> body = Map.of("userId", scenario.equals("uuid") ? SECRET : UUID.randomUUID().toString(),
                "password", scenario.equals("validation") ? "" : PASSWORD,
                "role", scenario.equals("enum") ? SECRET : "LEARNER", "username", SECRET);
        String raw = scenario.equals("malformed") ? "{\"password\":\"" + PASSWORD + "\",\"userId\":\"" + SECRET + "\""
                : json.writeValueAsString(body);
        MvcResult result = mvc.perform(post("/api/internal/credentials")
                        .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                        .header(HeaderConstants.X_CORRELATION_ID, CORRELATION_ID)
                        .contentType(MediaType.APPLICATION_JSON).content(raw))
                .andExpect(status().isBadRequest()).andReturn();
        assertSafeError(result);
        assertThat(users.count()).isZero();
        assertLogsSafe();
        assertThat(diagnostics()).contains("event=request_rejected", "correlation_id=" + CORRELATION_ID);
    }

    @ParameterizedTest
    @ValueSource(strings = {"tenant-unavailable", "illegal-argument", "unexpected", "unknown-reason"})
    void shouldSanitizeExceptionMessagesCausesAndUntrustedUpstreamReasons(String scenario) throws Exception {
        User user = provision();
        int expected;
        switch (scenario) {
            case "tenant-unavailable" -> {
                var cause = new RestClientResponseException(SECRET, 503, "Unavailable", HttpHeaders.EMPTY,
                        (SECRET + PASSWORD + INTERNAL_KEY).getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
                when(tenantAccessClient.check(any())).thenThrow(new TenantUnavailableException(cause));
                expected = 503;
            }
            case "illegal-argument" -> {
                when(tenantAccessClient.check(any())).thenThrow(new IllegalArgumentException(SECRET));
                expected = 400;
            }
            case "unexpected" -> {
                when(tenantAccessClient.check(any())).thenThrow(
                        new DataIntegrityViolationException(PASSWORD, new RuntimeException(INTERNAL_KEY)));
                expected = 500;
            }
            default -> {
                when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(false, null, SECRET));
                expected = 403;
            }
        }
        MvcResult result = perform(post("/api/v1/auth/login"), Map.of("username", user.getEmail(), "password", PASSWORD), expected);
        assertSafeError(result);
        assertLogsSafe();
        assertThat(diagnostics()).contains("correlation_id=" + CORRELATION_ID);
        if (expected >= 500) {
            assertThat(logs.list).anySatisfy(event -> {
                assertThat(event.getLevel().toString()).isEqualTo("ERROR");
                assertThat(event.getFormattedMessage()).contains("exception_type=", "location=");
                assertThat(event.getThrowableProxy()).isNull();
            });
        }
        if (scenario.equals("unknown-reason")) {
            assertThat(result.getResponse().getContentAsString()).contains("ACCESS_DENIED");
        }
        assertThat(refreshTokens.count()).isZero();
    }

    @Test
    void shouldNotConfigureAnUnusedGeneratedPasswordUser() {
        assertThat(context.getBeansOfType(UserDetailsService.class)).isEmpty();
    }

    @Test
    void shouldNotRenderRequestPathOrMethodInFallbackAdvice() throws Exception {
        // Exercise inherited-handler replacements directly: unknown routes normally fail closed in security.
        IdentityExceptionHandler advice = context.getBean(IdentityExceptionHandler.class);
        var missing = advice.handleNoResourceFound(new NoResourceFoundException(HttpMethod.GET, SECRET));
        var method = advice.handleMethodNotSupported(new HttpRequestMethodNotSupportedException(SECRET));
        assertThat(missing.getStatusCode().value()).isEqualTo(404);
        assertThat(method.getStatusCode().value()).isEqualTo(405);
        assertThat(json.writeValueAsString(missing.getBody())).doesNotContain(SECRET);
        assertThat(json.writeValueAsString(method.getBody())).doesNotContain(SECRET);
        assertLogsSafe();
        assertThat(diagnostics()).contains("reason=RESOURCE_NOT_FOUND", "reason=METHOD_NOT_ALLOWED");
    }

    private User provision() throws Exception {
        UUID id = UUID.randomUUID();
        var request = new SetCredentialsRequest(id, PASSWORD, "logging_user", "logging@example.test",
                "Logging User", UserRole.LEARNER, UUID.randomUUID());
        assertSafeError(perform(post("/api/internal/credentials").header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY), request, 200));
        User user = users.findById(id).orElseThrow();
        assertThat(encoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        return user;
    }

    private JsonNode login(String base, User user, String password) throws Exception {
        JsonNode response = data(perform(post(base + "/login"), Map.of("username", user.getEmail(), "password", password), 200));
        token(response, "accessToken");
        token(response, "refreshToken");
        assertThat(response.path("user").has("passwordHash")).isFalse();
        return response;
    }

    private String token(JsonNode response, String name) {
        String token = response.path(name).asText();
        assertThat(token).isNotBlank();
        secrets.add(token);
        return token;
    }

    private MockHttpServletRequestBuilder trusted(MockHttpServletRequestBuilder request, String access) {
        return request.header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY).header(HttpHeaders.AUTHORIZATION, "Bearer " + access);
    }

    private MvcResult perform(MockHttpServletRequestBuilder request, Object body, int expected) throws Exception {
        return mvc.perform(request.header(HeaderConstants.X_CORRELATION_ID, CORRELATION_ID)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().is(expected)).andReturn();
    }

    private JsonNode data(MvcResult response) throws Exception {
        return json.readTree(response.getResponse().getContentAsString()).path("data");
    }

    private void assertSafeError(MvcResult result) throws Exception {
        for (String secret : secrets) {
            assertThat(result.getResponse().getContentAsString()).doesNotContain(secret);
        }
    }

    private void assertLogsSafe() {
        for (String secret : secrets) {
            assertThat(diagnostics()).doesNotContain(secret);
        }
    }

    private String diagnostics() {
        return logs.list.stream().map(event -> event.getMessage() + " " + event.getFormattedMessage() + " "
                + Arrays.toString(event.getArgumentArray()) + " " + (event.getThrowableProxy() == null ? ""
                : ThrowableProxyUtil.asString(event.getThrowableProxy()))).collect(Collectors.joining("\n"));
    }

    private String sha256(String token) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    }
}
