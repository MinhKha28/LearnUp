package com.learnup.notification.enrollment;

import java.net.ServerSocket;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.EmbeddedKafkaZKBroker;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
        "learnup.submission-finalized.enabled=true", "learnup.submission-finalized.topic=test.late-submission",
        "learnup.submission-finalized.group-id=late-submission", "learnup.submission-finalized.start-retry-ms=100",
        "learnup.submission-finalized.retry-initial-ms=1000", "learnup.submission-finalized.retry-max-ms=1000",
        "learnup.frontend-base-url=https://frontend.example", "spring.kafka.admin.auto-create=false",
        "learnup.enrollment-events.enabled=false", "learnup.course-events.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:submission_late_broker;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
@ActiveProfiles("test")
@DirtiesContext
class SubmissionFinalizedUnavailableDependenciesKafkaTest {
    private static final String TOPIC = "test.late-submission";
    private static final int PORT = availablePort();
    @Autowired KafkaTemplate<String, String> kafka;
    @Autowired KafkaListenerEndpointRegistry registry;
    @Autowired EnrollmentEventDeliveryRepository deliveries;
    @Autowired NotificationService notifications;
    @MockBean RecipientDirectory recipients;
    @MockBean EmailDeliveryService emails;

    @DynamicPropertySource
    static void brokerAddress(DynamicPropertyRegistry properties) {
        properties.add("spring.kafka.bootstrap-servers", () -> "127.0.0.1:" + PORT);
    }

    private static int availablePort() {
        try (var socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (java.io.IOException failure) {
            throw new IllegalStateException("TEST_PORT_UNAVAILABLE", failure);
        }
    }

    @Test void startsWithoutKafkaThenDeliversWhenKafkaAndTenantRecover() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        assertThat(notifications.getUnreadCount(event.learnerId(), event.organizationId())).isZero();
        when(recipients.find(any(), any())).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"));
        var result = new EmailLogResponse();
        result.setStatus("SENT");
        when(emails.sendEmail(any())).thenReturn(result);
        var broker = new EmbeddedKafkaZKBroker(1, false, 1, TOPIC, TOPIC + ".DLT").kafkaPorts(PORT);
        try {
            broker.afterPropertiesSet();
            kafka.send(TOPIC, event.learnerId().toString(), SubmissionFinalizedEventParserTest.envelope(event).toString())
                    .get(15, TimeUnit.SECONDS);
            await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
                assertThat(notifications.getUnreadCount(event.learnerId(), event.organizationId())).isEqualTo(1);
                assertThat(deliveries.findByEventId(event.eventId())).anySatisfy(row ->
                        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED));
            });
            doReturn(Optional.of(new Recipient(event.learnerId(), "Learner", "learner@example.test", "Active")))
                    .when(recipients).find(any(), any());
            await().atMost(Duration.ofSeconds(15)).untilAsserted(() ->
                    assertThat(deliveries.findByEventId(event.eventId())).hasSize(2)
                            .allSatisfy(row -> assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT)));
            assertThat(notifications.getUnreadCount(event.learnerId(), event.organizationId())).isEqualTo(1);
            verify(emails).sendEmail(any());
        } finally {
            registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID).stop();
            broker.destroy();
        }
    }
}
