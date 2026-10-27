package com.learnup.notification.enrollment;

import com.learnup.notification.client.CourseDirectory;
import com.learnup.notification.client.OrganizationTimeZones;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.config.EnrollmentEventsProperties;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EmailLog;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class EnrollmentEventHandlerTest {

    private static final Instant NOW = Instant.parse("2026-10-27T03:00:00Z");
    private static final UUID ORG = UUID.fromString("cda775cb-4d21-410d-979f-c94c8ec8b516");
    private static final UUID LEARNER = UUID.fromString("188aa316-ed75-4fcb-a879-4dd3ad000a8a");
    private static final UUID COURSE = UUID.fromString("b2ab8537-2234-4407-93ff-aff997ff4da9");
    private static final UUID ENROLLMENT = UUID.fromString("8eb38a24-7b2d-4598-a477-cb31f0ef2a84");
    private static final Instant DUE = Instant.parse("2026-11-30T17:00:00Z");

    /** The ledger in memory: the same rows come back for the same event, person and channel. */
    static class InMemoryLedger implements DeliveryLedger {
        final Map<String, EnrollmentEventDelivery> rows = new HashMap<>();
        final List<String> order = new ArrayList<>();

        @Override
        public EnrollmentEventDelivery open(EnrollmentEvent event, UUID recipient, DeliveryChannel channel, Instant now) {
            return rows.computeIfAbsent(event.eventId() + "/" + recipient + "/" + channel, key -> {
                order.add(key);
                return new EnrollmentEventDelivery(event.eventId(), event.type().wireName(), event.organizationId(),
                        event.enrollmentId(), recipient, channel, event.occurredAt(), now);
            });
        }

        @Override
        public void record(EnrollmentEventDelivery delivery) {
            // rows are mutable objects held here: nothing to store
        }

        EnrollmentEventDelivery row(EnrollmentEvent event, DeliveryChannel channel) {
            return rows.get(event.eventId() + "/" + event.learnerId() + "/" + channel);
        }
    }

    static class NoopTransactions implements PlatformTransactionManager {
        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
        }

        @Override
        public void rollback(TransactionStatus status) {
        }
    }

    private final InMemoryLedger ledger = new InMemoryLedger();
    private final AtomicReference<Object> recipientAnswer = new AtomicReference<>();
    private final AtomicReference<Object> courseAnswer = new AtomicReference<>();
    private final List<String> lookups = new ArrayList<>();
    private final NotificationService notifications = mock(NotificationService.class);
    private final EmailDeliveryService emails = mock(EmailDeliveryService.class);
    private final EnrollmentEventsProperties properties = new EnrollmentEventsProperties();
    private EnrollmentEventHandler handler;

    @BeforeEach
    void setUp() {
        recipientAnswer.set(Optional.of(new Recipient(LEARNER, "Nguyễn Văn An", "an@example.com", "Active")));
        courseAnswer.set(Optional.of("An toàn lao động"));
        RecipientDirectory recipients = (org, user) -> {
            lookups.add("tenant");
            return answer(recipientAnswer);
        };
        CourseDirectory courses = (org, course) -> {
            lookups.add("course");
            return answer(courseAnswer);
        };
        OrganizationTimeZones zones = org -> ZoneId.of("Asia/Ho_Chi_Minh");
        when(emails.sendEmail(any())).thenReturn(emailResult("SENT"));
        handler = new EnrollmentEventHandler(ledger, recipients, courses, new EnrollmentMessageTemplates(), zones,
                notifications, emails, new NoopTransactions(), properties, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @SuppressWarnings("unchecked")
    private static <T> T answer(AtomicReference<Object> reference) {
        Object value = reference.get();
        if (value instanceof RuntimeException exception) {
            throw exception;
        }
        return (T) value;
    }

    private static EmailLogResponse emailResult(String status) {
        return EmailLogResponse.fromEntity(new EmailLog(UUID.randomUUID(), "an@example.com", "s", status, null, NOW));
    }

    private static EnrollmentEvent assigned(Instant occurredAt) {
        return new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.ASSIGNED, occurredAt, ORG, ENROLLMENT, LEARNER,
                COURSE, AssignmentKind.CREATE, DUE, null, null, null);
    }

    private static EnrollmentEvent assigned() {
        return assigned(NOW.minusSeconds(60));
    }

    // ---- the normal case

    @Test
    void anAssignmentIsToldToTheLearnerInTheAppAndByEmail() {
        EnrollmentEvent event = assigned();

        handler.handle(event);

        ArgumentCaptor<CreateNotificationRequest> inApp = ArgumentCaptor.forClass(CreateNotificationRequest.class);
        verify(notifications).sendNotification(inApp.capture());
        assertThat(inApp.getValue().getOrganizationId()).isEqualTo(ORG);
        assertThat(inApp.getValue().getRecipientUserId()).isEqualTo(LEARNER);
        assertThat(inApp.getValue().getTitle()).isEqualTo("Bạn được giao một khóa học");
        assertThat(inApp.getValue().getMessage())
                .isEqualTo("Bạn được giao khóa học «An toàn lao động». Hạn hoàn thành: hết ngày 30/11/2026.");
        assertThat(inApp.getValue().getType()).isEqualTo("ENROLLMENT_ASSIGNED");
        assertThat(inApp.getValue().getChannel()).isEqualTo("IN_APP");
        assertThat(inApp.getValue().getMetadata()).contains(ENROLLMENT.toString()).contains(COURSE.toString());

        ArgumentCaptor<SendEmailRequest> email = ArgumentCaptor.forClass(SendEmailRequest.class);
        verify(emails).sendEmail(email.capture());
        assertThat(email.getValue().getRecipientEmail()).isEqualTo("an@example.com");
        assertThat(email.getValue().getSubject()).isEqualTo("Bạn được giao một khóa học");
        assertThat(email.getValue().getBody()).contains("Xin chào Nguyễn Văn An").contains("An toàn lao động");
        assertThat(email.getValue().getTemplateCode()).isEqualTo("ENROLLMENT_ASSIGNED");

        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getAttempts()).isEqualTo(1);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).isNull();
    }

    @Test
    void aMailThatIsOnlySimulatedBecauseMailIsOffCountsAsDone() {
        when(emails.sendEmail(any())).thenReturn(emailResult("SIMULATED"));
        EnrollmentEvent event = assigned();
        handler.handle(event);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test
    void aWithdrawalWritesToNobodyAndAsksNobody() {
        EnrollmentEvent event = new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.WITHDREW, NOW.minusSeconds(60),
                ORG, ENROLLMENT, LEARNER, COURSE, null, null, null, null, null);

        handler.handle(event);

        verifyNoInteractions(notifications, emails);
        assertThat(lookups).isEmpty();
        assertThat(ledger.rows).isEmpty();
    }

    // ---- the same event twice

    @Test
    void theSameEventAgainSendsNothingAndAsksNobody() {
        EnrollmentEvent event = assigned();
        handler.handle(event);
        lookups.clear();

        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any());
        verify(emails, times(1)).sendEmail(any());
        assertThat(lookups).isEmpty();
        assertThat(ledger.rows).hasSize(2);
    }

    // ---- an event that is too old

    @Test
    void anEventOlderThanTheMaximumAgeIsSkippedAndNothingIsSent() {
        EnrollmentEvent event = assigned(NOW.minus(properties.getMaxAge()).minusSeconds(1));

        handler.handle(event);

        verifyNoInteractions(notifications, emails);
        assertThat(lookups).isEmpty();
        for (DeliveryChannel channel : DeliveryChannel.values()) {
            assertThat(ledger.row(event, channel).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
            assertThat(ledger.row(event, channel).getLastError()).isEqualTo("EVENT_TOO_OLD");
        }
    }

    @Test
    void anEventExactlyAsOldAsTheMaximumAgeIsStillSent() {
        properties.setMaxAge(Duration.ofHours(72));
        EnrollmentEvent event = assigned(NOW.minus(Duration.ofHours(72)));
        handler.handle(event);
        verify(notifications).sendNotification(any());
    }

    // ---- the person is not there

    @Test
    void aLearnerTheOrganizationDoesNotHaveIsSkipped() {
        recipientAnswer.set(Optional.empty());
        EnrollmentEvent event = assigned();

        handler.handle(event);

        verifyNoInteractions(notifications, emails);
        for (DeliveryChannel channel : DeliveryChannel.values()) {
            assertThat(ledger.row(event, channel).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
            assertThat(ledger.row(event, channel).getLastError()).isEqualTo("RECIPIENT_UNAVAILABLE");
        }
    }

    @Test
    void aDeletedOrDeactivatedLearnerIsSkipped() {
        for (String status : new String[]{"Deleted", "Deactivated"}) {
            recipientAnswer.set(Optional.of(new Recipient(LEARNER, "A", "a@example.com", status)));
            EnrollmentEvent event = assigned();
            handler.handle(event);
            assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).as(status).isEqualTo("RECIPIENT_UNAVAILABLE");
        }
        verifyNoInteractions(notifications, emails);
    }

    @Test
    void aLearnerWithoutAnEmailStillGetsTheNoticeInTheApp() {
        recipientAnswer.set(Optional.of(new Recipient(LEARNER, "A", " ", "Active")));
        EnrollmentEvent event = assigned();

        handler.handle(event);

        verify(notifications).sendNotification(any());
        verifyNoInteractions(emails);
        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).isEqualTo("NO_EMAIL");
    }

    // ---- a service is down, then back

    @Test
    void whenTenantIsDownTheEventIsRetriedAndThenSentOnce() {
        recipientAnswer.set(new DependencyUnavailableException("TENANT_UNAVAILABLE"));
        EnrollmentEvent event = assigned();

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);

        verifyNoInteractions(notifications, emails);
        for (DeliveryChannel channel : DeliveryChannel.values()) {
            assertThat(ledger.row(event, channel).getStatus()).isEqualTo(DeliveryStatus.FAILED);
            assertThat(ledger.row(event, channel).getLastError()).isEqualTo("TENANT_UNAVAILABLE");
        }

        recipientAnswer.set(Optional.of(new Recipient(LEARNER, "Nguyễn Văn An", "an@example.com", "Active")));
        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any());
        verify(emails, times(1)).sendEmail(any());
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).isNull();
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getAttempts()).isEqualTo(2);
    }

    @Test
    void whenCourseServiceIsDownTheEventIsRetriedToo() {
        courseAnswer.set(new DependencyUnavailableException("COURSE_UNAVAILABLE"));
        EnrollmentEvent event = assigned();

        assertThatThrownBy(() -> handler.handle(event))
                .isInstanceOfSatisfying(DependencyUnavailableException.class,
                        e -> assertThat(e.code()).isEqualTo("COURSE_UNAVAILABLE"));
        verifyNoInteractions(notifications, emails);
        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getLastError()).isEqualTo("COURSE_UNAVAILABLE");
    }

    @Test
    void aCourseThatCourseServiceDoesNotKnowIsNotAReasonToStayQuiet() {
        courseAnswer.set(Optional.empty());
        EnrollmentEvent event = assigned();

        handler.handle(event);

        ArgumentCaptor<CreateNotificationRequest> inApp = ArgumentCaptor.forClass(CreateNotificationRequest.class);
        verify(notifications).sendNotification(inApp.capture());
        assertThat(inApp.getValue().getMessage()).startsWith("Bạn được giao một khóa học.");
    }

    @Test
    void aRefusalIsRecordedAsFailedAndNotRetried() {
        recipientAnswer.set(new PermanentDeliveryException("TENANT_REJECTED"));
        EnrollmentEvent event = assigned();

        handler.handle(event); // no exception: trying again cannot help

        verifyNoInteractions(notifications, emails);
        for (DeliveryChannel channel : DeliveryChannel.values()) {
            assertThat(ledger.row(event, channel).getStatus()).isEqualTo(DeliveryStatus.FAILED);
            assertThat(ledger.row(event, channel).getLastError()).isEqualTo("TENANT_REJECTED");
        }
    }

    // ---- the sending itself fails

    @Test
    void whenTheEmailFailsOnlyTheEmailIsTriedAgain() {
        when(emails.sendEmail(any())).thenReturn(emailResult("FAILED"));
        EnrollmentEvent event = assigned();

        assertThatThrownBy(() -> handler.handle(event))
                .isInstanceOfSatisfying(DependencyUnavailableException.class,
                        e -> assertThat(e.code()).isEqualTo("DELIVERY_FAILED"));
        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).isEqualTo("EMAIL_FAILED");

        when(emails.sendEmail(any())).thenReturn(emailResult("SENT"));
        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any());
        verify(emails, times(2)).sendEmail(any());
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test
    void anExceptionOfTheMailerNeverEndsUpInTheRecordedError() {
        when(emails.sendEmail(any())).thenThrow(new IllegalStateException("smtp password is hunter2"));
        EnrollmentEvent event = assigned();

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);

        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).isEqualTo("EMAIL_FAILED");
    }

    @Test
    void whenTheNoticeInTheAppFailsTheEmailIsStillSentAndOnlyTheNoticeIsTriedAgain() {
        when(notifications.sendNotification(any())).thenThrow(new IllegalStateException("database is down"))
                .thenReturn(null);
        EnrollmentEvent event = assigned();

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getLastError()).isEqualTo("IN_APP_FAILED");
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);

        handler.handle(event);

        verify(notifications, times(2)).sendNotification(any());
        verify(emails, times(1)).sendEmail(any());
        assertThat(ledger.row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    // ---- the other events

    @Test
    void anExtensionAndAnExemptionAreTold() {
        EnrollmentEvent extension = new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.DUE_DATE_EXTENDED,
                NOW.minusSeconds(60), ORG, ENROLLMENT, LEARNER, COURSE, null, null, DUE, DUE.plus(Duration.ofDays(7)), "Bận");
        EnrollmentEvent exemption = new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.EXEMPTED,
                NOW.minusSeconds(60), ORG, ENROLLMENT, LEARNER, COURSE, null, null, null, null, "Đã có chứng chỉ");

        handler.handle(extension);
        handler.handle(exemption);

        ArgumentCaptor<CreateNotificationRequest> inApp = ArgumentCaptor.forClass(CreateNotificationRequest.class);
        verify(notifications, times(2)).sendNotification(inApp.capture());
        assertThat(inApp.getAllValues().get(0).getType()).isEqualTo("ENROLLMENT_DUE_DATE_EXTENDED");
        assertThat(inApp.getAllValues().get(1).getType()).isEqualTo("ENROLLMENT_EXEMPTED");
        verify(emails, times(2)).sendEmail(any());
    }

    @Test
    void theWordsOfTheMessageAreNeverStoredInTheRecordedError() {
        recipientAnswer.set(new DependencyUnavailableException("TENANT_UNAVAILABLE"));
        EnrollmentEvent event = assigned();
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        verify(notifications, never()).sendNotification(any());
        assertThat(ledger.row(event, DeliveryChannel.EMAIL).getLastError()).matches("[A-Z_]+");
    }
}
