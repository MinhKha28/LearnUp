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
        "learnup.submission-finalized.retry-max-ms=${test.submission.recovery-wait-ms:1000}",
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
    @org.springframework.boot.test.mock.mockito.SpyBean SubmissionFinalizedEventListener eventListener;
    @org.springframework.boot.test.mock.mockito.SpyBean com.learnup.notification.service.NotificationService notificationSender;
    private final java.util.List<Integer> blockingAttempts = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final AtomicBoolean rejectDlt = new AtomicBoolean();
    private final AtomicInteger failedDltSends = new AtomicInteger();
    private final java.util.List<Long> failedPublicationTimes = new java.util.concurrent.CopyOnWriteArrayList<>();
    @Autowired com.learnup.notification.config.SubmissionFinalizedEventsProperties eventProperties;

    @TestConfiguration
    static class KafkaTestConfig {
        @Bean
        KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> factory) {
            return spy(new KafkaTemplate<>(factory));
        }
    }
    @BeforeEach void setup() {
        rejectDlt.set(false); failedDltSends.set(0);
        reset(kafka, recipients, emails, eventListener, notificationSender);
        blockingAttempts.clear();
        failedPublicationTimes.clear();
        doAnswer(invocation -> {
            org.apache.kafka.clients.consumer.ConsumerRecord<String, String> record = invocation.getArgument(0);
            var header = record.headers().lastHeader(org.springframework.kafka.support.KafkaHeaders.DELIVERY_ATTEMPT);
            blockingAttempts.add(header == null ? 0 : java.nio.ByteBuffer.wrap(header.value()).getInt());
            return invocation.callRealMethod();
        }).when(eventListener).onMessage(any());
        when(recipients.find(any(), any())).thenAnswer(invocation -> Optional.of(
                new Recipient(invocation.getArgument(1), "Hà", "learner@example.test", "Active")));
        when(emails.sendEmail(any())).thenReturn(result("SENT"));
        doAnswer(invocation -> {
            ProducerRecord<String, String> record = invocation.getArgument(0);
            if (record.topic().equals(TOPIC + ".DLT") && rejectDlt.get()) {
                failedPublicationTimes.add(System.nanoTime());
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

    private org.apache.kafka.clients.consumer.Consumer<String, String> dltReader() {
        Map<String, Object> properties = Map.of(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, broker.getBrokersAsString(),
                ConsumerConfig.GROUP_ID_CONFIG, "mixed-dlt-" + UUID.randomUUID(),
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        var consumer = new DefaultKafkaConsumerFactory<>(properties, new StringDeserializer(), new StringDeserializer())
                .createConsumer();
        consumer.subscribe(java.util.List.of(TOPIC + ".DLT"));
        return consumer;
    }

    private void awaitDlt(org.apache.kafka.clients.consumer.Consumer<String, String> consumer,
            SubmissionFinalizedEvent event) {
        await().atMost(Duration.ofSeconds(20)).until(() -> {
            var records = consumer.poll(Duration.ofMillis(100));
            for (var record : records) {
                if (record.value().contains(event.eventId().toString())) return true;
            }
            return false;
        });
    }

    @Test void mixedFailureRetriesInAppThenDeadLettersAndOperatorReplayReclaimsEmail() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        doThrow(new IllegalStateException("TEST_IN_APP_TRANSIENT")).doCallRealMethod()
                .when(notificationSender).sendNotification(any());
        when(recipients.find(any(), any())).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));
        try (var consumer = dltReader()) {
            send(event);
            awaitDlt(consumer, event);
            assertThat(notices(event)).isEqualTo(1);
            verify(notificationSender, times(2)).sendNotification(any());
            verify(recipients).find(any(), any());
            assertThat(blockingAttempts).containsExactly(1, 2);
            assertThat(deliveries.findByEventId(event.eventId()))
                    .filteredOn(row -> row.getChannel() == com.learnup.notification.entity.DeliveryChannel.EMAIL)
                    .singleElement().satisfies(row -> {
                        assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
                        assertThat(row.getLastError()).isEqualTo("TENANT_REJECTED");
                        assertThat(row.getAttempts()).isEqualTo(1);
                    });
            doReturn(Optional.of(new Recipient(event.learnerId(), "Hà", "learner@example.test", "Active")))
                    .when(recipients).find(any(), any());
            var replay = send(event);
            await().atMost(Duration.ofSeconds(15)).untilAsserted(() ->
                    assertThat(deliveries.findByEventId(event.eventId())).allSatisfy(row ->
                            assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT)));
            assertThat(notices(event)).isEqualTo(1);
            assertThat(blockingAttempts).containsExactly(1, 2, 1);
            verify(recipients, times(2)).find(any(), any());
            verify(emails).sendEmail(any());
            assertThat(replay.offset()).isPositive();
        }
    }

    @Test void mixedFailureExhaustsRetriesWithoutRepeatingPermanentEmailAttempt() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        doThrow(new IllegalStateException("TEST_IN_APP_TRANSIENT"))
                .when(notificationSender).sendNotification(any());
        when(emails.sendEmail(any())).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));
        try (var consumer = dltReader()) {
            send(event);
            awaitDlt(consumer, event);
            verify(notificationSender, times(3)).sendNotification(any());
            verify(recipients).find(any(), any());
            verify(emails).sendEmail(any());
            assertThat(notices(event)).isZero();
            assertThat(blockingAttempts).containsExactly(1, 2, 3);
        }
    }

    @Test void restartingAnUncommittedRecordRetriesPermanentEmailOnceAndDoesNotDuplicateInApp() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        var holdSecondAttempt = new java.util.concurrent.CountDownLatch(1);
        var releaseSecondAttempt = new java.util.concurrent.CountDownLatch(1);
        var inAppAttempts = new AtomicInteger();
        doAnswer(invocation -> {
            int attempt = inAppAttempts.incrementAndGet();
            if (attempt == 2) {
                holdSecondAttempt.countDown();
                if (!releaseSecondAttempt.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("TEST_WAIT_TIMEOUT");
            }
            if (attempt <= 2) throw new IllegalStateException("TEST_IN_APP_TRANSIENT");
            return invocation.callRealMethod();
        }).when(notificationSender).sendNotification(any());
        when(recipients.find(any(), any())).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));
        var container = registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID);
        try (var consumer = dltReader()) {
            send(event);
            try {
                assertThat(holdSecondAttempt.await(15, TimeUnit.SECONDS)).isTrue();
                var stopped = new java.util.concurrent.CountDownLatch(1);
                container.stop(stopped::countDown);
                releaseSecondAttempt.countDown();
                assertThat(stopped.await(15, TimeUnit.SECONDS)).isTrue();
            } finally {
                releaseSecondAttempt.countDown();
            }
            container.start();
            awaitDlt(consumer, event);
            assertThat(blockingAttempts).containsExactly(1, 2, 1);
            verify(recipients, times(2)).find(any(), any());
            assertThat(notices(event)).isEqualTo(1);
            var permanentEmail = deliveries.findByEventId(event.eventId()).stream()
                    .filter(row -> row.getChannel() == com.learnup.notification.entity.DeliveryChannel.EMAIL)
                    .findFirst().orElseThrow();
            assertThat(permanentEmail.getAttempts()).isEqualTo(2);
        } finally {
            if (!container.isRunning()) container.start();
        }
    }

    @Test void repeatedDltFailurePreservesSuppressionAndMeasuresRecoveryRate() throws Exception {
        measureRecoveryRate(Duration.ofSeconds(10), false);
    }

    @Test void exhaustedTransientDltFailureWaitsWithoutRepeatingPermanentEmail() throws Exception {
        measureRecoveryRate(Duration.ofSeconds(5), true);
    }

    @Test
    @org.junit.jupiter.api.Tag("dlt-default-delay")
    void defaultDelayMeasurementAndContainerStop() throws Exception {
        assertThat(eventProperties.getRetryMaxMs()).isEqualTo(30000);
        measureRecoveryRate(Duration.ofSeconds(90), true);
    }

    private void measureRecoveryRate(Duration duration, boolean exhaustedTransient) throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        when(emails.sendEmail(any())).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));
        if (exhaustedTransient) {
            doThrow(new IllegalStateException("TEST_IN_APP_TRANSIENT"))
                    .when(notificationSender).sendNotification(any());
        }
        rejectDlt.set(true);
        var measure = new AtomicBoolean();
        var logEvents = new java.util.concurrent.atomic.AtomicLong();
        var logLines = new java.util.concurrent.atomic.AtomicLong();
        var root = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        var appender = new ch.qos.logback.core.AppenderBase<ch.qos.logback.classic.spi.ILoggingEvent>() {
            @Override protected void append(ch.qos.logback.classic.spi.ILoggingEvent loggingEvent) {
                if (measure.get() && loggingEvent.getThreadName().contains(SubmissionFinalizedEventListener.LISTENER_ID)) {
                    logEvents.incrementAndGet();
                    long lines = loggingEvent.getFormattedMessage().lines().count();
                    if (loggingEvent.getThrowableProxy() != null) {
                        lines += ch.qos.logback.classic.spi.ThrowableProxyUtil.asString(loggingEvent.getThrowableProxy())
                                .lines().count();
                    }
                    logLines.addAndGet(lines);
                }
            }
        };
        appender.setContext(root.getLoggerContext());
        appender.start();
        root.addAppender(appender);
        try {
            var metadata = send(event);
            await().atMost(Duration.ofSeconds(15)).until(() -> failedDltSends.get() >= 1);
            int listenersBefore = blockingAttempts.size();
            int publishesBefore = failedDltSends.get();
            long start = System.nanoTime();
            measure.set(true);
            Thread.sleep(duration.toMillis());
            measure.set(false);
            double seconds = (System.nanoTime() - start) / 1_000_000_000.0;
            int listenerCount = blockingAttempts.size() - listenersBefore;
            int publishCount = failedDltSends.get() - publishesBefore;
            System.out.printf(java.util.Locale.ROOT,
                    "DLT_LOOP_METRICS seconds=%.6f listenerInvocations=%d listenerPerSecond=%.3f "
                    + "dltPublishes=%d dltPerSecond=%.3f logEvents=%d renderedLogLines=%d logLinesPerPublish=%.3f "
                    + "firstHeader=%d lastHeader=%d%n",
                    seconds, listenerCount, listenerCount / seconds, publishCount, publishCount / seconds,
                    logEvents.get(), logLines.get(), logLines.get() / (double) Math.max(1, publishCount),
                    blockingAttempts.getFirst(), blockingAttempts.getLast());
            assertThat(listenerCount).isPositive();
            assertThat(publishCount).isPositive();
            assertThat(publishCount / seconds).isLessThanOrEqualTo(1000.0 / eventProperties.getRetryMaxMs());
            long minimumSpacing = Long.MAX_VALUE;
            for (int i = 1; i < failedPublicationTimes.size(); i++) {
                long spacing = failedPublicationTimes.get(i) - failedPublicationTimes.get(i - 1);
                minimumSpacing = Math.min(minimumSpacing, spacing);
                assertThat(spacing).isGreaterThanOrEqualTo(TimeUnit.MILLISECONDS.toNanos(eventProperties.getRetryMaxMs()));
            }
            System.out.printf(java.util.Locale.ROOT, "DLT_SPACING waitMs=%d minimumSpacingMs=%.3f exhaustedTransient=%s%n",
                    eventProperties.getRetryMaxMs(), minimumSpacing / 1_000_000.0, exhaustedTransient);
            for (int i = 0; i < blockingAttempts.size(); i++) {
                assertThat(blockingAttempts.get(i)).isEqualTo(i + 1);
            }
            verify(recipients).find(any(), any());
            verify(emails).sendEmail(any());
            assertThat(notices(event)).isEqualTo(exhaustedTransient ? 0 : 1);
            try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
                var committed = admin.listConsumerGroupOffsets(GROUP).partitionsToOffsetAndMetadata()
                        .get(5, TimeUnit.SECONDS).get(new TopicPartition(TOPIC, 0));
                assertThat(committed == null || committed.offset() <= metadata.offset()).isTrue();
            }
            if (duration.equals(Duration.ofSeconds(90))) {
                var container = registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID);
                var stopped = new java.util.concurrent.CountDownLatch(1);
                long stopStart = System.nanoTime();
                container.stop(stopped::countDown);
                assertThat(stopped.await(2, TimeUnit.SECONDS)).isTrue();
                System.out.printf(java.util.Locale.ROOT, "DLT_CONTAINER_STOP elapsedMs=%.3f%n",
                        (System.nanoTime() - stopStart) / 1_000_000.0);
                return;
            }
            rejectDlt.set(false);
            await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
                try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
                    var committed = admin.listConsumerGroupOffsets(GROUP).partitionsToOffsetAndMetadata()
                            .get(5, TimeUnit.SECONDS).get(new TopicPartition(TOPIC, 0));
                    assertThat(committed.offset()).isGreaterThan(metadata.offset());
                }
            });
            assertThat(notices(event)).isEqualTo(exhaustedTransient ? 0 : 1);
            verify(recipients).find(any(), any());
        } finally {
            measure.set(false);
            rejectDlt.set(false);
            root.detachAppender(appender);
            appender.stop();
        }
    }
    @Test void bothPermanentChannelsDeadLetterOnTheFirstDelivery() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        doThrow(new PermanentDeliveryException("TENANT_REJECTED")).when(notificationSender).sendNotification(any());
        when(recipients.find(any(), any())).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));
        try (var consumer = dltReader()) {
            send(event);
            awaitDlt(consumer, event);
            assertThat(blockingAttempts).containsExactly(1);
            verify(notificationSender).sendNotification(any());
            verify(recipients).find(any(), any());
            assertThat(notices(event)).isZero();
            assertThat(deliveries.findByEventId(event.eventId())).hasSize(2).allSatisfy(row -> {
                assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
                assertThat(row.getLastError()).isEqualTo("TENANT_REJECTED");
            });
        }
    }}
