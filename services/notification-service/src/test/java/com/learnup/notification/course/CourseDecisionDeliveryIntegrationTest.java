package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseDecisionDeliveryIntegrationTest extends CourseHandlerDeliveryScenarios {
    private final RecipientDirectory directory = mock(RecipientDirectory.class);
    private CourseDecisionEvent event;

    @Override
    CourseDeliveryTable table() {
        return CourseDeliveryTable.SUBMISSION;
    }

    @Override
    CourseDeliveryLedger.Obligation newEvent() {
        UUID instructor = UUID.randomUUID();
        event = new CourseDecisionEvent(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), instructor,
                "Workplace Safety", 2, true, null, Instant.now().minusSeconds(60));
        when(directory.find(event.organizationId(), instructor)).thenReturn(
                Optional.of(new Recipient(instructor, "Minh", "minh@example.com", "Active")));
        return new CourseDeliveryLedger.Obligation(event.eventId(), event.organizationId(), event.courseId(),
                event.occurredAt(), instructor, "IN_APP");
    }

    @Override
    void handle(CourseDeliveryLedger ledger) {
        new CourseDecisionEventHandler(ledger, notificationService, directory, emails).handle(event);
    }
}
