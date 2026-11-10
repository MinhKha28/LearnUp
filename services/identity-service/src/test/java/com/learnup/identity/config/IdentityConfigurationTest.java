package com.learnup.identity.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Actual application YAML and security-chain startup, without an external database or discovery server. */
class IdentityConfigurationTest {

    // Synthetic isolated-test values only. Never reuse these public values in deployment configuration.
    private static final String JWT_SECRET = "configurationTestSigningKeyAtLeast32BytesLong!";
    private static final String INTERNAL_KEY = "configurationTestInternalKeyAtLeast32BytesLong!";
    private static final String DATABASE_PASSWORD = "configuration-test-database-password";
    private static final String[] PROFILES = {"default", "docker", "prod", "staging", "production"};

    private WebApplicationContextRunner runner(String profile) {
        return runner(profile, true);
    }

    private WebApplicationContextRunner runner(String profile, boolean provideDatabasePassword) {
        WebApplicationContextRunner contextRunner = new WebApplicationContextRunner()
                .withInitializer(context -> {
                    // A developer's real shell credentials must not make a missing-setting test pass.
                    var sources = context.getEnvironment().getPropertySources();
                    sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
                    sources.remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
                    new ConfigDataApplicationContextInitializer().initialize(context);
                })
                .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class,
                        JacksonAutoConfiguration.class, HttpMessageConvertersAutoConfiguration.class,
                        SecurityAutoConfiguration.class, WebMvcAutoConfiguration.class))
                .withUserConfiguration(BoundaryConfiguration.class)
                .withPropertyValues("spring.profiles.active=" + profile);
        return provideDatabasePassword
                ? contextRunner.withPropertyValues("SPRING_DATASOURCE_PASSWORD=" + DATABASE_PASSWORD)
                : contextRunner;
    }

    @ParameterizedTest
    @ValueSource(strings = {"default", "docker", "prod", "staging", "production"})
    void actualYamlAndSecurityBoundaryStartWithExplicitSecureSettings(String profile) {
        runner(profile).withPropertyValues("JWT_SECRET=" + JWT_SECRET, "INTERNAL_SERVICE_KEY=" + INTERNAL_KEY)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(SecurityFilterChain.class)
                            .hasSingleBean(ObjectMapper.class).hasSingleBean(JwtConfig.class);
                    JwtConfig jwt = context.getBean(JwtConfig.class);
                    assertThat(jwt.getSecret()).isEqualTo(JWT_SECRET);
                    assertThat(jwt.getAccessTokenExpirationMinutes()).isEqualTo(15);
                    assertThat(jwt.getRefreshTokenExpirationDays()).isEqualTo(7);
                    assertThat(context.getEnvironment().getProperty("security.internal-key")).isEqualTo(INTERNAL_KEY);
                    assertThat(context.getEnvironment().getProperty("spring.datasource.password"))
                            .isEqualTo(DATABASE_PASSWORD);
                    assertThat(context.getEnvironment().getProperty("learnup.seed.enabled", Boolean.class)).isFalse();
                    assertThat(context.getEnvironment().getProperty("springdoc.api-docs.enabled", Boolean.class)).isFalse();
                    assertThat(context.getEnvironment().getProperty("springdoc.swagger-ui.enabled", Boolean.class)).isFalse();
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"docker", "prod", "staging", "production"})
    void deploymentProfilesCannotEnablePublicDocumentationEvenWhenLocalDocsIsRequested(String profile) {
        runner("local-docs," + profile)
                .withPropertyValues("JWT_SECRET=" + JWT_SECRET, "INTERNAL_SERVICE_KEY=" + INTERNAL_KEY)
                .run(context -> {
                    assertThat(context).hasNotFailed().doesNotHaveBean(OpenAPI.class);
                    // The local profile really loads its enabled properties: the independent
                    // deployment-profile security boundary must still refuse every docs entry.
                    assertThat(context.getEnvironment().getProperty("springdoc.api-docs.enabled", Boolean.class)).isTrue();
                    var mvc = MockMvcBuilders.webAppContextSetup(context.getSourceApplicationContext())
                            .apply(springSecurity()).build();
                    for (String path : new String[] {"/v3/api-docs", "/v3/api-docs.yaml", "/v3/api-docs/swagger-config",
                            "/swagger-ui.html", "/swagger-ui/index.html"}) {
                        mvc.perform(get(path)).andExpect(status().isUnauthorized());
                    }
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"default", "docker", "prod", "staging", "production"})
    void requiredDatabasePasswordCannotResolveWhenNotProvided(String profile) {
        runner(profile, false)
                .withPropertyValues("JWT_SECRET=" + JWT_SECRET, "INTERNAL_SERVICE_KEY=" + INTERNAL_KEY)
                .run(context -> {
                    // This narrow runner has no DataSource. Resolving the actual password
                    // property must fail rather than returning a checked-in fallback credential.
                    assertThat(context).hasNotFailed();
                    assertThatThrownBy(() -> context.getEnvironment().getProperty("spring.datasource.password"))
                            .isInstanceOf(IllegalArgumentException.class)
                            .hasMessageContaining("SPRING_DATASOURCE_PASSWORD");
                });
    }

    static Stream<Arguments> invalidConfiguration() {
        return Stream.of(PROFILES).flatMap(profile -> Stream.of(
                Arguments.of(profile, "JWT_SECRET", null),
                Arguments.of(profile, "JWT_SECRET", ""),
                Arguments.of(profile, "JWT_SECRET", "   "),
                Arguments.of(profile, "JWT_SECRET", "short-invalid-signing-key"),
                Arguments.of(profile, "JWT_SECRET", "devSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong"),
                Arguments.of(profile, "INTERNAL_SERVICE_KEY", null),
                Arguments.of(profile, "INTERNAL_SERVICE_KEY", ""),
                Arguments.of(profile, "INTERNAL_SERVICE_KEY", "   "),
                Arguments.of(profile, "INTERNAL_SERVICE_KEY", "short-invalid-channel-key"),
                Arguments.of(profile, "INTERNAL_SERVICE_KEY", "learnup-internal-secret")));
    }

    @ParameterizedTest(name = "{0}: invalid {1} case {index}")
    @MethodSource("invalidConfiguration")
    void actualSecurityBoundaryFailsClosedForMissingOrUnsafeSettings(String profile, String setting, String value) {
        WebApplicationContextRunner contextRunner = runner(profile).withPropertyValues(
                "JWT_SECRET".equals(setting) ? "INTERNAL_SERVICE_KEY=" + INTERNAL_KEY : "JWT_SECRET=" + JWT_SECRET);
        if (value != null) {
            contextRunner = contextRunner.withPropertyValues(setting + "=" + value);
        }
        contextRunner.run(context -> {
            assertThat(context).hasFailed();
            Throwable root = NestedExceptionUtils.getMostSpecificCause(context.getStartupFailure());
            assertThat(root).isInstanceOfAny(IllegalArgumentException.class, IllegalStateException.class);
            assertThat(root.getMessage()).contains(setting).doesNotContain(JWT_SECRET, INTERNAL_KEY);
            if (value == null) {
                // @Value fails on an unresolved placeholder; configuration binding may instead
                // pass it to the same fail-closed secret validator. Neither path starts the service.
                assertThat(root.getMessage()).satisfiesAnyOf(
                        message -> assertThat(message).contains("Could not resolve placeholder"),
                        message -> assertThat(message).contains("must be explicitly configured, non-default and at least 32 bytes"));
            } else {
                assertThat(root.getMessage()).contains("must be explicitly configured, non-default and at least 32 bytes");
                if (!value.isBlank()) {
                    assertThat(root.getMessage()).doesNotContain(value);
                }
            }
        });
    }

    @Test
    void checkedInBaseYamlHasNoDatabasePasswordFallbackAndDefaultsSeedingOff() throws IOException {
        var documents = new YamlPropertySourceLoader().load("identity-application", new ClassPathResource("application.yml"));
        var base = documents.getFirst();
        assertThat(base.getProperty("spring.datasource.password")).isEqualTo("${SPRING_DATASOURCE_PASSWORD}");
        assertThat(base.getProperty("security.jwt.secret")).isEqualTo("${JWT_SECRET}");
        assertThat(base.getProperty("security.internal-key")).isEqualTo("${INTERNAL_SERVICE_KEY}");
        assertThat(base.getProperty("learnup.seed.enabled")).isIn(false, "${LEARNUP_SEED_ENABLED:false}");
        assertThat(base.getProperty("learnup.seed.default-password")).isNull();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(JwtConfig.class)
    @Import({SecurityConfig.class, OpenApiConfig.class})
    static class BoundaryConfiguration {
    }
}
