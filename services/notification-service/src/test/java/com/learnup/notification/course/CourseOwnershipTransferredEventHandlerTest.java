package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.learnup.notification.course.CourseLedgerMocks.claim;
import static com.learnup.notification.course.CourseLedgerMocks.claims;
import static com.learnup.notification.course.CourseLedgerMocks.obligation;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CourseOwnershipTransferredEventHandlerTest {
    private final RecipientDirectory directory = mock(RecipientDirectory.class);
    private final CourseDeliveryLedger ledger = CourseLedgerMocks.ledger();
    private final NotificationService notifications = mock(NotificationService.class);
    private final EmailDeliveryService emails = mock(EmailDeliveryService.class);

    private static final UUID ORG = UUID.fromString("019a0000-0000-7000-8000-000000000002");
    private static final UUID COURSE = UUID.fromString("019a0000-0000-7000-8000-000000000003");
    private static final UUID CHAIN = UUID.fromString("019a0000-0000-7000-8000-000000000004");
    private static final UUID OLD = UUID.fromString("019a0000-0000-7000-8000-000000000005");
    private static final UUID NEW = UUID.fromString("019a0000-0000-7000-8000-000000000006");
    private static final UUID ACTOR = UUID.fromString("019a0000-0000-7000-8000-000000000007");

    private static CourseOwnershipTransferredEvent event() {
        return new CourseOwnershipTransferredEvent(
                UUID.randomUUID(), ORG, COURSE, CHAIN, OLD, NEW, ACTOR,
                "Safety Course", null, Instant.parse("2026-11-10T12:00:00Z"));
    }

    @Test
    void sendsOnlyEmailAndInAppAndNeverCreatesAnAuditDelivery() {
        var event = event();
        when(directory.find(ORG, NEW)).thenReturn(
                Optional.of(new Recipient(NEW, "Test Instructor", "test@example.com", "Active")));
        claims(ledger, CourseDeliveryTable.OWNERSHIP, event.eventId(), NEW, "IN_APP", true);
        claims(ledger, CourseDeliveryTable.OWNERSHIP, event.eventId(), NEW, "EMAIL", true);
        EmailLogResponse email = new EmailLogResponse();
        email.setStatus("SENT");
        when(emails.sendEmail(any(SendEmailRequest.class))).thenReturn(email);

        new CourseOwnershipTransferredEventHandler(
                directory, ledger, notifications, emails).handle(event);

        verify(notifications).sendNotification(any(CreateNotificationRequest.class));
        verify(emails).sendEmail(any(SendEmailRequest.class));
        verify(ledger).deliverInApp(eq(claim(CourseDeliveryTable.OWNERSHIP, "IN_APP")), any());
        verify(ledger).sent(claim(CourseDeliveryTable.OWNERSHIP, "EMAIL"));
        verify(ledger, never()).claim(any(), obligation(event.eventId(), ACTOR, "AUDIT"));
        verify(ledger, never()).claim(any(), obligation(event.eventId(), ACTOR, "AUDIT"));
        verify(ledger, times(2)).claim(any(), any());
    }
}
