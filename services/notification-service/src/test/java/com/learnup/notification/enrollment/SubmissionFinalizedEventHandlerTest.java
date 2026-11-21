package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.config.EnrollmentEventsProperties;
import com.learnup.notification.config.SubmissionFinalizedEventsProperties;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SubmissionFinalizedEventHandlerTest {
    private final DeliveryLedger ledger = mock(DeliveryLedger.class);
    private final EnrollmentEventDeliveryRepository repository = mock(EnrollmentEventDeliveryRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final EmailDeliveryService emails = mock(EmailDeliveryService.class);
    private final RecipientDirectory recipients = mock(RecipientDirectory.class);
    private final Map<DeliveryChannel, EnrollmentEventDelivery> rows = new HashMap<>();
    private final SubmissionFinalizedEvent event = SubmissionFinalizedEventParserTest.event();
    private SubmissionFinalizedEventHandler handler;

    @BeforeEach void setup() {
        var manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenAnswer(invocation -> new SimpleTransactionStatus());
        when(repository.lockById(any())).thenAnswer(invocation -> rows.values().stream()
                .filter(row -> row.getId().equals(invocation.getArgument(0))).findFirst());
        when(ledger.open(any(), anyString(), any(), isNull(), any(), any(), any(), any())).thenAnswer(invocation ->
                rows.computeIfAbsent(invocation.getArgument(5), channel -> new EnrollmentEventDelivery(
                        event.eventId(), "SubmissionFinalized", event.organizationId(), null, event.learnerId(),
                        channel, event.occurredAt(), Instant.now())));
        var properties = new SubmissionFinalizedEventsProperties();
        properties.setFrontendBaseUrl("https://learnup.example");
        handler = new SubmissionFinalizedEventHandler(ledger, repository, new EnrollmentEventsProperties(),
                notifications, emails, recipients, new SubmissionFinalizedMessageTemplates(new ObjectMapper(), properties),
                manager, Clock.fixed(Instant.parse("2026-11-21T00:00:00Z"), ZoneOffset.UTC));
        when(recipients.find(event.organizationId(), event.learnerId())).thenReturn(Optional.of(
                new Recipient(event.learnerId(), "Hà", "learner@example.test", "Active")));
        when(emails.sendEmail(any())).thenReturn(result("SENT"));
    }

    private EmailLogResponse result(String status) {
        var response = new EmailLogResponse(); response.setStatus(status); return response;
    }

    @Test void redeliverySkipsBothCompletedChannelsEvenForAnOldEvent() {
        handler.handle(event); handler.handle(event);
        verify(notifications).sendNotification(any());
        verify(emails).sendEmail(any());
        assertThat(rows.values()).allSatisfy(row -> assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT));
    }

    @Test void retryAfterEmailFailureDoesNotRepeatInApp() {
        when(emails.sendEmail(any())).thenReturn(result("FAILED"), result("SENT"));
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(rows.get(DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(rows.get(DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.FAILED);
        handler.handle(event);
        verify(notifications).sendNotification(any());
        verify(emails, times(2)).sendEmail(any());
    }

    @Test void tenantUnavailableDoesNotBlockInAppAndRecovers() {
        when(recipients.find(any(), any())).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"))
                .thenReturn(Optional.of(new Recipient(event.learnerId(), null, "learner@example.test", "Active")));
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        handler.handle(event);
        verify(notifications).sendNotification(any()); verify(emails).sendEmail(any());
    }

    @Test void permanentTenantRefusalIsPropagatedForDeadLetterHandlingAfterInApp() {
        when(recipients.find(any(), any())).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(PermanentDeliveryException.class);
        assertThat(rows.get(DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test void skipsEmailForMissingDeletedDeactivatedOrAddresslessRecipient() {
        for (Recipient recipient : new Recipient[] {null,
                new Recipient(event.learnerId(), null, "a@example.test", "Deleted"),
                new Recipient(event.learnerId(), null, "a@example.test", "Deactivated"),
                new Recipient(event.learnerId(), null, "", "Active")}) {
            rows.clear();
            when(recipients.find(any(), any())).thenReturn(Optional.ofNullable(recipient));
            handler.handle(event);
            assertThat(rows.get(DeliveryChannel.IN_APP).getStatus()).isEqualTo(DeliveryStatus.SENT);
            assertThat(rows.get(DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
            assertThat(rows.get(DeliveryChannel.EMAIL).getLastError())
                    .isEqualTo(recipient != null && recipient.canBeWrittenTo() ? "NO_EMAIL" : "RECIPIENT_UNAVAILABLE");
        }
        verifyNoInteractions(emails);
    }

    @Test void simulationIsTerminalButNullAndUnknownEmailResponsesAreRetryable() {
        when(emails.sendEmail(any())).thenReturn(null, result("UNKNOWN"), result("SIMULATED"));
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        handler.handle(event); handler.handle(event);
        verify(emails, times(3)).sendEmail(any());
        verify(notifications).sendNotification(any());
    }

    @Test void uncertainSmtpAcceptanceCanResendEmailButNeverRepeatsInApp() {
        var accepted = new java.util.concurrent.atomic.AtomicInteger();
        when(emails.sendEmail(any())).thenAnswer(invocation -> {
            if (accepted.incrementAndGet() == 1) throw new IllegalStateException("TEST_CRASH_AFTER_SMTP_ACCEPTANCE");
            return result("SENT");
        });
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        handler.handle(event);
        assertThat(accepted.get()).isEqualTo(2);
        verify(notifications).sendNotification(any());
    }
    @Test void emailStillRunsAfterInAppFailure() {
        when(notifications.sendNotification(any())).thenThrow(new IllegalStateException("private database detail"));
        assertThatThrownBy(() -> handler.handle(event)).hasMessage("SUBMISSION_FINALIZED_DELIVERY_FAILED");
        assertThat(rows.get(DeliveryChannel.EMAIL).getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(rows.get(DeliveryChannel.IN_APP).getLastError()).isEqualTo("IN_APP_FAILED");
    }
}
