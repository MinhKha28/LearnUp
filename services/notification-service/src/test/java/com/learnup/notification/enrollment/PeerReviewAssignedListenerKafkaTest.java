package com.learnup.notification.enrollment;

import com.learnup.notification.client.CourseDirectory;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.entity.DeliveryStatus;
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
import java.time.Instant;
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
 * BR-232 on a real (embedded) broker: the PeerReviewAssigned event that assessment-service publishes on its own topic
 * reaches the reviewer once (in the app and by e-mail), a duplicate changes nothing, a tenant that answers late is waited
 * for, and a message that is not an event, or a service that never answers, ends in the dead-letter topic of THIS topic
 * (not in the one of the enrollment events), and nothing behind it is held up.
 */
@SpringBootTest(properties = {
        "learnup.enrollment-events.enabled=true",
        "learnup.enrollment-events.topic=test.pr.enrollment-events",
        "learnup.enrollment-events.peer-review-topic=test.pr.peer-review-assigned",
        "learnup.enrollment-events.retry-attempts=3",
        "learnup.enrollment-events.retry-initial-backoff=50ms",
        "learnup.enrollment-events.retry-max-backoff=100ms",
        "spring.kafka.consumer.group-id=notification-peer-review-test"
})
@EmbeddedKafka(partitions = 1, topics = {"test.pr.enrollment-events", "test.pr.peer-review-assigned"},
        bootstrapServersProperty = "spring.kafka.bootstrap-servers")
@ActiveProfiles("test")
@DirtiesContext
class PeerReviewAssignedListenerKafkaTest {

    private static final String TOPIC = "test.pr.peer-review-assigned";
    private static final String DEAD_LETTER = "test.pr.peer-review-assigned.DLT";
    private static final String ENROLLMENT_DEAD_LETTER = "test.pr.enrollment-events.DLT";

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
    private Consumer<String, String> enrollmentDeadLetters;

    @BeforeEach
    void setUp() {
        reset(recipients, courses);
        deadLetters = reader(DEAD_LETTER);
        enrollmentDeadLetters = reader(ENROLLMENT_DEAD_LETTER);
    }

    private Consumer<String, String> reader(String topic) {
        Map<String, Object> props = KafkaTestUtils.consumerProps("dlt-reader-" + UUID.randomUUID(), "true", broker);
        props.put("auto.offset.reset", "earliest");
        Consumer<String, String> consumer = new DefaultKafkaConsumerFactory<>(props, new StringDeserializer(),
                new StringDeserializer()).createConsumer();
        consumer.subscribe(List.of(topic));
        return consumer;
    }

    @AfterEach
    void tearDown() {
        deadLetters.close();
        enrollmentDeadLetters.close();
    }

    private static String assigned(UUID eventId, UUID reviewer, int count) {
        return """
                {"eventId":"%s","eventType":"PeerReviewAssigned","version":1,"occurredAt":"%s","organizationId":"%s",
                 "producer":"assessment-service","data":{"learnerId":"%s","assessmentId":"%s","cycleId":"%s",
                 "assignmentTitle":"Bài tập an toàn","reviewCount":%d,"reviewDueAt":"%s"}}
                """.formatted(eventId, Instant.now().minusSeconds(20), UUID.randomUUID(), reviewer, UUID.randomUUID(),
                UUID.randomUUID(), count, Instant.now().plusSeconds(3 * 86400));
    }

    private void whoIs(UUID reviewer) {
        doReturn(Optional.of(new Recipient(reviewer, "Nguyễn Văn An", "reviewer@example.com", "Active")))
                .when(recipients).find(any(), any());
    }

    private int notices(UUID reviewer) {
        return (int) notifications.findByRecipientUserIdOrderByCreatedAtDesc(reviewer, Pageable.unpaged()).getTotalElements();
    }

    private void awaitSent(UUID eventId) {
        await().atMost(Duration.ofSeconds(30)).untilAsserted(() ->
                assertThat(deliveries.findByEventId(eventId)).hasSize(2)
                        .allSatisfy(row -> assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT)));
    }

    private static List<ConsumerRecord<String, String>> withKey(Consumer<String, String> consumer, String key, Duration wait) {
        List<ConsumerRecord<String, String>> found = new ArrayList<>();
        long end = System.currentTimeMillis() + wait.toMillis();
        while (System.currentTimeMillis() < end && found.isEmpty()) {
            ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(300));
            records.forEach(record -> {
                if (key.equals(record.key())) {
                    found.add(record);
                }
            });
        }
        return found;
    }

    @Test
    void aReviewerIsToldOnceInTheAppWithTheNoticeOfTheReviewsHandedOut() {
        UUID reviewer = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        whoIs(reviewer);

        kafka.send(TOPIC, reviewer.toString(), assigned(eventId, reviewer, 2));

        awaitSent(eventId);
        assertThat(notices(reviewer)).isEqualTo(1);
        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(reviewer, Pageable.unpaged()).getContent().get(0)
                .getTitle()).isEqualTo("Bạn có bài cần chấm chéo");
        // the event is about a cycle, not an Enrollment, and the title is in it: the course service is never asked
        assertThat(deliveries.findByEventId(eventId)).allSatisfy(row -> assertThat(row.getEnrollmentId()).isNull());
        verifyNoInteractions(courses);
    }

    @Test
    void theSameEventDeliveredTwiceIsToldOnce() {
        UUID reviewer = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        whoIs(reviewer);
        String body = assigned(eventId, reviewer, 2);

        kafka.send(TOPIC, reviewer.toString(), body);
        kafka.send(TOPIC, reviewer.toString(), body);
        // a later event for the same reviewer (the key keeps their order) proves the copy was already handled
        UUID next = UUID.randomUUID();
        kafka.send(TOPIC, reviewer.toString(), assigned(next, reviewer, 1));

        awaitSent(next);
        assertThat(notices(reviewer)).isEqualTo(2);
        assertThat(deliveries.findByEventId(eventId)).hasSize(2);
    }

    @Test
    void aTenantThatAnswersOnTheThirdTryIsWaitedFor() {
        UUID reviewer = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        when(recipients.find(any(), any()))
                .thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"))
                .thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"))
                .thenReturn(Optional.of(new Recipient(reviewer, "An", "retry@example.com", "Active")));

        kafka.send(TOPIC, reviewer.toString(), assigned(eventId, reviewer, 3));

        awaitSent(eventId);
        verify(recipients, times(3)).find(any(), any());
        assertThat(notices(reviewer)).isEqualTo(1);
        assertThat(withKey(deadLetters, reviewer.toString(), Duration.ofSeconds(2))).isEmpty();
    }

    @Test
    void aTenantThatNeverAnswersEndsInTheDeadLetterTopicOfThisTopicAndDoesNotHoldUpTheNextEvent() {
        UUID reviewer = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        when(recipients.find(any(), any())).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"));

        kafka.send(TOPIC, reviewer.toString(), assigned(eventId, reviewer, 2));

        List<ConsumerRecord<String, String>> dead = withKey(deadLetters, reviewer.toString(), Duration.ofSeconds(30));
        assertThat(dead).hasSize(1);
        assertThat(dead.get(0).value()).contains(eventId.toString());
        assertThat(withKey(enrollmentDeadLetters, reviewer.toString(), Duration.ofSeconds(1))).isEmpty();
        assertThat(deliveries.findByEventId(eventId)).hasSize(2).allSatisfy(row -> {
            assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
            assertThat(row.getLastError()).isEqualTo("TENANT_UNAVAILABLE");
        });

        UUID other = UUID.randomUUID();
        UUID next = UUID.randomUUID();
        whoIs(other);
        kafka.send(TOPIC, other.toString(), assigned(next, other, 1));
        awaitSent(next);
    }

    @Test
    void aMessageThatIsNotAnEventGoesStraightToTheDeadLetterTopicOfThisTopicWithoutARetry() {
        String key = "poison-" + UUID.randomUUID();

        kafka.send(TOPIC, key, "this is not json {");

        List<ConsumerRecord<String, String>> dead = withKey(deadLetters, key, Duration.ofSeconds(30));
        assertThat(dead).hasSize(1);
        assertThat(dead.get(0).value()).isEqualTo("this is not json {");
        verifyNoInteractions(recipients, courses);
    }

    @Test
    void anEventOfAnotherTypeOnTheTopicIsLeftAloneAndTheNextOneStillArrives() {
        UUID reviewer = UUID.randomUUID();
        whoIs(reviewer);
        kafka.send(TOPIC, reviewer.toString(), """
                {"eventId":"%s","eventType":"SomethingElse","version":1,"occurredAt":"%s","organizationId":"%s",
                 "producer":"assessment-service","data":{}}
                """.formatted(UUID.randomUUID(), Instant.now(), UUID.randomUUID()));
        UUID next = UUID.randomUUID();
        kafka.send(TOPIC, reviewer.toString(), assigned(next, reviewer, 1));

        awaitSent(next);
        assertThat(notices(reviewer)).isEqualTo(1);
    }
}
