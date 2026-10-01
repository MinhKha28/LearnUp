package com.learnup.gateway.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.security.UserRole;
import com.learnup.gateway.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationFilterTest {

    private static final String TEST_SECRET = "testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!";
    private JwtProperties jwtProperties;
    private JwtAuthenticationFilter filter;
    private ObjectMapper objectMapper;
    private SecretKey secretKey;

    @BeforeEach
    void setUp() {
        jwtProperties = new JwtProperties();
        jwtProperties.setSecret(TEST_SECRET);
        objectMapper = new ObjectMapper();
        filter = new JwtAuthenticationFilter(jwtProperties, objectMapper);
        secretKey = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
    }

    private String createToken(String sub, String role, String organizationId, long ttlMillis) {
        long now = System.currentTimeMillis();
        var builder = Jwts.builder()
                .subject(sub)
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttlMillis))
                .signWith(secretKey);

        if (role != null) {
            builder.claim("role", role);
        }
        if (organizationId != null) {
            builder.claim("organizationId", organizationId);
        }

        return builder.compact();
    }

    @Test
    @DisplayName("Should return 401 UNAUTHORIZED when Authorization header is missing on protected route")
    void shouldRejectMissingAuthorizationHeader() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/organizations").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("Should return 401 UNAUTHORIZED when Bearer token is malformed")
    void shouldRejectMalformedBearerToken() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/courses")
                .header(HttpHeaders.AUTHORIZATION, "Basic invalidToken")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("Should return 401 UNAUTHORIZED when JWT signature is invalid")
    void shouldRejectInvalidJwtSignature() {
        SecretKey otherKey = Keys.hmacShaKeyFor("differentSecretKeyForSigningThatWillFailValidation32Bytes!".getBytes(StandardCharsets.UTF_8));
        String tamperedToken = Jwts.builder()
                .subject("user-1")
                .claim("role", "LEARNER")
                .signWith(otherKey)
                .compact();

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/courses")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tamperedToken)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("Should return 401 UNAUTHORIZED when JWT token is expired")
    void shouldRejectExpiredJwtToken() {
        String expiredToken = createToken("user-1", "LEARNER", "org-1", -10000L);

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/courses")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("Should return 401 UNAUTHORIZED when JWT token is missing 'sub' claim")
    void shouldRejectMissingSubClaim() {
        long now = System.currentTimeMillis();
        String tokenWithoutSub = Jwts.builder()
                .claim("role", "ORGANIZER")
                .issuedAt(new Date(now))
                .expiration(new Date(now + 3600000L))
                .signWith(secretKey)
                .compact();

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/courses")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenWithoutSub)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("Should return 401 UNAUTHORIZED when JWT token has an unapproved role")
    void shouldRejectUnapprovedRole() {
        String tokenWithIllegalRole = createToken("user-1", "SUPER_ADMIN", "org-1", 3600000L);

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/courses")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenWithIllegalRole)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("Should strip client-spoofed headers and inject verified JWT claims and x-internal-key downstream")
    void shouldSanitizeSpoofedHeadersAndInjectTrustedClaims() {
        String validUserId = "real-user-" + UUID.randomUUID();
        String validOrgId = "legit-org-" + UUID.randomUUID();
        String token = createToken(validUserId, "LEARNER", validOrgId, 3600000L);

        // Client attempts to spoof ADMIN role, user ID, and x-internal-key
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/learning/progress")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header(HeaderConstants.X_USER_ID, "attacker-user-id")
                .header(HeaderConstants.X_USER_ROLE, "ADMIN")
                .header(HeaderConstants.X_ORGANIZATION_ID, "evil-org-id")
                .header(HeaderConstants.X_INTERNAL_KEY, "attacker-fake-key")
                .build();

        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicReference<HttpHeaders> downstreamHeaders = new AtomicReference<>();
        GatewayFilterChain chain = ex -> {
            downstreamHeaders.set(ex.getRequest().getHeaders());
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        // Verify downstream headers
        HttpHeaders headers = downstreamHeaders.get();
        assertThat(headers).isNotNull();
        assertThat(headers.getFirst(HeaderConstants.X_USER_ID)).isEqualTo(validUserId);
        assertThat(headers.getFirst(HeaderConstants.X_USER_ROLE)).isEqualTo(UserRole.LEARNER.name());
        assertThat(headers.getFirst(HeaderConstants.X_ORGANIZATION_ID)).isEqualTo(validOrgId);
        assertThat(headers.getFirst(HeaderConstants.X_CORRELATION_ID)).isNotBlank();
        assertThat(headers.getFirst(HeaderConstants.X_INTERNAL_KEY)).isEqualTo("learnup-internal-secret");

        // Verify client spoofed values are completely overwritten
        assertThat(headers.getFirst(HeaderConstants.X_USER_ID)).isNotEqualTo("attacker-user-id");
        assertThat(headers.getFirst(HeaderConstants.X_USER_ROLE)).isNotEqualTo("ADMIN");
        assertThat(headers.getFirst(HeaderConstants.X_ORGANIZATION_ID)).isNotEqualTo("evil-org-id");
        assertThat(headers.getFirst(HeaderConstants.X_INTERNAL_KEY)).isNotEqualTo("attacker-fake-key");

        // Verify response header contains X-Correlation-ID
        assertThat(exchange.getResponse().getHeaders().getFirst(HeaderConstants.X_CORRELATION_ID)).isNotBlank();
    }

    @Test
    @DisplayName("Should propagate supplied correlation ID and echo in response header")
    void shouldPropagateSuppliedCorrelationId() {
        String correlationId = "client-trace-12345-abc";
        String token = createToken("user-1", "INSTRUCTOR", "org-1", 3600000L);

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/courses")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header(HeaderConstants.X_CORRELATION_ID, correlationId)
                .build();

        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicReference<String> downstreamCorrelationId = new AtomicReference<>();
        GatewayFilterChain chain = ex -> {
            downstreamCorrelationId.set(ex.getRequest().getHeaders().getFirst(HeaderConstants.X_CORRELATION_ID));
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        assertThat(downstreamCorrelationId.get()).isEqualTo(correlationId);
        assertThat(exchange.getResponse().getHeaders().getFirst(HeaderConstants.X_CORRELATION_ID)).isEqualTo(correlationId);
    }

    @Test
    @DisplayName("Should allow whitelisted public endpoints without Authorization header while injecting internal key and stripping spoofed identity headers")
    void shouldAllowWhitelistedPublicRoutes() {
        MockServerHttpRequest request = MockServerHttpRequest.post("/api/v1/auth/login")
                .header(HeaderConstants.X_USER_ID, "attacker-spoof")
                .header(HeaderConstants.X_USER_ROLE, "ADMIN")
                .header(HeaderConstants.X_INTERNAL_KEY, "attacker-fake-key")
                .build();

        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicReference<HttpHeaders> downstreamHeaders = new AtomicReference<>();
        GatewayFilterChain chain = ex -> {
            downstreamHeaders.set(ex.getRequest().getHeaders());
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        HttpHeaders headers = downstreamHeaders.get();
        assertThat(headers).isNotNull();
        assertThat(headers.getFirst(HeaderConstants.X_USER_ID)).isNull();
        assertThat(headers.getFirst(HeaderConstants.X_USER_ROLE)).isNull();
        assertThat(headers.getFirst(HeaderConstants.X_CORRELATION_ID)).isNotBlank();
        assertThat(headers.getFirst(HeaderConstants.X_INTERNAL_KEY)).isEqualTo("learnup-internal-secret");
    }
}
