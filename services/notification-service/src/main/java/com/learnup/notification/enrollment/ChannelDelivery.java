package com.learnup.notification.enrollment;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

/**
 * How one row of the delivery ledger is worked on, the same for every kind of event: the in-app notice and the mark SENT
 * of its row are written in one transaction, an e-mail is sent and then its row is marked, and a row ends SENT,
 * SKIPPED or FAILED with a fixed code, never with text from an exception or a payload. The handlers of the events
 * (what to say, to whom) decide which rows to open and claim; this class only does the sending.
 */
class ChannelDelivery {

    private final DeliveryLedger ledger;
    private final NotificationService notifications;
    private final EmailDeliveryService emails;
    private final TransactionTemplate transaction;
    private final Clock clock;

    ChannelDelivery(DeliveryLedger ledger, NotificationService notifications, EmailDeliveryService emails,
                    TransactionTemplate transaction, Clock clock) {
        this.ledger = ledger;
        this.notifications = notifications;
        this.emails = emails;
        this.transaction = transaction;
        this.clock = clock;
    }

    boolean sendInApp(UUID organizationId, UUID recipientUserId, EnrollmentEventDelivery delivery,
                      EnrollmentMessage message) {
        try {
            transaction.executeWithoutResult(status -> {
                notifications.sendNotification(new CreateNotificationRequest(organizationId, recipientUserId,
                        message.title(), message.text(), message.type(), DeliveryChannel.IN_APP.name(), message.metadata()));
                delivery.markSent(clock.instant());
                ledger.record(delivery);
            });
            return true;
        } catch (RuntimeException e) {
            delivery.markFailed("IN_APP_FAILED", clock.instant());
            ledger.record(delivery);
            return false;
        }
    }

    boolean sendEmail(EnrollmentEventDelivery delivery, Recipient recipient, EnrollmentMessage message) {
        if (!recipient.hasEmail()) {
            delivery.markSkipped("NO_EMAIL", clock.instant());
            ledger.record(delivery);
            return true;
        }
        try {
            EmailLogResponse result = emails.sendEmail(new SendEmailRequest(
                    recipient.email(), message.emailSubject(), message.emailHtml(), message.type()));
            if (result != null && "FAILED".equals(result.getStatus())) {
                delivery.markFailed("EMAIL_FAILED", clock.instant());
                ledger.record(delivery);
                return false;
            }
            delivery.markSent(clock.instant());
            ledger.record(delivery);
            return true;
        } catch (RuntimeException e) {
            delivery.markFailed("EMAIL_FAILED", clock.instant());
            ledger.record(delivery);
            return false;
        }
    }

    void skip(List<EnrollmentEventDelivery> rows, String code) {
        for (EnrollmentEventDelivery row : rows) {
            row.markSkipped(code, clock.instant());
            ledger.record(row);
        }
    }

    void fail(List<EnrollmentEventDelivery> rows, String code) {
        for (EnrollmentEventDelivery row : rows) {
            row.markFailed(code, clock.instant());
            ledger.record(row);
        }
    }

    /**
     * A row still PROCESSING here means the handling stopped on something unforeseen (an exception nobody caught). It is
     * set to FAILED with a fixed code so that the next try can take it at once, instead of waiting for the lease.
     */
    void releaseUnfinished(List<EnrollmentEventDelivery> rows) {
        for (EnrollmentEventDelivery row : rows) {
            if (row.getStatus() == DeliveryStatus.PROCESSING) {
                try {
                    row.markFailed("INTERRUPTED", clock.instant());
                    ledger.record(row);
                } catch (RuntimeException ignored) {
                    // The lease frees the row if even this write fails; the original failure is the one that matters.
                }
            }
        }
    }
}
