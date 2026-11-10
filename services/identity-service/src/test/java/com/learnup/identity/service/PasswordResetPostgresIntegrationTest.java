package com.learnup.identity.service;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Runs the same transaction contract as H2 against a disposable, migrated PostgreSQL database.
 * Use src/test/scripts/Test-PasswordResetPostgres.ps1; no shared database fallback is allowed.
 */
@SpringBootTest
@ActiveProfiles({"test", "postgres-test"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_POSTGRES_URL", matches = ".+")
class PasswordResetPostgresIntegrationTest extends PasswordResetLifecycleContract {

    private static final Pattern TEST_DATABASE_URL = Pattern.compile(
            "^jdbc:postgresql://127\\.0\\.0\\.1:([0-9]{1,5})/identity_reset_test$");

    @DynamicPropertySource
    static void disposableDatabase(DynamicPropertyRegistry properties) {
        String url = requiredEnvironment("IDENTITY_TEST_POSTGRES_URL");
        Matcher matcher = TEST_DATABASE_URL.matcher(url);
        if (!matcher.matches()) {
            throw new IllegalStateException("PostgreSQL tests require the disposable loopback test database");
        }
        int port = Integer.parseInt(matcher.group(1));
        if (port < 1024 || port > 65535 || port == 5432) {
            throw new IllegalStateException("PostgreSQL tests require an isolated non-default host port");
        }
        String username = requiredEnvironment("IDENTITY_TEST_POSTGRES_USERNAME");
        if (!"identity_reset_test".equals(username)) {
            throw new IllegalStateException("PostgreSQL tests require the dedicated test database user");
        }
        String password = requiredEnvironment("IDENTITY_TEST_POSTGRES_PASSWORD");
        if (password.length() < 32) {
            throw new IllegalStateException("PostgreSQL tests require an ephemeral test password");
        }
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () -> username);
        properties.add("spring.datasource.password", () -> password);
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Required PostgreSQL test environment variable is absent: " + name);
        }
        return value;
    }
}
