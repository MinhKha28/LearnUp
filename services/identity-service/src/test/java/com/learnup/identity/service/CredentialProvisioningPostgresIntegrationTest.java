package com.learnup.identity.service;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Run with the existing disposable PostgreSQL runner's -AllTests option. */
@SpringBootTest
@ActiveProfiles({"test", "postgres-test"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_POSTGRES_URL", matches = ".+")
class CredentialProvisioningPostgresIntegrationTest extends CredentialProvisioningContract {

    @DynamicPropertySource
    static void disposableDatabase(DynamicPropertyRegistry properties) {
        PasswordResetPostgresIntegrationTest.disposableDatabase(properties);
    }
}
