package com.learnup.notification.enrollment;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.repository.NotificationRepository;
import com.learnup.notification.service.EmailDeliveryService;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
        "learnup.submission-finalized.enabled=true",
        "learnup.submission-finalized.topic=test.submission-finalized",
        "learnup.submission-finalized.group-id=submission-finalized-kafka-test",
        "learnup.submission-finalized.retry-attempts=3",
        "learnup.submission-finalized.retry-initial-ms=50",
        "learnup.submission-finalized.retry-max-ms=100",
        "learnup.submission-finalized.start-retry-ms=100",
        "learnup.frontend-base-url=https://learnup.example",
        "learnup.enrollment-events.enabled=false", "learnup.course-events.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:submission_finalized_kafka;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate"
})
@EmbeddedKafka(partitions = 1, topics = {"test.submission-finalized", "test.submission-finalized.DLT"},
        bootstrapServersProperty = "spring.kafka.bootstrap-servers")
@Import(SubmissionFinalizedEventListenerKafkaTest.KafkaTestConfig.class)
@ActiveProfiles("test")
@DirtiesContext
class SubmissionFinalizedEventListenerKafkaTest {
    private static final String TOPIC = "test.submission-finalized";
    private static final String GROUP = "submission-finalized-kafka-test";
    @Autowired EmbeddedKafkaBroker broker;
    @Autowired org.springframework.kafka.config.KafkaListenerEndpointRegistry registry;
    @Autowired EnrollmentEventDeliveryRepository deliveries;
    @Autowired NotificationRepository notifications;
    @Autowired KafkaTemplate<String, String> kafka;
    @MockBean RecipientDirectory recipients;
    @MockBean EmailDeliveryService emails;
    private final AtomicBoolean rejectDlt = new AtomicBoolean();
    private final AtomicInteger failedDltSends = new AtomicInteger();

    @TestConfiguration
    static class KafkaTestConfig {
        @Bean
        KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> factory) {
            return spy(new KafkaTemplate<>(factory));
        }
    }
    @BeforeEach void setup() {
        rejectDlt.set(false); failedDltSends.set(0);
        reset(kafka, recipients, emails);
        when(recipients.find(any(), any())).thenAnswer(invocation -> Optional.of(
                new Recipient(invocation.getArgument(1), "Hà", "learner@example.test", "Active")));
        when(emails.sendEmail(any())).thenReturn(result("SENT"));
        doAnswer(invocation -> {
            ProducerRecord<String, String> record = invocation.getArgument(0);
            if (record.topic().equals(TOPIC + ".DLT") && rejectDlt.get()) {
                failedDltSends.incrementAndGet();
                return CompletableFuture.failedFuture(new IllegalStateException("TEST_DLT_UNAVAILABLE"));
            }
            return invocation.callRealMethod();
        }).when(kafka).send(any(ProducerRecord.class));
    }

    private EmailLogResponse result(String status) {
        var result = new EmailLogResponse(); result.setStatus(status); return result;
    }

    private long notices(SubmissionFinalizedEvent event) {
        return notifications.findByRecipientUserIdOrderByCreatedAtDesc(event.learnerId(), Pageable.unpaged()).getTotalElements();
    }

    private org.apache.kafka.clients.producer.RecordMetadata send(SubmissionFinalizedEvent event) throws Exception {
        return kafka.send(TOPIC, event.learnerId().toString(), SubmissionFinalizedEventParserTest.envelope(event).toString())
                .get(10, TimeUnit.SECONDS).getRecordMetadata();
    }

    @Test void duplicateAndOffsetReplayDeduplicateBothChannelsAndRecoverEmailOnly() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        when(emails.sendEmail(any())).thenReturn(result("FAILED"), result("SENT"));
        send(event);
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                assertThat(deliveries.findByEventId(event.eventId())).hasSize(2).allSatisfy(row ->
                        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT)));
        var container = registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID);
        container.stop();
        container.start();
        var replay = send(event);
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
                var committed = admin.listConsumerGroupOffsets(GROUP).partitionsToOffsetAndMetadata().get(5, TimeUnit.SECONDS)
                        .get(new TopicPartition(TOPIC, 0));
                assertThat(committed).isNotNull();
                assertThat(committed.offset()).isGreaterThan(replay.offset());
            }
        });
        assertThat(notices(event)).isEqualTo(1);
        verify(emails, times(2)).sendEmail(any());
    }

    @Test void exhaustedEmailAndPoisonReachDltAndFollowingRecordsProceed() throws Exception {
        when(emails.sendEmail(any())).thenReturn(result("FAILED"));
        var event = SubmissionFinalizedEventParserTest.event();
        String poison = "{malformed";
        send(event);
        kafka.send(TOPIC, "poison", poison).get(10, TimeUnit.SECONDS);
        Map<String, Object> properties = Map.of(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, broker.getBrokersAsString(),
                ConsumerConfig.GROUP_ID_CONFIG, "submission-dlt-" + UUID.randomUUID(),
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        try (var consumer = new DefaultKafkaConsumerFactory<>(properties, new StringDeserializer(), new StringDeserializer())
                .createConsumer()) {
            consumer.subscribe(java.util.List.of(TOPIC + ".DLT"));
            var values = new java.util.ArrayList<String>();
            await().atMost(Duration.ofSeconds(20)).until(() -> {
                consumer.poll(Duration.ofMillis(200)).forEach(record -> values.add(record.value()));
                return values.contains(poison) && values.stream().anyMatch(value -> value.contains(event.eventId().toString()));
            });
        }
        assertThat(notices(event)).isEqualTo(1);
        verify(emails, times(3)).sendEmail(any());
        when(emails.sendEmail(any())).thenReturn(result("SENT"));
        var next = SubmissionFinalizedEventParserTest.event(); send(next);
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(notices(next)).isEqualTo(1));
    }

    @Test void failedDltPublishLeavesOffsetUncommittedUntilPublicationRecovers() throws Exception {
        rejectDlt.set(true);
        var poison = kafka.send(TOPIC, "poison", "not-json").get(10, TimeUnit.SECONDS).getRecordMetadata();
        var following = SubmissionFinalizedEventParserTest.event(); send(following);
        try {
            await().atMost(Duration.ofSeconds(15)).until(() -> failedDltSends.get() > 0);
            try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
                var offset = admin.listConsumerGroupOffsets(GROUP).partitionsToOffsetAndMetadata().get(5, TimeUnit.SECONDS)
                        .get(new TopicPartition(TOPIC, poison.partition()));
                assertThat(offset == null || offset.offset() <= poison.offset()).isTrue();
            }
            assertThat(notices(following)).isZero();
        } finally {
            rejectDlt.set(false);
        }
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            assertThat(notices(following)).isEqualTo(1);
            try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
                var offset = admin.listConsumerGroupOffsets(GROUP).partitionsToOffsetAndMetadata().get(5, TimeUnit.SECONDS)
                        .get(new TopicPartition(TOPIC, poison.partition()));
                assertThat(offset.offset()).isGreaterThan(poison.offset());
            }
        });
    }
}
