package com.learnup.notification.enrollment;

import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.service.NotificationService;
import com.learnup.notification.client.RecipientDirectory;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.kafka.listener.AbstractMessageListenerContainer;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;
import java.util.Optional;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "learnup.submission-finalized.enabled=true", "learnup.submission-finalized.topic=test.consumer-owned",
        "learnup.submission-finalized.group-id=consumer-owned-test", "learnup.submission-finalized.start-retry-ms=100",
        "learnup.frontend-base-url=https://frontend.example", "spring.kafka.admin.auto-create=false",
        "learnup.enrollment-events.enabled=true", "learnup.course-events.enabled=true",
        "spring.kafka.consumer.properties.allow.auto.create.topics=true",
        "spring.datasource.url=jdbc:h2:mem:consumer_creation;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, brokerProperties = {"auto.create.topics.enable=true", "num.partitions=1"},
        bootstrapServersProperty = "spring.kafka.bootstrap-servers")
@DirtiesContext
class NotificationConsumerTopicCreationTest {
    private static final String TOPIC = "test.consumer-owned";
    private static final Duration ABSENT_OBSERVATION = Duration.ofSeconds(5);
    @Autowired EmbeddedKafkaBroker broker;
    @Autowired KafkaListenerEndpointRegistry registry;
    @Autowired KafkaTemplate<String, String> kafka;
    @Autowired EnrollmentEventDeliveryRepository deliveries;
    @Autowired NotificationService notifications;
    @MockBean RecipientDirectory recipients;

    @Test void everyRegisteredListenerDisablesTopicCreationEvenWhenPropertiesEnableIt() {
        assertThat(registry.getListenerContainers()).hasSize(3);
        registry.getListenerContainers().forEach(container -> {
            var listener = (AbstractMessageListenerContainer<?, ?>) container;
            var consumers = (ConsumerFactory<?, ?>) ReflectionTestUtils.getField(listener, "consumerFactory");
            assertThat(consumers).isNotNull();
            assertThat(consumers.getConfigurationProperties())
                    .as(container.getListenerId()).containsEntry(ConsumerConfig.ALLOW_AUTO_CREATE_TOPICS_CONFIG, false);
        });
    }

    @Test void waitsWithoutCreatingThenConsumesOnceAfterProvisioning() throws Exception {
        when(recipients.find(any(), any())).thenReturn(Optional.empty());
        var listener = registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID);
        await().atMost(Duration.ofSeconds(10)).until(listener::isRunning);
        try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBrokersAsString()))) {
            await().during(ABSENT_OBSERVATION).atMost(ABSENT_OBSERVATION.plusSeconds(5)).untilAsserted(() ->
                    assertThat(admin.listTopics().names().get(5, TimeUnit.SECONDS)).doesNotContain(TOPIC));
            long started = System.nanoTime();
            admin.createTopics(List.of(new NewTopic(TOPIC, 3, (short) 1)))
                    .all().get(10, TimeUnit.SECONDS);
            await().atMost(Duration.ofSeconds(330)).until(() -> listener.getAssignedPartitions() != null
                    && listener.getAssignedPartitions().size() == 3);
            System.out.printf("TOPIC_ASSIGNMENT_DELAY_MS=%d%n", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
        }
        var event = SubmissionFinalizedEventParserTest.event();
        kafka.send(TOPIC, event.learnerId().toString(), SubmissionFinalizedEventParserTest.envelope(event).toString())
                .get(10, TimeUnit.SECONDS);
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            assertThat(deliveries.findByEventId(event.eventId())).hasSize(2)
                    .allSatisfy(row -> assertThat(row.getStatus().isFinal()).isTrue());
            assertThat(notifications.getUnreadCount(event.learnerId(), event.organizationId())).isEqualTo(1);
        });
    }
}
