package com.learnup.notification.enrollment;

import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.EmbeddedKafkaZKBroker;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.net.ServerSocket;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "learnup.submission-finalized.enabled=true",
        "learnup.submission-finalized.topic=test.submission-recovery",
        "learnup.submission-finalized.group-id=submission-finalized-recovery",
        "learnup.submission-finalized.start-retry-ms=200",
        "learnup.frontend-base-url=https://learnup.example",
        "learnup.enrollment-events.enabled=false", "learnup.course-events.enabled=false",
        "spring.kafka.admin.auto-create=false",
        "spring.datasource.url=jdbc:h2:mem:submission_recovery;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate"
})
@ActiveProfiles("test")
@DirtiesContext
class SubmissionFinalizedKafkaRecoveryTest {
    private static final int PORT = unusedPort();

    private static int unusedPort() {
        try (var socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (java.io.IOException failure) {
            throw new IllegalStateException("TEST_PORT_UNAVAILABLE");
        }
    }

    @DynamicPropertySource static void brokerAddress(DynamicPropertyRegistry registry) {
        registry.add("spring.kafka.bootstrap-servers", () -> "127.0.0.1:" + PORT);
    }

    @Autowired TestRestTemplate http;
    @Autowired KafkaTemplate<String, String> kafka;
    @Autowired EnrollmentEventDeliveryRepository deliveries;
    @MockBean RecipientDirectory recipients;

    @Test void apiStartsWithoutKafkaAndConsumerRecoversWhenBrokerAppears() throws Exception {
        when(recipients.find(any(), any())).thenReturn(Optional.empty());
        var event = SubmissionFinalizedEventParserTest.event();
        var headers = new HttpHeaders();
        headers.set("X-Internal-Key", "notification-test-only-internal-key-32bytes");
        var response = http.postForEntity("/api/v1/notifications/send", new HttpEntity<>(
                new CreateNotificationRequest(event.organizationId(), event.learnerId(), "Title", "Body",
                        "INFO", "IN_APP", null), headers), String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        var broker = new EmbeddedKafkaZKBroker(1, false, 1, "test.submission-recovery", "test.submission-recovery.DLT");
        broker.kafkaPorts(PORT);
        try {
            broker.brokerProperty("auto.create.topics.enable", "false");
            broker.afterPropertiesSet();
            kafka.send("test.submission-recovery", event.learnerId().toString(),
                    SubmissionFinalizedEventParserTest.envelope(event).toString()).get(15, TimeUnit.SECONDS);
            await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                    assertThat(deliveries.findByEventId(event.eventId())).hasSize(2).allSatisfy(row ->
                            assertThat(row.getStatus().isFinal()).isTrue()));
        } finally {
            broker.destroy();
        }
    }
}
