package com.learnup.identity.service;

import com.learnup.common.security.UserRole;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.exception.CredentialProvisioningConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "postgres-test"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_POSTGRES_URL", matches = ".+")
class Br31CredentialProvisioningPostgresIntegrationTest extends Br31CredentialProvisioningContract {
    @DynamicPropertySource
    static void disposableDatabase(DynamicPropertyRegistry properties) {
        PasswordResetPostgresIntegrationTest.disposableDatabase(properties);
    }

    @Test
    void invisibleUncommittedEmailClaimHasABoundedUniqueIndexWaitAndNoTenantHandoff() throws Exception {
        String email = "uncommitted@br31.invalid";
        UUID blockerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        SetCredentialsRequest request = new SetCredentialsRequest(requesterId, "SyntheticBr31BoundedPassword!31");
        request.setEmail(email);
        CountDownLatch inserted = new CountDownLatch(1);
        CountDownLatch allowCommit = new CountDownLatch(1);
        var worker = Executors.newSingleThreadExecutor();
        try {
            var holding = worker.submit(() -> {
                TransactionTemplate blocking = new TransactionTemplate(transactions);
                blocking.setTimeout(25);
                blocking.executeWithoutResult(status -> {
                    Instant now = Instant.now();
                    users.saveAndFlush(new User(blockerId, "user_" + blockerId, email,
                            passwords.encode("SyntheticBr31BlockingPassword!31"), "Uncommitted Test User",
                            UserRole.LEARNER, null, true, now, now));
                    inserted.countDown();
                    try {
                        if (!allowCommit.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("Test commit gate timed out");
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(interrupted);
                    }
                });
            });
            assertThat(inserted.await(10, TimeUnit.SECONDS)).isTrue();
            Instant start = Instant.now();
            assertThatThrownBy(() -> auth.setCredentials(request)).isInstanceOf(CredentialProvisioningConflictException.class);
            assertThat(Duration.between(start, Instant.now())).isBetween(Duration.ofSeconds(7), Duration.ofSeconds(15));
            assertThat(users.findById(requesterId)).isEmpty();
            allowCommit.countDown();
            holding.get(10, TimeUnit.SECONDS);
            assertThat(users.findByEmail(email).orElseThrow().getId()).isEqualTo(blockerId);
            assertThat(users.count()).isOne();
            verifyNoInteractions(tenant);
        } finally {
            allowCommit.countDown();
            worker.shutdownNow();
            assertThat(worker.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }
}
