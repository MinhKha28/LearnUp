package com.learnup.notification.enrollment;

import com.learnup.notification.client.CourseDirectory;
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
 * What the service does with one enrollment event: tells the Learner in the app and by e-mail, once.
 * <p>
 * It knows nothing of Kafka. Every delivery has a row in the ledger (event, person, channel), so an event that comes
 * again sends nothing again, and a delivery that failed is the only one tried again. A service that does not answer
 * (tenant, course, SMTP) throws {@link DependencyUnavailableException} after the rows say so, and the caller tries the
 * event again later; a refusal is recorded and not retried. Errors are stored as fixed codes, never as text of an
 * exception or of a payload.
 * <p>
 * Before anything is looked up or sent, the handler claims each open row ({@link DeliveryLedger#claim}: the row is
 * locked, checked and set to PROCESSING in one transaction). Only the handler that wins a row works on it; a second handler on the same event (two
 * consumers during a rebalance, or one evicted while it still runs) finds the row held and sends nothing. A claim that
 * is older than the lease is taken over, so a handler that died does not block the event for ever.
 * <p>
 * The in-app notice and the mark SENT of its row are written in one transaction, so it cannot be written twice. An
 * e-mail cannot be part of a database transaction: if the process stops between the SMTP server accepting it and the
 * row saying SENT, the Learner may get that one mail twice (delivery is at least once).
 */
@Service
public class EnrollmentEventHandler {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentEventHandler.class);

    private final DeliveryLedger ledger;
    private final RecipientDirectory recipients;
    private final CourseDirectory courses;
    private final EnrollmentMessageTemplates templates;
    private final OrganizationTimeZones zones;
    private final ChannelDelivery channels;
    private final EnrollmentEventsProperties properties;
    private final Clock clock;

    public EnrollmentEventHandler(DeliveryLedger ledger, RecipientDirectory recipients, CourseDirectory courses,
                                  EnrollmentMessageTemplates templates, OrganizationTimeZones zones,
                                  NotificationService notifications, EmailDeliveryService emails,
                                  PlatformTransactionManager transactionManager, EnrollmentEventsProperties properties,
                                  Clock clock) {
        this.ledger = ledger;
        this.recipients = recipients;
        this.courses = courses;
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
    public void handle(EnrollmentEvent event) {
        if (event.type() == EnrollmentEventType.WITHDREW) {
            // Nobody is written to for a withdrawal (decision D2 of 23/10).
            log.info("event=enrollment_event_ignored reason=NO_RECIPIENT event_id={} type={}", event.eventId(), event.type());
            return;
        }

        Instant now = clock.instant();
        EnrollmentEventDelivery inApp = ledger.open(event, event.learnerId(), DeliveryChannel.IN_APP, now);
        EnrollmentEventDelivery email = ledger.open(event, event.learnerId(), DeliveryChannel.EMAIL, now);
        List<EnrollmentEventDelivery> owned = Stream.of(inApp, email)
                .filter(row -> !row.getStatus().isFinal())
                .filter(row -> ledger.claim(row, now))
                .toList();
        if (owned.isEmpty()) {
            log.info("event=enrollment_event_ignored reason=ALREADY_HANDLED_OR_CLAIMED event_id={} type={}", event.eventId(), event.type());
            return;
        }
        try {
            deliver(event, now, owned, owned.contains(inApp) ? inApp : null, owned.contains(email) ? email : null);
        } finally {
            channels.releaseUnfinished(owned);
        }
    }

    /** Works on the rows this handler owns; every one of them leaves PROCESSING before this returns. */
    private void deliver(EnrollmentEvent event, Instant now, List<EnrollmentEventDelivery> open,
                         EnrollmentEventDelivery inApp, EnrollmentEventDelivery email) {
        if (Duration.between(event.occurredAt(), now).compareTo(properties.getMaxAge()) > 0) {
            channels.skip(open, "EVENT_TOO_OLD");
            log.info("event=enrollment_event_skipped reason=EVENT_TOO_OLD event_id={} type={}", event.eventId(), event.type());
            return;
        }

        Recipient recipient;
        String courseName;
        try {
            recipient = recipients.find(event.organizationId(), event.learnerId()).orElse(null);
            if (recipient == null || !recipient.canBeWrittenTo()) {
                channels.skip(open, "RECIPIENT_UNAVAILABLE");
                log.info("event=enrollment_event_skipped reason=RECIPIENT_UNAVAILABLE event_id={} type={}", event.eventId(), event.type());
                return;
            }
            courseName = courses.nameOf(event.organizationId(), event.courseId()).orElse(null);
        } catch (DependencyUnavailableException unavailable) {
            channels.fail(open, unavailable.code());
            log.warn("event=enrollment_event_retry reason={} event_id={} type={}", unavailable.code(), event.eventId(), event.type());
            throw unavailable;
        } catch (PermanentDeliveryException refused) {
            channels.fail(open, refused.code());
            log.error("event=enrollment_event_failed reason={} event_id={} type={}", refused.code(), event.eventId(), event.type());
            return;
        }

        EnrollmentMessage message = templates
                .render(event, courseName, recipient.fullName(), zones.of(event.organizationId()))
                .orElse(null);
        if (message == null) {
            channels.skip(open, "NO_MESSAGE");
            return;
        }

        boolean failed = false;
        if (inApp != null) {
            failed |= !channels.sendInApp(event.organizationId(), event.learnerId(), inApp, message);
        }
        if (email != null) {
            failed |= !channels.sendEmail(email, recipient, message);
        }
        if (failed) {
            log.warn("event=enrollment_event_retry reason=DELIVERY_FAILED event_id={} type={}", event.eventId(), event.type());
            throw new DependencyUnavailableException("DELIVERY_FAILED");
        }
        log.info("event=enrollment_event_handled event_id={} type={}", event.eventId(), event.type());
    }
}
