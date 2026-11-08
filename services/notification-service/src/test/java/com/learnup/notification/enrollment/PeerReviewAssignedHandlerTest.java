package com.learnup.notification.enrollment;

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
import com.learnup.notification.enrollment.EnrollmentEventHandlerTest.InMemoryLedger;
import com.learnup.notification.enrollment.EnrollmentEventHandlerTest.NoopTransactions;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
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

/** BR-232: what the service does with a PeerReviewAssigned event, with the ledger in memory and the senders as mocks. */
class PeerReviewAssignedHandlerTest {

    private static final Instant NOW = Instant.parse("2026-11-07T03:00:00Z");
    private static final UUID ORG = UUID.fromString("cda775cb-4d21-410d-979f-c94c8ec8b516");
    private static final UUID REVIEWER = UUID.fromString("188aa316-ed75-4fcb-a879-4dd3ad000a8a");
    private static final UUID ASSESSMENT = UUID.fromString("b2ab8537-2234-4407-93ff-aff997ff4da9");
    private static final UUID CYCLE = UUID.fromString("8eb38a24-7b2d-4598-a477-cb31f0ef2a84");
    private static final Instant DUE = Instant.parse("2026-11-10T17:00:00Z");

    private final InMemoryLedger ledger = new InMemoryLedger();
    private final AtomicReference<Object> recipientAnswer = new AtomicReference<>();
    private final List<String> lookups = new ArrayList<>();
    private final NotificationService notifications = mock(NotificationService.class);
    private final EmailDeliveryService emails = mock(EmailDeliveryService.class);
    private final EnrollmentEventsProperties properties = new EnrollmentEventsProperties();
    private PeerReviewAssignedHandler handler;

    @BeforeEach
    void setUp() {
        recipientAnswer.set(Optional.of(new Recipient(REVIEWER, "Nguyễn Văn An", "an@example.com", "Active")));
        RecipientDirectory recipients = (org, user) -> {
            lookups.add("tenant");
            return answer(recipientAnswer);
        };
        OrganizationTimeZones zones = org -> ZoneId.of("Asia/Ho_Chi_Minh");
        when(emails.sendEmail(any())).thenReturn(emailResult("SENT"));
        handler = new PeerReviewAssignedHandler(ledger, recipients, new PeerReviewMessageTemplates(), zones,
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

    private static PeerReviewAssignedEvent event(Instant occurredAt) {
        return new PeerReviewAssignedEvent(UUID.randomUUID(), occurredAt, ORG, REVIEWER, ASSESSMENT, CYCLE,
                "Bài tập an toàn", 2, DUE);
    }

    private static PeerReviewAssignedEvent event() {
        return event(NOW.minusSeconds(60));
    }

    private EnrollmentEventDelivery row(PeerReviewAssignedEvent event, DeliveryChannel channel) {
        return ledger.rows.get(event.eventId() + "/" + REVIEWER + "/" + channel);
    }

    @Test
    void theReviewerIsToldInTheAppAndByEmailInVietnameseWithTheDeadlineOfTheOrganization() {
        PeerReviewAssignedEvent event = event();

        handler.handle(event);

        ArgumentCaptor<CreateNotificationRequest> inApp = ArgumentCaptor.forClass(CreateNotificationRequest.class);
        verify(notifications).sendNotification(inApp.capture());
        assertThat(inApp.getValue().getOrganizationId()).isEqualTo(ORG);
        assertThat(inApp.getValue().getRecipientUserId()).isEqualTo(REVIEWER);
        assertThat(inApp.getValue().getTitle()).isEqualTo("Bạn có bài cần chấm chéo");
        assertThat(inApp.getValue().getMessage())
                .isEqualTo("Bạn có 2 bài nộp cần chấm cho bài tập «Bài tập an toàn». Vui lòng hoàn thành trước 11/11/2026 00:00.");
        assertThat(inApp.getValue().getType()).isEqualTo("PEER_REVIEW");
        assertThat(inApp.getValue().getChannel()).isEqualTo("IN_APP");
        assertThat(inApp.getValue().getMetadata()).contains(ASSESSMENT.toString()).contains(CYCLE.toString());

        ArgumentCaptor<SendEmailRequest> email = ArgumentCaptor.forClass(SendEmailRequest.class);
        verify(emails).sendEmail(email.capture());
        assertThat(email.getValue().getRecipientEmail()).isEqualTo("an@example.com");
        assertThat(email.getValue().getSubject()).isEqualTo("Bạn có bài cần chấm chéo");
        assertThat(email.getValue().getBody()).contains("Xin chào Nguyễn Văn An").contains("Bài tập an toàn");
        assertThat(email.getValue().getTemplateCode()).isEqualTo("PEER_REVIEW");

        assertThat(row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
        // the event is about a cycle: its ledger rows have no Enrollment, and carry the name of the event
        assertThat(row(event, DeliveryChannel.IN_APP).getEnrollmentId()).isNull();
        assertThat(row(event, DeliveryChannel.IN_APP).getEventType()).isEqualTo("PeerReviewAssigned");
        // nothing else is asked: the title is in the event
        assertThat(lookups).containsExactly("tenant");
    }

    @Test
    void anEventThatComesAgainSendsNothingAgain() {
        PeerReviewAssignedEvent event = event();
        handler.handle(event);
        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any());
        verify(emails, times(1)).sendEmail(any());
        assertThat(ledger.rows).hasSize(2);
    }

    @Test
    void rowsHeldByAnotherHandlerAreLeftAloneAndNothingIsSent() {
        PeerReviewAssignedEvent event = event();
        for (DeliveryChannel channel : DeliveryChannel.values()) {
            ledger.open(event.eventId(), "PeerReviewAssigned", ORG, null, REVIEWER, channel, event.occurredAt(), NOW)
                    .claimed(NOW.minusSeconds(5));
        }

        handler.handle(event);

        verifyNoInteractions(notifications, emails);
        assertThat(lookups).isEmpty();
    }

    @Test
    void anEventOlderThanTheLimitIsSkippedNotSent() {
        PeerReviewAssignedEvent event = event(NOW.minusSeconds(73 * 3600L));

        handler.handle(event);

        verifyNoInteractions(notifications, emails);
        assertThat(lookups).isEmpty();
        assertThat(row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
        assertThat(row(event, DeliveryChannel.IN_APP).getLastError()).isEqualTo("EVENT_TOO_OLD");
    }

    @Test
    void aReviewerWhoIsGoneOrDeactivatedIsNotWrittenTo() {
        recipientAnswer.set(Optional.empty());
        PeerReviewAssignedEvent gone = event();
        handler.handle(gone);
        assertThat(row(gone, DeliveryChannel.EMAIL).getLastError()).isEqualTo("RECIPIENT_UNAVAILABLE");

        recipientAnswer.set(Optional.of(new Recipient(REVIEWER, "An", "an@example.com", "Deactivated")));
        PeerReviewAssignedEvent deactivated = event();
        handler.handle(deactivated);
        assertThat(row(deactivated, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);

        verifyNoInteractions(notifications, emails);
    }

    @Test
    void aTenantThatDoesNotAnswerFailsTheRowsWithAFixedCodeAndAsksForAnotherTry() {
        recipientAnswer.set(new DependencyUnavailableException("TENANT_UNAVAILABLE"));
        PeerReviewAssignedEvent event = event();

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);

        assertThat(row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(row(event, DeliveryChannel.IN_APP).getLastError()).isEqualTo("TENANT_UNAVAILABLE");
        verifyNoInteractions(notifications, emails);

        // the next try, with the tenant back, sends both
        recipientAnswer.set(Optional.of(new Recipient(REVIEWER, "An", "an@example.com", "Active")));
        handler.handle(event);
        verify(notifications, times(1)).sendNotification(any());
        verify(emails, times(1)).sendEmail(any());
    }

    @Test
    void aFailedMailIsTheOnlyChannelTriedAgain() {
        when(emails.sendEmail(any())).thenReturn(emailResult("FAILED")).thenReturn(emailResult("SENT"));
        PeerReviewAssignedEvent event = event();

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(row(event, DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(row(event, DeliveryChannel.EMAIL).getLastError()).isEqualTo("EMAIL_FAILED");

        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any());
        verify(emails, times(2)).sendEmail(any());
        assertThat(row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(row(event, DeliveryChannel.EMAIL).getAttempts()).isEqualTo(2);
    }

    @Test
    void aReviewerWithoutAnEmailAddressStillGetsTheNoticeInTheApp() {
        recipientAnswer.set(Optional.of(new Recipient(REVIEWER, "An", null, "Active")));
        PeerReviewAssignedEvent event = event();

        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any());
        verify(emails, never()).sendEmail(any());
        assertThat(row(event, DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
        assertThat(row(event, DeliveryChannel.EMAIL).getLastError()).isEqualTo("NO_EMAIL");
    }
}
