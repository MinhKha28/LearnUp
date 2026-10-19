package com.learnup.identity.service;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest(properties = "learnup.recovery.delivery-enabled=true")
@ActiveProfiles({"test", "postgres-test"})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_POSTGRES_URL", matches = ".+")
class PasswordRecoveryPostgresIntegrationTest extends PasswordRecoveryPersistenceContract {
    @DynamicPropertySource
    static void disposableDatabase(DynamicPropertyRegistry properties) {
        PasswordResetPostgresIntegrationTest.disposableDatabase(properties);
    }
}
