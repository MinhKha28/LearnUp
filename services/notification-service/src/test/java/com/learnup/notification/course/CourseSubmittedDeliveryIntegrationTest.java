package com.learnup.notification.course;

import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class CourseSubmittedDeliveryIntegrationTest extends CourseHandlerDeliveryScenarios {
    private CourseSubmittedEvent event;
    private RestClient tenant;

    @Override
    CourseDeliveryTable table() {
        return CourseDeliveryTable.SUBMISSION;
    }

    @Override
    CourseDeliveryLedger.Obligation newEvent() {
        UUID organizer = UUID.randomUUID();
        event = new CourseSubmittedEvent(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "Safety Training", 1, Instant.now().minusSeconds(60), Instant.now().minusSeconds(60));
        RestClient.Builder builder = RestClient.builder().baseUrl("http://tenant.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(ExpectedCount.manyTimes(), requestTo("http://tenant.test/api/v1/users/internal/organizer"))
                .andRespond(withSuccess("""
                    {"data":{"id":"%s","email":"organizer@example.com"}}
                    """.formatted(organizer), MediaType.APPLICATION_JSON));
        tenant = builder.build();
        return new CourseDeliveryLedger.Obligation(event.eventId(), event.organizationId(), event.courseId(),
                event.occurredAt(), organizer, "IN_APP");
    }

    @Override
    void handle(CourseDeliveryLedger ledger) {
        new CourseSubmittedEventHandler(tenant, ledger, notificationService, emails).handle(event);
    }
}
