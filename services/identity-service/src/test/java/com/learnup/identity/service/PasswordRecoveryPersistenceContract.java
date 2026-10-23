package com.learnup.identity.service;

import com.learnup.common.security.UserRole;
import com.learnup.identity.client.NotificationEmailClient;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.dto.ChangePasswordRequest;
import com.learnup.identity.dto.ForgotPasswordRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real transactions/storage; only remote Tenant/Notification HTTP clients are mocked. */
@Import(PasswordRecoveryPersistenceContract.WorkObservationConfiguration.class)
abstract class PasswordRecoveryPersistenceContract {
    private static final String INITIAL_PASSWORD = "SyntheticRecoveryInitial!29";
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired PasswordResetTokenRepository tokens;
    @Autowired RefreshTokenRepository refresh;
    @Autowired LoginThrottleRepository throttles;
    @Autowired PasswordEncoder encoder;
    @Autowired RecoveryDeliveryState deliveryState;
    @Autowired LoginThrottleService loginThrottle;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ThreadPoolTaskExecutor recoveryDeliveryExecutor;
    @Autowired DeliveryWorkTracker workTracker;
    @MockBean TenantAccessClient tenant;
    @MockBean NotificationEmailClient notification;

    @BeforeEach
    void prepare() throws Exception {
        idle();
        tokens.deleteAll();
        refresh.deleteAll();
        throttles.deleteAll();
        users.deleteAll();
        when(tenant.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        when(notification.sendRecovery(any(), any(), any(), any())).thenReturn(NotificationEmailClient.DeliveryResult.SENT);
    }

    @Test
    void emailSeesDurablyCommittedHashAndConfiguredUrl() throws Exception {
        User user = user();
        AtomicInteger attempts = new AtomicInteger();
        doAnswer(invocation -> {
            String url = invocation.getArgument(1);
            assertThat(url).startsWith("http://127.0.0.1:5173/reset-password/");
            String raw = url.substring(url.lastIndexOf('/') + 1);
            assertThat(tokens.findByTokenHash(hash(raw))).isPresent();
            assertThat(invocation.<String>getArgument(0)).isEqualTo(user.getEmail());
            assertThat(invocation.<Instant>getArgument(2)).isAfter(Instant.now());
            attempts.incrementAndGet();
            return NotificationEmailClient.DeliveryResult.SENT;
        }).when(notification).sendRecovery(any(), any(), any(), any());

        TransactionTemplate transaction = new TransactionTemplate(transactions);
        transaction.executeWithoutResult(status -> {
            auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
            verifyNoInteractions(notification);
        });
        idle();

        assertThat(attempts).hasValue(1);
        assertThat(tokens.findAll()).singleElement().satisfies(token -> {
            assertThat(token.getTokenHash()).matches("[a-f0-9]{64}");
            assertThat(token.getUserId()).isEqualTo(user.getId());
        });
    }

    @Test
    void rolledBackIssuanceNeverSendsEmailOrPersistsBudget() throws Exception {
        User user = user();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
            status.setRollbackOnly();
        });
        idle();
        assertThat(tokens.count()).isZero();
        assertThat(throttles.count()).isZero();
        verifyNoInteractions(notification);
    }

    @ParameterizedTest
    @EnumSource(value = NotificationEmailClient.DeliveryResult.class, names = "SENT", mode = EnumSource.Mode.EXCLUDE)
    void failureOrSimulationRevokesOnlyTheUndeliveredAuthority(NotificationEmailClient.DeliveryResult outcome) throws Exception {
        User user = user();
        when(notification.sendRecovery(any(), any(), any(), any())).thenReturn(outcome);
        String response = mvc.perform(post("/api/v1/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + user.getEmail() + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        idle();
        assertThat(response).contains("If the email is registered").doesNotContain("token", outcome.name(), user.getEmail());
        assertThat(tokens.count()).isZero();
        assertThat(users.findById(user.getId()).orElseThrow().getPasswordHash()).isEqualTo(user.getPasswordHash());
        assertThat(throttles.findAll()).singleElement().extracting(counter -> counter.getFailedCount()).isEqualTo(1);
    }

    @Test
    void unknownDisabledAndTenantDeletedAccountsDoNotSendEmail() throws Exception {
        auth.forgotPassword(new ForgotPasswordRequest("unknown@example.test"));
        User disabled = user();
        disabled.setEnabled(false);
        users.saveAndFlush(disabled);
        auth.forgotPassword(new ForgotPasswordRequest(disabled.getEmail()));
        User deletedInTenant = user();
        when(tenant.check(deletedInTenant.getId())).thenReturn(new SignInAccess(false, null, "ACCOUNT_NOT_FOUND"));
        auth.forgotPassword(new ForgotPasswordRequest(deletedInTenant.getEmail()));
        idle();
        verifyNoInteractions(notification);
        assertThat(tokens.count()).isZero();
        assertThat(users.findById(disabled.getId()).orElseThrow().isEnabled()).isFalse();
    }

    @Test
    void duplicateRequestsAreBoundedWithoutRevokingTheLastDeliveredLinkWhenLimited() throws Exception {
        User user = user();
        AtomicInteger attempts = new AtomicInteger();
        when(notification.sendRecovery(any(), any(), any(), any())).thenAnswer(invocation -> {
            attempts.incrementAndGet();
            return NotificationEmailClient.DeliveryResult.SENT;
        });
        UUID last = null;
        for (int request = 0; request < 3; request++) {
            auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
            idle();
            last = tokens.findAll().getFirst().getId();
        }
        auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        idle();
        assertThat(attempts).hasValue(3);
        assertThat(tokens.findAll()).singleElement().extracting(token -> token.getId()).isEqualTo(last);
    }

    @Test
    void concurrentRequestsUseOnePersistedBudgetAndKeepOnlyNewestAuthority() throws Exception {
        User user = user();
        AtomicInteger attempts = new AtomicInteger();
        when(notification.sendRecovery(any(), any(), any(), any())).thenAnswer(invocation -> {
            attempts.incrementAndGet();
            return NotificationEmailClient.DeliveryResult.SENT;
        });
        try (var workers = Executors.newFixedThreadPool(5)) {
            var futures = new ConcurrentLinkedQueue<java.util.concurrent.Future<?>>();
            for (int index = 0; index < 5; index++) {
                futures.add(workers.submit(() -> auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()))));
            }
            for (var future : futures) future.get(15, TimeUnit.SECONDS);
        }
        idle();
        assertThat(tokens.count()).isEqualTo(1);
        assertThat(throttles.findAll()).singleElement().extracting(counter -> counter.getFailedCount()).isEqualTo(3);
        assertThat(attempts.get()).isBetween(1, 3);
    }

    @Test
    void throttleWindowCanExpireWithoutUnlimitedDuplicateSends() throws Exception {
        User user = user();
        for (int index = 0; index < 3; index++) {
            auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
            idle();
        }
        var counter = throttles.findAll().getFirst();
        counter.setWindowStartedAt(Instant.now().minus(Duration.ofMinutes(16)));
        throttles.saveAndFlush(counter);
        auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        idle();
        assertThat(throttles.findAll()).singleElement().extracting(value -> value.getFailedCount()).isEqualTo(1);
        assertThat(tokens.count()).isEqualTo(1);
    }

    @Test
    void publicLoginIdentifiersCannotManipulateTheRecoveryBudgetNamespace() throws Exception {
        User user = user();
        auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        idle();
        String recoveryKey = "PASSWORD_RECOVERY/v1/" + user.getId();
        for (int failure = 0; failure < 5; failure++) loginThrottle.recordFailure(recoveryKey);
        loginThrottle.reset(recoveryKey);
        assertThat(throttles.findById(recoveryKey).orElseThrow().getFailedCount()).isEqualTo(1);
        auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        idle();
        assertThat(throttles.findById(recoveryKey).orElseThrow().getFailedCount()).isEqualTo(2);
    }

    @Test
    void slowDeliveryDoesNotHoldAccountLockOrPreventPasswordChange() throws Exception {
        User user = user();
        CountDownLatch sending = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(notification.sendRecovery(any(), any(), any(), any())).thenAnswer(invocation -> {
            sending.countDown();
            assertThat(release.await(10, TimeUnit.SECONDS)).isTrue();
            return NotificationEmailClient.DeliveryResult.SENT;
        });
        try {
            auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
            assertThat(sending.await(5, TimeUnit.SECONDS)).isTrue();
            try (var worker = Executors.newSingleThreadExecutor()) {
                worker.submit(() -> auth.changePassword(user.getId(), new ChangePasswordRequest(
                        INITIAL_PASSWORD, "SyntheticReplacementPassword!30", "SyntheticReplacementPassword!30")))
                        .get(4, TimeUnit.SECONDS);
            }
            assertThat(tokens.count()).isZero();
        } finally {
            release.countDown();
        }
        idle();
    }

    @Test
    void revocationOfFailedOldDeliveryCannotDeleteNewerLink() throws Exception {
        User user = user();
        auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        idle();
        UUID old = tokens.findAll().getFirst().getId();
        auth.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        idle();
        UUID current = tokens.findAll().getFirst().getId();
        deliveryState.revoke(user.getId(), old);
        assertThat(tokens.findById(current)).isPresent();
        assertThat(tokens.findById(old)).isEmpty();
    }

    @Test
    void deliveryPreflightRejectsExpiredUsedDisabledAndChangedEmailState() {
        User user = user();
        PasswordResetToken token = new PasswordResetToken();
        token.setId(UUID.randomUUID());
        token.setUserId(user.getId());
        token.setTokenHash("synthetic-delivery-state-hash");
        token.setExpiresAt(Instant.now().minusSeconds(1));
        tokens.saveAndFlush(token);
        assertThat(deliveryState.isDeliverable(user.getId(), token.getId(), user.getEmail())).isFalse();
        token.setExpiresAt(Instant.now().plusSeconds(60));
        token.setUsedAt(Instant.now());
        tokens.saveAndFlush(token);
        assertThat(deliveryState.isDeliverable(user.getId(), token.getId(), user.getEmail())).isFalse();
        token.setUsedAt(null);
        tokens.saveAndFlush(token);
        assertThat(deliveryState.isDeliverable(user.getId(), token.getId(), user.getEmail())).isTrue();
        assertThat(deliveryState.isDeliverable(user.getId(), token.getId(), "other@example.test")).isFalse();
        user.setEnabled(false);
        users.saveAndFlush(user);
        assertThat(deliveryState.isDeliverable(user.getId(), token.getId(), user.getEmail())).isFalse();
    }

    private User user() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("recovery_" + user.getId().toString().substring(0, 8));
        user.setEmail(user.getId() + "@example.test");
        user.setPasswordHash(encoder.encode(INITIAL_PASSWORD));
        user.setRole(UserRole.LEARNER);
        user.setEnabled(true);
        return users.saveAndFlush(user);
    }

    private void idle() throws Exception {
        // getActiveCount()+queue sampling has a dequeue/beforeExecute gap. Count at decoration,
        // before submission returns, and release only after the complete real worker finishes.
        await(() -> workTracker.pending.get() == 0);
    }

    private static void await(BooleanSupplier condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
        boolean complete;
        while (!(complete = condition.getAsBoolean()) && System.nanoTime() < deadline) Thread.sleep(20);
        assertThat(complete).isTrue();
    }

    private static String hash(String raw) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    }

    static final class DeliveryWorkTracker {
        private final AtomicInteger pending = new AtomicInteger();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class WorkObservationConfiguration {
        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        static DeliveryWorkTracker deliveryWorkTracker() {
            return new DeliveryWorkTracker();
        }

        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        static BeanPostProcessor observeDeliveryWork(DeliveryWorkTracker tracker) {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessBeforeInitialization(Object bean, String name) {
                    if (name.equals("recoveryDeliveryExecutor") && bean instanceof ThreadPoolTaskExecutor executor) {
                        executor.setTaskDecorator(task -> {
                            tracker.pending.incrementAndGet();
                            return () -> {
                                try {
                                    task.run();
                                } finally {
                                    tracker.pending.decrementAndGet();
                                }
                            };
                        });
                    }
                    return bean;
                }
            };
        }
    }
}
