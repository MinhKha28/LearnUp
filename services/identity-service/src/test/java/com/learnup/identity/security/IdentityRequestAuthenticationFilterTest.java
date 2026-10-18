package com.learnup.identity.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.CurrentUser;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.context.RequestContextHolder;
import com.learnup.common.security.UserRole;
import com.learnup.identity.config.JwtConfig;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IdentityRequestAuthenticationFilterTest {
    private static final String JWT_SECRET = "testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!";
    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final UUID USER_ID = UUID.fromString("01900000-0000-7000-8000-00000000a201");
    private static final UUID ORG_ID = UUID.fromString("01900000-0000-7000-8000-00000000b201");

    private IdentityRequestAuthenticationFilter filter(String internalKey, String secret) {
        var config = new JwtConfig();
        config.setSecret(secret);
        return new IdentityRequestAuthenticationFilter(internalKey, config, new ObjectMapper());
    }

    @AfterEach
    void clearContexts() {
        RequestContextHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private static Stream<Arguments> insecureConfiguration() {
        return Stream.of(
                Arguments.of(null, JWT_SECRET), Arguments.of("", JWT_SECRET), Arguments.of("short", JWT_SECRET),
                Arguments.of("learnup-internal-secret", JWT_SECRET),
                Arguments.of(INTERNAL_KEY, null), Arguments.of(INTERNAL_KEY, ""), Arguments.of(INTERNAL_KEY, "short"),
                Arguments.of(INTERNAL_KEY, "devSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong"));
    }

    @ParameterizedTest
    @MethodSource("insecureConfiguration")
    void shouldRefuseMissingWeakOrRepositoryDefaultSecrets(String internalKey, String secret) {
        assertThatThrownBy(() -> filter(internalKey, secret)).isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"malformed", "wrong-signature", "expired", "missing-expiry", "missing-subject",
            "invalid-subject", "missing-role", "invalid-role", "invalid-organization"})
    void shouldRejectInvalidJwtEvenWithValidInternalCredential(String example) throws Exception {
        var request = trustedRequest("/api/v1/auth/me", token(example));
        var response = new MockHttpServletResponse();
        AtomicBoolean invoked = new AtomicBoolean();

        filter(INTERNAL_KEY, JWT_SECRET).doFilter(request, response, (req, res) -> invoked.set(true));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(invoked).isFalse();
        assertThat(RequestContextHolder.get()).isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth/login", "/api/auth/login", "/api/v1/auth/refresh", "/api/auth/refresh",
            "/api/v1/auth/forgot-password", "/api/auth/forgot-password", "/api/v1/auth/reset-password", "/api/auth/reset-password"})
    void shouldNeverAuthenticatePublicRequestsFromIdentityHeaders(String path) throws Exception {
        var request = trustedRequest(path, token("valid"));
        request.setMethod("POST");
        request.addHeader(HeaderConstants.X_USER_ID, USER_ID.toString());
        request.addHeader(HeaderConstants.X_USER_ROLE, "ADMIN");
        request.addHeader(HeaderConstants.X_ORGANIZATION_ID, ORG_ID.toString());
        AtomicBoolean invoked = new AtomicBoolean();

        filter(INTERNAL_KEY, JWT_SECRET).doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            invoked.set(true);
            assertThat(CurrentUser.getUserId()).isNull();
            assertThat(CurrentUser.getRole()).isNull();
            assertThat(CurrentUser.getOrganizationId()).isNull();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        });
        assertThat(invoked).isTrue();
    }

    @Test
    void shouldDeriveSubjectRoleAndOrganizationOnlyFromVerifiedJwtAndClearAfterFailure() {
        var request = trustedRequest("/api/v1/auth/me", token("valid"));
        request.addHeader(HeaderConstants.X_USER_ID, UUID.randomUUID().toString());
        request.addHeader(HeaderConstants.X_USER_ROLE, "ADMIN");
        request.addHeader(HeaderConstants.X_ORGANIZATION_ID, UUID.randomUUID().toString());

        assertThatThrownBy(() -> filter(INTERNAL_KEY, JWT_SECRET).doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            assertThat(CurrentUser.getUserIdAsUuid()).isEqualTo(USER_ID);
            assertThat(CurrentUser.getRole()).isEqualTo(UserRole.LEARNER);
            assertThat(CurrentUser.getOrganizationIdAsUuid()).isEqualTo(ORG_ID);
            assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isEqualTo(USER_ID);
            throw new ServletException("test downstream failure");
        })).isInstanceOf(ServletException.class);
        assertThat(RequestContextHolder.get()).isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private MockHttpServletRequest trustedRequest(String path, String token) {
        var request = new MockHttpServletRequest("GET", path);
        request.addHeader(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY);
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        return request;
    }

    private String token(String example) {
        if ("malformed".equals(example)) {
            return "not-a-jwt";
        }
        String secret = "wrong-signature".equals(example) ? "differentPrivateSigningKeyAtLeast32BytesLong!" : JWT_SECRET;
        return Jwts.builder()
                .subject("missing-subject".equals(example) ? null : "invalid-subject".equals(example) ? "not-a-uuid" : USER_ID.toString())
                .claim("role", "missing-role".equals(example) ? null : "invalid-role".equals(example) ? "SUPER_ADMIN" : "LEARNER")
                .claim("organizationId", "invalid-organization".equals(example) ? "not-an-org-uuid" : ORG_ID.toString())
                .expiration("missing-expiry".equals(example) ? null : new Date(System.currentTimeMillis()
                        + ("expired".equals(example) ? -60_000 : 60_000)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }
}
