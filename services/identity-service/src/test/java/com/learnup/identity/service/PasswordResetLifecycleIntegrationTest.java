package com.learnup.identity.service;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** H2 persistence coverage; the separate PostgreSQL suite verifies database-specific locking. */
@SpringBootTest
@ActiveProfiles("test")
class PasswordResetLifecycleIntegrationTest extends PasswordResetLifecycleContract {
}
