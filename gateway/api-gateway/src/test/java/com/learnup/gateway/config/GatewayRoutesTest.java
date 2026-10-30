package com.learnup.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.gateway.filter.JwtAuthenticationFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.cloud.gateway.config.GatewayProperties;
import org.springframework.cloud.gateway.handler.predicate.PathRoutePredicateFactory;
import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/** Routes are read from the real application.yml, so a missing path prefix fails here instead of in the compose build. */
class GatewayRoutesTest {

    private static final String TEST_SECRET = "testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!";
    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";

    private GatewayProperties gateway;
    private JwtProperties jwtProperties;

    @BeforeEach
    void loadConfiguration() throws Exception {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("test-secrets",
                Map.of("JWT_SECRET", TEST_SECRET, "INTERNAL_SERVICE_KEY", INTERNAL_KEY)));
        new YamlPropertySourceLoader().load("gateway-application", new ClassPathResource("application.yml"))
                .forEach(environment.getPropertySources()::addLast);
        Binder binder = Binder.get(environment);
        gateway = binder.bind("spring.cloud.gateway", Bindable.of(GatewayProperties.class)).get();
        jwtProperties = binder.bind("jwt", Bindable.of(JwtProperties.class)).get();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/assignments",
            "/api/v1/assignments/0199a000-0000-7000-8000-000000000001",
            "/api/v1/assignments/0199a000-0000-7000-8000-000000000001/due-date",
            "/api/v1/assignments/0199a000-0000-7000-8000-000000000001/exemption",
            "/api/assignments",
            "/api/assignments/0199a000-0000-7000-8000-000000000001/due-date"
    })
    @DisplayName("UC24 assignment endpoints are routed to learning-service")
    void routesAssignmentsToLearningService(String path) {
        List<RouteDefinition> routes = routesMatching(path);

        assertThat(routes).as(path).hasSize(1);
        assertThat(routes.get(0).getId()).isEqualTo("learning-service");
        assertThat(routes.get(0).getUri().toString()).isEqualTo("http://learning-service:8085");
        assertThat(routes.get(0).getFilters()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/assignments", "/api/assignments/0199a000-0000-7000-8000-000000000001"})
    @DisplayName("Assignment endpoints require a JWT")
    void rejectsAnonymousAssignmentRequests(String path) {
        assertThat(jwtProperties.isWhitelisted(path)).as(path).isFalse();

        var filter = new JwtAuthenticationFilter(jwtProperties, new ObjectMapper());
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path));
        AtomicReference<ServerWebExchange> forwarded = new AtomicReference<>();
        StepVerifier.create(filter.filter(exchange, next -> {
            forwarded.set(next);
            return Mono.empty();
        })).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(forwarded.get()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/admin/subscription-plans", "/api/admin/subscription-plans"})
    @DisplayName("UC43/UC43.1 Admin plan endpoints go to tenant-service and require a JWT")
    void routesAdminPlansToTenantWithJwt(String path) {
        List<RouteDefinition> routes = routesMatching(path);
        assertThat(routes).as(path).hasSize(1);
        assertThat(routes.get(0).getId()).isEqualTo("tenant-service");
        assertThat(jwtProperties.isWhitelisted(path)).as(path).isFalse();

        var filter = new JwtAuthenticationFilter(jwtProperties, new ObjectMapper());
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.post(path));
        AtomicReference<ServerWebExchange> forwarded = new AtomicReference<>();
        StepVerifier.create(filter.filter(exchange, next -> {
            forwarded.set(next);
            return Mono.empty();
        })).verifyComplete();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(forwarded.get()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/admin/organizations", "/api/v1/admin/courses"})
    @DisplayName("Only the Admin plan branch is claimed by tenant-service")
    void doesNotClaimOtherAdminPaths(String path) {
        assertThat(routesMatching(path)).as(path).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/learning/x", "/api/v1/enrollments", "/api/v1/enrollments/x/curriculum",
            "/api/learning/x", "/api/enrollments"
    })
    @DisplayName("Existing learning-service paths keep their route")
    void keepsExistingLearningRoutes(String path) {
        List<RouteDefinition> routes = routesMatching(path);

        assertThat(routes).as(path).hasSize(1);
        assertThat(routes.get(0).getId()).isEqualTo("learning-service");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/audit/logs", "/api/v1/audit/logs/0199a000-0000-7000-8000-000000000001", "/api/audit/logs"})
    @DisplayName("The audit trail is routed to audit-service, for reading only and with a JWT")
    void routesAuditForReadingOnly(String path) {
        List<RouteDefinition> routes = routesMatching(path);

        assertThat(routes).as(path).hasSize(1);
        RouteDefinition audit = routes.get(0);
        assertThat(audit.getId()).isEqualTo("audit-service");
        // entries are written by the services directly, never through the gateway
        var methods = audit.getPredicates().stream().filter(predicate -> "Method".equals(predicate.getName())).toList();
        assertThat(methods).as("a Method predicate").hasSize(1);
        assertThat(methods.get(0).getArgs().values()).containsExactly("GET");
        assertThat(jwtProperties.isWhitelisted(path)).as(path + " is not whitelisted").isFalse();
    }

    private List<RouteDefinition> routesMatching(String path) {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path));
        var pathFactory = new PathRoutePredicateFactory();
        return gateway.getRoutes().stream()
                .filter(route -> route.getPredicates().stream()
                        .filter(predicate -> "Path".equals(predicate.getName()))
                        .anyMatch(predicate -> pathFactory.apply(new PathRoutePredicateFactory.Config()
                                .setPatterns(new ArrayList<>(predicate.getArgs().values()))).test(exchange)))
                .toList();
    }
}
