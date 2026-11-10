package com.learnup.identity.service;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {"learnup.recovery.delivery-enabled=true",
        "spring.datasource.url=jdbc:h2:mem:recovery_delivery_test;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PasswordRecoveryIntegrationTest extends PasswordRecoveryPersistenceContract {
}
