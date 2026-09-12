package com.learnup.common.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Spring Kafka implementation of {@link EventPublisher}.
 * Uses organizationId as the default message partition key.
 */
public class KafkaEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(KafkaEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String producerServiceName;

    public KafkaEventPublisher(KafkaTemplate<String, Object> kafkaTemplate, String producerServiceName) {
        this.kafkaTemplate = Objects.requireNonNull(kafkaTemplate, "KafkaTemplate must not be null");
        this.producerServiceName = producerServiceName != null ? producerServiceName : "learnup-service";
    }

    @Override
    public <T> CompletableFuture<Void> publish(String topic, String eventType, String organizationId, String correlationId, T payload) {
        GenericEventEnvelope<T> envelope = GenericEventEnvelope.of(
                eventType,
                this.producerServiceName,
                organizationId,
                correlationId,
                payload
        );
        return publish(topic, envelope);
    }

    @Override
    public <T> CompletableFuture<Void> publish(String topic, GenericEventEnvelope<T> envelope) {
        Objects.requireNonNull(topic, "Topic must not be null");
        Objects.requireNonNull(envelope, "Envelope must not be null");

        String partitionKey = envelope.getOrganizationId() != null
                ? envelope.getOrganizationId()
                : envelope.getEventId();

        log.debug("Publishing Kafka event [Type: {}, ID: {}, Key: {}] to topic: {}",
                envelope.getEventType(), envelope.getEventId(), partitionKey, topic);

        CompletableFuture<SendResult<String, Object>> sendFuture = this.kafkaTemplate.send(topic, partitionKey, envelope);

        return sendFuture.thenAccept(result -> {
            log.info("Successfully published Kafka event [ID: {}] to topic: {} at offset: {}",
                    envelope.getEventId(), topic, result.getRecordMetadata().offset());
        }).exceptionally(ex -> {
            log.error("Failed to publish Kafka event [ID: {}] to topic: {}: {}",
                    envelope.getEventId(), topic, ex.getMessage(), ex);
            throw new RuntimeException("Kafka event publish failed for topic " + topic, ex);
        });
    }
}
