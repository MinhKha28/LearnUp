package com.learnup.identity.service;

import com.learnup.identity.client.NotificationEmailClient;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.config.PasswordRecoveryProperties;
import com.learnup.identity.security.AuthenticationDiagnostics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.UUID;

@Service
public class PasswordRecoveryDelivery {
    private static final Logger log = LoggerFactory.getLogger(PasswordRecoveryDelivery.class);
    private final TaskExecutor executor;
    private final RecoveryDeliveryState state;
    private final TenantAccessClient tenant;
    private final NotificationEmailClient notification;
    private final PasswordRecoveryProperties properties;
    private final boolean enabled;

    public PasswordRecoveryDelivery(@Qualifier("recoveryDeliveryExecutor") TaskExecutor executor,
                                    RecoveryDeliveryState state, TenantAccessClient tenant,
                                    NotificationEmailClient notification, PasswordRecoveryProperties properties,
                                    @Value("${learnup.recovery.delivery-enabled:true}") boolean enabled) {
        this.executor = executor;
        this.state = state;
        this.tenant = tenant;
        this.notification = notification;
        this.properties = properties;
        this.enabled = enabled;
    }

    public void scheduleAfterCommit(UUID userId, String email, UUID tokenId, String rawToken,
                                    Instant expiresAt, String correlationId) {
        String safeCorrelationId = AuthenticationDiagnostics.isCorrelationId(correlationId) ? correlationId : "unavailable";
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException("Recovery delivery requires a token transaction");
        }
        if (!enabled) {
            log.info("event=password_recovery_delivery outcome=DISABLED user_id={} correlation_id={}", userId, safeCorrelationId);
            return;
        }
        // Raw authority lives only in bounded process memory, never a database outbox or generated toString.
        PendingDelivery pending = new PendingDelivery(userId, email, tokenId, rawToken, expiresAt, safeCorrelationId);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    executor.execute(() -> deliver(pending));
                } catch (RuntimeException rejected) {
                    fail(pending, "QUEUE_REJECTED");
                }
            }
        });
    }

    private void deliver(PendingDelivery pending) {
        try {
            if (!state.isDeliverable(pending.userId, pending.tokenId, pending.email)) {
                fail(pending, "OBSOLETE");
                return;
            }
            if (!tenant.check(pending.userId).allowed()) {
                fail(pending, "ACCOUNT_UNAVAILABLE");
                return;
            }
            // Policy lookup may be slow; re-check that this is still the current, unexpired link.
            if (!state.isDeliverable(pending.userId, pending.tokenId, pending.email)) {
                fail(pending, "OBSOLETE");
                return;
            }
            NotificationEmailClient.DeliveryResult result = notification.sendRecovery(pending.email,
                    properties.recoveryUrl(pending.rawToken), pending.expiresAt, pending.correlationId);
            if (result != NotificationEmailClient.DeliveryResult.SENT) {
                fail(pending, result.name());
                return;
            }
            log.info("event=password_recovery_delivery outcome=SENT user_id={} correlation_id={}",
                    pending.userId, pending.correlationId);
        } catch (RuntimeException failure) {
            // Exceptions may contain HTTP bodies/headers; never attach them to authentication logs.
            fail(pending, "DEPENDENCY_FAILURE");
        }
    }

    private void fail(PendingDelivery pending, String reason) {
        log.warn("event=password_recovery_delivery outcome={} user_id={} correlation_id={}",
                reason, pending.userId, pending.correlationId);
        try {
            state.revoke(pending.userId, pending.tokenId);
        } catch (RuntimeException failure) {
            log.error("event=password_recovery_revocation outcome=FAILED user_id={} correlation_id={}",
                    pending.userId, pending.correlationId);
        }
    }

    private static final class PendingDelivery {
        private final UUID userId;
        private final String email;
        private final UUID tokenId;
        private final String rawToken;
        private final Instant expiresAt;
        private final String correlationId;

        private PendingDelivery(UUID userId, String email, UUID tokenId, String rawToken, Instant expiresAt, String correlationId) {
            this.userId = userId;
            this.email = email;
            this.tokenId = tokenId;
            this.rawToken = rawToken;
            this.expiresAt = expiresAt;
            this.correlationId = correlationId;
        }

        @Override
        public String toString() {
            return "PendingRecoveryDelivery[REDACTED]";
        }
    }
}
