package com.learnup.notification.enrollment;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.config.EnrollmentEventsProperties;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

@Component
public class SubmissionFinalizedEventHandler {
    private static final String PERMANENT_TENANT_REFUSAL = "TENANT_REJECTED";
    private static final Logger log = LoggerFactory.getLogger(SubmissionFinalizedEventHandler.class);
    private final DeliveryLedger ledger;
    private final EnrollmentEventDeliveryRepository repository;
    private final EnrollmentEventsProperties ledgerProperties;
    private final NotificationService notifications;
    private final EmailDeliveryService emails;
    private final RecipientDirectory recipients;
    private final SubmissionFinalizedMessageTemplates templates;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public SubmissionFinalizedEventHandler(DeliveryLedger ledger, EnrollmentEventDeliveryRepository repository,
            EnrollmentEventsProperties ledgerProperties, NotificationService notifications,
            EmailDeliveryService emails, RecipientDirectory recipients, SubmissionFinalizedMessageTemplates templates,
            PlatformTransactionManager manager, Clock clock) {
        this.ledger = ledger;
        this.repository = repository;
        this.ledgerProperties = ledgerProperties;
        this.notifications = notifications;
        this.emails = emails;
        this.recipients = recipients;
        this.templates = templates;
        this.transaction = new TransactionTemplate(manager);
        this.clock = clock;
    }

    public void handle(SubmissionFinalizedEvent event) {
        handle(event, 1);
    }

    public void handle(SubmissionFinalizedEvent event, int blockingDeliveryAttempt) {
        for (EnrollmentEventDelivery row : repository.findByEventId(event.eventId())) {
            if (!event.organizationId().equals(row.getOrganizationId())
                    || !event.learnerId().equals(row.getRecipientUserId())
                    || !SubmissionFinalizedEvent.WIRE_NAME.equals(row.getEventType())) {
                throw new InvalidEventException("DELIVERY_SCOPE_MISMATCH");
            }
        }
        RuntimeException transientFailure = null;
        PermanentDeliveryException permanentFailure = null;
        for (DeliveryChannel channel : new DeliveryChannel[] {DeliveryChannel.IN_APP, DeliveryChannel.EMAIL}) {
            try {
                deliver(event, channel, blockingDeliveryAttempt > 1);
            } catch (InvalidEventException invalid) {
                throw invalid;
            } catch (PermanentDeliveryException permanent) {
                permanentFailure = permanent;
            } catch (RuntimeException transientError) {
                transientFailure = transientError;
            }
        }
        // A permanent channel failure must not shortcut the other channel's transient retries.
        if (transientFailure != null) throw transientFailure;
        if (permanentFailure != null) throw permanentFailure;
    }

    private void deliver(SubmissionFinalizedEvent event, DeliveryChannel channel, boolean automaticRetry) {
        EnrollmentEventDelivery row = ledger.open(event.eventId(), SubmissionFinalizedEvent.WIRE_NAME,
                event.organizationId(), null, event.learnerId(), channel, event.occurredAt(), now());
        Claim claim = claim(event, row.getId(), automaticRetry);
        if (claim == null) return;
        try {
            if (channel == DeliveryChannel.IN_APP) sendInApp(event, claim);
            else sendEmail(event, claim);
        } catch (RuntimeException failure) {
            String code = failure instanceof PermanentDeliveryException permanent ? permanent.code() : channel + "_FAILED";
            failIfOwned(claim, code);
            log.warn("event=submission_finalized_delivery_failed event_id={} channel={} reason={}",
                    event.eventId(), channel, code);
            if (failure instanceof PermanentDeliveryException || failure instanceof InvalidEventException) throw failure;
            // Do not propagate dependency exception text, addresses or database values to Kafka diagnostics.
            throw new DependencyUnavailableException("SUBMISSION_FINALIZED_DELIVERY_FAILED");
        }
    }

    /** Database precision plus attempt number identifies a claim without a schema change. */
    record Claim(UUID id, Instant claimedAt, int attempt) {}

    Claim claim(SubmissionFinalizedEvent event, UUID id) {
        return claim(event, id, false);
    }

    private Claim claim(SubmissionFinalizedEvent event, UUID id, boolean automaticRetry) {
        return transaction.execute(status -> {
            EnrollmentEventDelivery row = locked(id);
            if (!event.organizationId().equals(row.getOrganizationId())
                    || !SubmissionFinalizedEvent.WIRE_NAME.equals(row.getEventType())
                    || !event.learnerId().equals(row.getRecipientUserId())) {
                throw new InvalidEventException("DELIVERY_SCOPE_MISMATCH");
            }
            if (row.getStatus().isFinal()) return null;
            // Only Tenant currently supplies permanent channel refusals for this event.
            // First deliveries (including operator re-publication) retain the ability to retry them.
            if (automaticRetry && row.getStatus() == DeliveryStatus.FAILED
                    && PERMANENT_TENANT_REFUSAL.equals(row.getLastError())) {
                throw new PermanentDeliveryException(row.getLastError());
            }
            Instant now = now();
            if (!row.claimableAt(now, ledgerProperties.getClaimLease())) {
                throw new DependencyUnavailableException("DELIVERY_CLAIMED");
            }
            row.claimed(now);
            repository.saveAndFlush(row);
            return new Claim(row.getId(), row.getClaimedAt(), row.getAttempts());
        });
    }

    void sendInApp(SubmissionFinalizedEvent event, Claim claim) {
        transaction.executeWithoutResult(status -> {
            EnrollmentEventDelivery row = owned(claim);
            notifications.sendNotification(new CreateNotificationRequest(event.organizationId(), event.learnerId(),
                    SubmissionFinalizedMessageTemplates.TITLE, templates.text(event),
                    SubmissionFinalizedMessageTemplates.TYPE, "IN_APP", templates.metadata(event)));
            row.markSent(now());
            repository.saveAndFlush(row);
        });
    }

    private void sendEmail(SubmissionFinalizedEvent event, Claim claim) {
        Recipient recipient = recipients.find(event.organizationId(), event.learnerId()).orElse(null);
        if (recipient == null || !recipient.canBeWrittenTo()) {
            finish(claim, "RECIPIENT_UNAVAILABLE");
            return;
        }
        if (!recipient.hasEmail()) {
            finish(claim, "NO_EMAIL");
            return;
        }
        // Recheck after Tenant lookup; a slow lookup may have outlived the lease.
        transaction.executeWithoutResult(status -> owned(claim));
        EmailLogResponse result = emails.sendEmail(new SendEmailRequest(recipient.email(),
                "LearnUP - " + SubmissionFinalizedMessageTemplates.TITLE,
                templates.email(event, recipient.fullName()), SubmissionFinalizedMessageTemplates.TEMPLATE));
        if (result == null || !("SENT".equals(result.getStatus()) || "SIMULATED".equals(result.getStatus()))) {
            throw new DependencyUnavailableException("EMAIL_FAILED");
        }
        if ("SIMULATED".equals(result.getStatus())) {
            log.warn("event=submission_finalized_email_simulated event_id={}", event.eventId());
        }
        // SMTP cannot join this transaction: a crash before this write can resend email.
        finish(claim, null);
    }

    private void finish(Claim claim, String skipCode) {
        transaction.executeWithoutResult(status -> {
            EnrollmentEventDelivery row = owned(claim);
            if (skipCode == null) row.markSent(now());
            else row.markSkipped(skipCode, now());
            repository.saveAndFlush(row);
        });
    }

    void failIfOwned(Claim claim, String code) {
        transaction.executeWithoutResult(status -> {
            EnrollmentEventDelivery row = locked(claim.id());
            if (isOwned(row, claim)) {
                row.markFailed(code, now());
                repository.saveAndFlush(row);
            }
        });
    }

    private EnrollmentEventDelivery owned(Claim claim) {
        EnrollmentEventDelivery row = locked(claim.id());
        if (!isOwned(row, claim)) throw new DependencyUnavailableException("DELIVERY_CLAIM_LOST");
        return row;
    }

    private boolean isOwned(EnrollmentEventDelivery row, Claim claim) {
        return row.getStatus() == DeliveryStatus.PROCESSING && row.getAttempts() == claim.attempt()
                && Objects.equals(row.getClaimedAt(), claim.claimedAt());
    }

    private EnrollmentEventDelivery locked(UUID id) {
        return repository.lockById(id).orElseThrow(() -> new DependencyUnavailableException("DELIVERY_MISSING"));
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
