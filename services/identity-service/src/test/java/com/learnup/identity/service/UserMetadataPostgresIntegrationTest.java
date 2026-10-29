package com.learnup.identity.service;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Opt-in only through the existing owned disposable PostgreSQL runner with -AllTests. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "postgres-test"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_POSTGRES_URL", matches = ".+")
class UserMetadataPostgresIntegrationTest extends UserMetadataContract {
    @DynamicPropertySource
    static void disposableDatabase(DynamicPropertyRegistry properties) {
        PasswordResetPostgresIntegrationTest.disposableDatabase(properties);
    }
}
