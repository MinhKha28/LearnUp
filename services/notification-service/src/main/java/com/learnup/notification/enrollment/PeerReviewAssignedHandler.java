package com.learnup.notification.enrollment;

import com.learnup.notification.client.OrganizationTimeZones;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.config.EnrollmentEventsProperties;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;

/**
 * What the service does with a {@code PeerReviewAssigned} event: tells the reviewer in the app and by e-mail, once.
 * It follows the same rules as {@link EnrollmentEventHandler} (see there): a row of the ledger for each person and
 * channel, claimed before anything is sent, so a repeated event sends nothing again and a failed channel is the only one
 * tried again; a service that does not answer is tried again later; every error is kept as a fixed code. The ledger
 * row has no Enrollment (this event is about a cycle), and the event carries the title of the Assignment, so no
 * other service is asked about it.
 */
@Service
public class PeerReviewAssignedHandler {

    private static final Logger log = LoggerFactory.getLogger(PeerReviewAssignedHandler.class);

    private final DeliveryLedger ledger;
    private final RecipientDirectory recipients;
    private final PeerReviewMessageTemplates templates;
    private final OrganizationTimeZones zones;
    private final ChannelDelivery channels;
    private final EnrollmentEventsProperties properties;
    private final Clock clock;

    public PeerReviewAssignedHandler(DeliveryLedger ledger, RecipientDirectory recipients,
                                     PeerReviewMessageTemplates templates, OrganizationTimeZones zones,
                                     NotificationService notifications, EmailDeliveryService emails,
                                     PlatformTransactionManager transactionManager,
                                     EnrollmentEventsProperties properties, Clock clock) {
        this.ledger = ledger;
        this.recipients = recipients;
        this.templates = templates;
        this.zones = zones;
        this.channels = new ChannelDelivery(ledger, notifications, emails, new TransactionTemplate(transactionManager), clock);
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * @throws DependencyUnavailableException when something has to be tried again (a service that does not answer, a
     *                                        channel that failed); the rows already say what is left to do
     */
    public void handle(PeerReviewAssignedEvent event) {
        Instant now = clock.instant();
        EnrollmentEventDelivery inApp = open(event, DeliveryChannel.IN_APP, now);
        EnrollmentEventDelivery email = open(event, DeliveryChannel.EMAIL, now);
        List<EnrollmentEventDelivery> owned = Stream.of(inApp, email)
                .filter(row -> !row.getStatus().isFinal())
                .filter(row -> ledger.claim(row, now))
                .toList();
        if (owned.isEmpty()) {
            log.info("event=peer_review_assigned_ignored reason=ALREADY_HANDLED_OR_CLAIMED event_id={}", event.eventId());
            return;
        }
        try {
            deliver(event, now, owned, owned.contains(inApp) ? inApp : null, owned.contains(email) ? email : null);
        } finally {
            channels.releaseUnfinished(owned);
        }
    }

    private EnrollmentEventDelivery open(PeerReviewAssignedEvent event, DeliveryChannel channel, Instant now) {
        return ledger.open(event.eventId(), PeerReviewAssignedEvent.WIRE_NAME, event.organizationId(), null,
                event.reviewerId(), channel, event.occurredAt(), now);
    }

    /** Works on the rows this handler owns; every one of them leaves PROCESSING before this returns. */
    private void deliver(PeerReviewAssignedEvent event, Instant now, List<EnrollmentEventDelivery> open,
                         EnrollmentEventDelivery inApp, EnrollmentEventDelivery email) {
        if (Duration.between(event.occurredAt(), now).compareTo(properties.getMaxAge()) > 0) {
            channels.skip(open, "EVENT_TOO_OLD");
            log.info("event=peer_review_assigned_skipped reason=EVENT_TOO_OLD event_id={}", event.eventId());
            return;
        }

        Recipient recipient;
        try {
            recipient = recipients.find(event.organizationId(), event.reviewerId()).orElse(null);
            if (recipient == null || !recipient.canBeWrittenTo()) {
                channels.skip(open, "RECIPIENT_UNAVAILABLE");
                log.info("event=peer_review_assigned_skipped reason=RECIPIENT_UNAVAILABLE event_id={}", event.eventId());
                return;
            }
        } catch (DependencyUnavailableException unavailable) {
            channels.fail(open, unavailable.code());
            log.warn("event=peer_review_assigned_retry reason={} event_id={}", unavailable.code(), event.eventId());
            throw unavailable;
        } catch (PermanentDeliveryException refused) {
            channels.fail(open, refused.code());
            log.error("event=peer_review_assigned_failed reason={} event_id={}", refused.code(), event.eventId());
            return;
        }

        EnrollmentMessage message = templates.render(event, recipient.fullName(), zones.of(event.organizationId()));
        boolean failed = false;
        if (inApp != null) {
            failed |= !channels.sendInApp(event.organizationId(), event.reviewerId(), inApp, message);
        }
        if (email != null) {
            failed |= !channels.sendEmail(email, recipient, message);
        }
        if (failed) {
            log.warn("event=peer_review_assigned_retry reason=DELIVERY_FAILED event_id={}", event.eventId());
            throw new DependencyUnavailableException("DELIVERY_FAILED");
        }
        log.info("event=peer_review_assigned_handled event_id={}", event.eventId());
    }
}
