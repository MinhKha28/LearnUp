package com.learnup.notification.course;

import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class CourseSubmittedEventHandlerTest {
    private static final UUID ORG = UUID.fromString("019a0000-0000-7000-8000-000000000002");
    private static final UUID COURSE = UUID.fromString("019a0000-0000-7000-8000-000000000003");
    private static final UUID ORGANIZER = UUID.fromString("019a0000-0000-7000-8000-000000000004");

    private final CourseSubmissionDeliveryLedger ledger = mock(CourseSubmissionDeliveryLedger.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final EmailDeliveryService emails = mock(EmailDeliveryService.class);

    private CourseSubmittedEvent event() {
        return new CourseSubmittedEvent(UUID.randomUUID(), ORG, COURSE, UUID.randomUUID(),
                "Safety Training", 1, Instant.now().minusSeconds(60), Instant.now().minusSeconds(60));
    }

    private CourseSubmittedEventHandler handler(MockRestServiceServer[] serverOut) {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://tenant.test");
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        return new CourseSubmittedEventHandler(builder.build(), ledger, notifications, emails);
    }

    private static EmailLogResponse sent() {
        EmailLogResponse result = new EmailLogResponse();
        result.setStatus("SENT");
        return result;
    }

    @Test
    void createsEmailAndInAppNoticesForTheActiveOrganizer() {
        MockRestServiceServer[] servers = new MockRestServiceServer[1];
        var handler = handler(servers);
        var event = event();

        servers[0].expect(requestTo("http://tenant.test/api/v1/users/internal/organizer"))
                .andRespond(withSuccess("""
                    {"data":{"id":"%s","email":"organizer@example.com"}}
                    """.formatted(ORGANIZER), MediaType.APPLICATION_JSON));
        when(ledger.claim(eq(event), eq(ORGANIZER), any())).thenReturn(true);
        when(emails.sendEmail(any())).thenReturn(sent());

        handler.handle(event);

        verify(notifications).sendNotification(any(CreateNotificationRequest.class));
        verify(emails).sendEmail(any(SendEmailRequest.class));
        verify(ledger).sent(event.eventId(), ORGANIZER, "IN_APP");
        verify(ledger).sent(event.eventId(), ORGANIZER, "EMAIL");
        servers[0].verify();
    }

    @Test
    void retriesOnlyTheFailedChannelAndNeverReplaysTheSuccessfulChannel() {
        MockRestServiceServer[] servers = new MockRestServiceServer[1];
        var handler = handler(servers);
        var event = event();

        for (int i = 0; i < 2; i++) {
            servers[0].expect(requestTo("http://tenant.test/api/v1/users/internal/organizer"))
                    .andRespond(withSuccess("""
                        {"data":{"id":"%s","email":"organizer@example.com"}}
                        """.formatted(ORGANIZER), MediaType.APPLICATION_JSON));
        }
        when(ledger.claim(event, ORGANIZER, "IN_APP")).thenReturn(true, false);
        when(ledger.claim(event, ORGANIZER, "EMAIL")).thenReturn(true, true);
        EmailLogResponse failed = new EmailLogResponse();
        failed.setStatus("FAILED");
        when(emails.sendEmail(any())).thenReturn(failed, sent());

        assertThatThrownBy(() -> handler.handle(event))
                .isInstanceOf(DependencyUnavailableException.class);
        handler.handle(event);

        verify(notifications, times(1)).sendNotification(any(CreateNotificationRequest.class));
        verify(emails, times(2)).sendEmail(any(SendEmailRequest.class));
        verify(ledger).failed(event.eventId(), ORGANIZER, "EMAIL", "EMAIL_FAILED");
        servers[0].verify();
    }
}
