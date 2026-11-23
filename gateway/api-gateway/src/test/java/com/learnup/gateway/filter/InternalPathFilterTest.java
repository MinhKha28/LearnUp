package com.learnup.gateway.filter;

import com.learnup.common.context.HeaderConstants;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false",
        "jwt.secret=" + InternalPathFilterTest.TEST_SECRET,
        "jwt.internal-key=" + InternalPathFilterTest.TEST_INTERNAL_KEY
})
@AutoConfigureWebTestClient
class InternalPathFilterTest {

    static final String TEST_SECRET = "synthetic-gateway-internal-path-test-signing-key";
    static final String TEST_INTERNAL_KEY = "synthetic-gateway-internal-path-test-service-key";
    private static final String SERVICE_NAME = "X-Service-Name";
    private static final String BACKEND_PATH = "X-Test-Backend-Path";
    private static final String COURSE_ID = "01900000-0000-7000-8000-c0020000005c";

    private static final DisposableServer BACKEND = HttpServer.create().host("127.0.0.1").port(0)
            .handle((request, response) -> {
                response.header(BACKEND_PATH, request.uri());
                for (String header : List.of(HeaderConstants.X_INTERNAL_KEY, HeaderConstants.X_ORGANIZATION_ID,
                        HeaderConstants.X_USER_ID, HeaderConstants.X_USER_ROLE, SERVICE_NAME)) {
                    response.responseHeaders().add(header, request.requestHeaders().getAll(header));
                }
                return response.send();
            }).bindNow();

    @DynamicPropertySource
    static void backendUrl(DynamicPropertyRegistry registry) {
        registry.add("TENANT_SERVICE_URL", () -> "http://127.0.0.1:" + BACKEND.port());
    }

    @AfterAll
    static void stopBackend() {
        BACKEND.disposeNow();
    }

    @Autowired
    private WebTestClient client;

    @ParameterizedTest
    @CsvSource({
            "POST, /api/internal/credentials",
            "POST, /api/v1/auth/internal/credentials",
            "GET, /api/v1/notifications/internal/messages",
            "GET, /api/v1/audit/internal/events",
            "GET, /api/v1/users/internal/organizer",
            "GET, /api/v1/subscriptions/internal/instructor-material-upload-policy",
            "GET, /api/v1/courses/internal/versions",
            "GET, /api/v1/enrollments/internal/courses/" + COURSE_ID + "/history",
            "DELETE, /api/v1/assessments/internal/courses/" + COURSE_ID,
            "GET, /api/v1/reports/internal/export",
            "GET, /internal",
            "GET, /api/users/INtErNaL/organizer",
            "GET, /api/v1/users/%2Finternal%2forganizer",
            "GET, /api/v1/users/%69nternal/organizer",
            "GET, /api/v1/users//internal//organizer",
            "GET, /api/v1/users/internal/",
            "GET, /api/v1/users/internal;param=value/organizer",
            "GET, /api/v1/users/%5Cinternal%5Corganizer"
    })
    void rejectsInternalPathsBeforeAuthentication(String method, String path) {
        assertNotFound(client.method(HttpMethod.valueOf(method)).uri(URI.create(path)));
    }

    @ParameterizedTest
    @CsvSource({
            "DELETE, /api/v1/assessments/internal/courses/" + COURSE_ID,
            "GET, /api/v1/enrollments/internal/courses/" + COURSE_ID + "/history"
    })
    void rejectsInternalPathsWithValidToken(String method, String path) {
        assertNotFound(client.method(HttpMethod.valueOf(method)).uri(path).headers(headers -> headers.setBearerAuth(token())));
    }

    @Test
    void rejectsInternalCorsPreflight() {
        assertNotFound(client.options().uri("/api/v1/users/internal/organizer")
                .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"));
    }

    @Test
    void routesPublicWordContainingInternalAndStripsClientIdentity() {
        String path = "/api/v1/subscription-plans/internals-guide?next=/internal/";
        client.get().uri(URI.create(path))
                .header("x-internal-key", "client-key")
                .header("x-organization-id", "client-organization")
                .header("x-service-name", "client-service")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(BACKEND_PATH, path)
                .expectHeader().valueEquals(HeaderConstants.X_INTERNAL_KEY, TEST_INTERNAL_KEY)
                .expectHeader().doesNotExist(HeaderConstants.X_ORGANIZATION_ID)
                .expectHeader().doesNotExist(SERVICE_NAME);
    }

    @Test
    void routesAuthenticatedRequestWithOnlyVerifiedIdentity() {
        String path = "/api/v1/users/instructors";
        client.get().uri(path)
                .headers(headers -> headers.setBearerAuth(token()))
                .header("x-internal-key", "client-key", "second-client-key")
                .header("x-organization-id", "client-organization")
                .header("x-service-name", "client-service")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(BACKEND_PATH, path)
                .expectHeader().valueEquals(HeaderConstants.X_INTERNAL_KEY, TEST_INTERNAL_KEY)
                .expectHeader().valueEquals(HeaderConstants.X_USER_ID, "verified-user")
                .expectHeader().valueEquals(HeaderConstants.X_USER_ROLE, "INSTRUCTOR")
                .expectHeader().valueEquals(HeaderConstants.X_ORGANIZATION_ID, "verified-organization")
                .expectHeader().doesNotExist(SERVICE_NAME);
    }

    private void assertNotFound(WebTestClient.RequestHeadersSpec<?> request) {
        request.exchange()
                .expectStatus().isNotFound()
                .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .expectHeader().doesNotExist(HeaderConstants.X_CORRELATION_ID)
                .expectHeader().doesNotExist(BACKEND_PATH)
                .expectBody()
                .jsonPath("$.success").isEqualTo(false)
                .jsonPath("$.error.code").isEqualTo("RESOURCE_NOT_FOUND")
                .jsonPath("$.error.message").isEqualTo("The requested gateway route or resource was not found");
    }

    private String token() {
        return Jwts.builder()
                .subject("verified-user")
                .claim("role", "INSTRUCTOR")
                .claim("organizationId", "verified-organization")
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }
}
