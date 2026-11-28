package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseOwnershipTransferredDeliveryIntegrationTest extends CourseHandlerDeliveryScenarios {
    private final RecipientDirectory directory = mock(RecipientDirectory.class);
    private CourseOwnershipTransferredEvent event;

    @Override
    CourseDeliveryTable table() {
        return CourseDeliveryTable.OWNERSHIP;
    }

    @Override
    CourseDeliveryLedger.Obligation newEvent() {
        UUID newInstructor = UUID.randomUUID();
        event = new CourseOwnershipTransferredEvent(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), newInstructor, UUID.randomUUID(),
                "Safety Course", null, Instant.now().minusSeconds(60));
        when(directory.find(event.organizationId(), newInstructor)).thenReturn(
                Optional.of(new Recipient(newInstructor, "Test Instructor", "test@example.com", "Active")));
        return new CourseDeliveryLedger.Obligation(event.eventId(), event.organizationId(), event.courseId(),
                event.occurredAt(), newInstructor, "IN_APP");
    }

    @Override
    void handle(CourseDeliveryLedger ledger) {
        new CourseOwnershipTransferredEventHandler(directory, ledger, notificationService, emails).handle(event);
    }
}
