package com.learnup.identity.service;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Default H2 regression coverage; PostgreSQL independently verifies real constraints. */
@SpringBootTest
@ActiveProfiles("test")
class CredentialProvisioningIntegrationTest extends CredentialProvisioningContract {
}
