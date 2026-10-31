package com.learnup.notification.enrollment;

import com.learnup.notification.client.CourseDirectory;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.repository.NotificationRepository;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The listener on a real (embedded) broker: a valid event is told once, a duplicate changes nothing, a service that
 * answers late is waited for, a service that never answers and a message that is not an event end in the
 * dead-letter topic, and nothing behind them is held up.
 */
@SpringBootTest(properties = {
        "learnup.enrollment-events.enabled=true",
        "learnup.enrollment-events.topic=test.enrollment-events",
        "learnup.enrollment-events.retry-attempts=3",
        "learnup.enrollment-events.retry-initial-backoff=50ms",
        "learnup.enrollment-events.retry-max-backoff=100ms",
        "spring.kafka.consumer.group-id=notification-listener-test"
})
@EmbeddedKafka(partitions = 1, topics = {"test.enrollment-events"}, bootstrapServersProperty = "spring.kafka.bootstrap-servers")
@ActiveProfiles("test")
@DirtiesContext
class EnrollmentEventListenerKafkaTest {

    private static final String TOPIC = "test.enrollment-events";
    private static final String DEAD_LETTER = "test.enrollment-events.DLT";

    @Autowired
    private KafkaTemplate<String, String> kafka;
    @Autowired
    private EmbeddedKafkaBroker broker;
    @Autowired
    private EnrollmentEventDeliveryRepository deliveries;
    @Autowired
    private NotificationRepository notifications;

    @MockBean
    private RecipientDirectory recipients;
    @MockBean
    private CourseDirectory courses;

    private Consumer<String, String> deadLetters;

    @BeforeEach
    void setUp() {
        reset(recipients, courses);
        when(courses.nameOf(any(), any())).thenReturn(Optional.of("An toàn lao động"));
        Map<String, Object> props = KafkaTestUtils.consumerProps("dlt-reader-" + UUID.randomUUID(), "true", broker);
        props.put("auto.offset.reset", "earliest");
        deadLetters = new DefaultKafkaConsumerFactory<>(props, new StringDeserializer(), new StringDeserializer())
                .createConsumer();
        deadLetters.subscribe(List.of(DEAD_LETTER));
    }

    @AfterEach
    void tearDown() {
        deadLetters.close();
    }

    private static String assigned(UUID eventId, UUID learner, UUID enrollment) {
        return """
                {"eventId":"%s","eventType":"EnrollmentAssigned","version":1,"occurredAt":"%s","organizationId":"%s",
                 "producer":"learning-service","data":{"enrollmentId":"%s","learnerId":"%s","courseId":"%s",
                 "kind":"CREATE","dueAt":"2026-12-01T00:00:00.000Z"}}
                """.formatted(eventId, java.time.Instant.now().minusSeconds(20), UUID.randomUUID(), enrollment, learner,
                UUID.randomUUID());
    }

    private void whoIs(UUID learner) {
        doReturn(Optional.of(new Recipient(learner, "Nguyễn Văn An", "kafka@example.com", "Active")))
                .when(recipients).find(any(), any());
    }

    private int notices(UUID learner) {
        return (int) notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, Pageable.unpaged()).getTotalElements();
    }

    private void awaitSent(UUID eventId) {
        await().atMost(Duration.ofSeconds(30)).untilAsserted(() ->
                assertThat(deliveries.findByEventId(eventId)).hasSize(2)
                        .allSatisfy(row -> assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT)));
    }

    private List<ConsumerRecord<String, String>> deadLettersWithKey(String key, Duration wait) {
        List<ConsumerRecord<String, String>> found = new ArrayList<>();
        long end = System.currentTimeMillis() + wait.toMillis();
        while (System.currentTimeMillis() < end && found.isEmpty()) {
            ConsumerRecords<String, String> records = deadLetters.poll(Duration.ofMillis(300));
            records.forEach(record -> {
                if (key.equals(record.key())) {
                    found.add(record);
                }
            });
        }
        return found;
    }

    @Test
    void aValidEventIsToldToTheLearnerOnce() {
        UUID learner = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        whoIs(learner);

        kafka.send(TOPIC, UUID.randomUUID().toString(), assigned(eventId, learner, UUID.randomUUID()));

        awaitSent(eventId);
        assertThat(notices(learner)).isEqualTo(1);
    }

    @Test
    void theSameEventDeliveredTwiceIsToldOnce() {
        UUID learner = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        UUID enrollment = UUID.randomUUID();
        whoIs(learner);
        String body = assigned(eventId, learner, enrollment);

        kafka.send(TOPIC, enrollment.toString(), body);
        kafka.send(TOPIC, enrollment.toString(), body);
        // a later event of the same Enrollment proves the second copy was already handled
        UUID next = UUID.randomUUID();
        kafka.send(TOPIC, enrollment.toString(), assigned(next, learner, enrollment));

        awaitSent(next);
        assertThat(notices(learner)).isEqualTo(2);
        assertThat(deliveries.findByEventId(eventId)).hasSize(2);
    }

    @Test
    void aServiceThatAnswersOnTheThirdTryIsWaitedFor() {
        UUID learner = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        UUID enrollment = UUID.randomUUID();
        when(recipients.find(any(), any()))
                .thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"))
                .thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"))
                .thenReturn(Optional.of(new Recipient(learner, "An", "retry@example.com", "Active")));

        kafka.send(TOPIC, enrollment.toString(), assigned(eventId, learner, enrollment));

        awaitSent(eventId);
        verify(recipients, times(3)).find(any(), any());
        assertThat(notices(learner)).isEqualTo(1);
        assertThat(deadLettersWithKey(enrollment.toString(), Duration.ofSeconds(2))).isEmpty();
    }

    @Test
    void aServiceThatNeverAnswersEndsInTheDeadLetterTopicAndDoesNotHoldUpTheNextEvent() {
        UUID learner = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        UUID enrollment = UUID.randomUUID();
        when(recipients.find(any(), any())).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"));

        kafka.send(TOPIC, enrollment.toString(), assigned(eventId, learner, enrollment));

        List<ConsumerRecord<String, String>> dead = deadLettersWithKey(enrollment.toString(), Duration.ofSeconds(30));
        assertThat(dead).hasSize(1);
        assertThat(dead.get(0).value()).contains(eventId.toString());
        verify(recipients, times(3)).find(any(), any());
        assertThat(deliveries.findByEventId(eventId)).hasSize(2).allSatisfy(row -> {
            assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
            assertThat(row.getLastError()).isEqualTo("TENANT_UNAVAILABLE");
            assertThat(row.getAttempts()).isEqualTo(3);
        });

        // the next event, with tenant back, is handled
        UUID otherLearner = UUID.randomUUID();
        UUID next = UUID.randomUUID();
        whoIs(otherLearner);
        kafka.send(TOPIC, UUID.randomUUID().toString(), assigned(next, otherLearner, UUID.randomUUID()));
        awaitSent(next);
    }

    @Test
    void aMessageThatIsNotAnEventGoesStraightToTheDeadLetterTopicWithoutARetry() {
        String key = "poison-" + UUID.randomUUID();

        kafka.send(TOPIC, key, "this is not json {");

        List<ConsumerRecord<String, String>> dead = deadLettersWithKey(key, Duration.ofSeconds(30));
        assertThat(dead).hasSize(1);
        assertThat(dead.get(0).value()).isEqualTo("this is not json {");
        verifyNoInteractions(recipients, courses);
    }

    @Test
    void anEventTypeThatIsNotForThisServiceIsReadAndLeftAloneAndTheNextOneStillArrives() {
        UUID learner = UUID.randomUUID();
        UUID enrollment = UUID.randomUUID();
        whoIs(learner);
        String completed = """
                {"eventId":"%s","eventType":"EnrollmentCompleted","version":1,"occurredAt":"2026-10-27T01:00:00Z",
                 "organizationId":"%s","producer":"learning-service","data":{"enrollmentId":"%s","learnerId":"%s","courseId":"%s"}}
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), enrollment, learner, UUID.randomUUID());
        UUID next = UUID.randomUUID();

        kafka.send(TOPIC, enrollment.toString(), completed);
        kafka.send(TOPIC, enrollment.toString(), assigned(next, learner, enrollment));

        awaitSent(next);
        assertThat(notices(learner)).isEqualTo(1);
        assertThat(deadLettersWithKey(enrollment.toString(), Duration.ofSeconds(2))).isEmpty();
    }
}
