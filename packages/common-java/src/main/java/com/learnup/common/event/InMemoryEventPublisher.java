package com.learnup.common.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory implementation of {@link EventPublisher} designed for testing and offline environments.
 */
public class InMemoryEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(InMemoryEventPublisher.class);

    private final List<PublishedEventRecord> publishedEvents = new CopyOnWriteArrayList<>();
    private final String producerServiceName;

    public InMemoryEventPublisher(String producerServiceName) {
        this.producerServiceName = producerServiceName != null ? producerServiceName : "test-service";
    }

    public InMemoryEventPublisher() {
        this("test-service");
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
        log.debug("InMemoryEventPublisher received event for topic: {} -> {}", topic, envelope.getEventId());
        publishedEvents.add(new PublishedEventRecord(topic, envelope));
        return CompletableFuture.completedFuture(null);
    }

    public List<PublishedEventRecord> getPublishedEvents() {
        return Collections.unmodifiableList(new ArrayList<>(publishedEvents));
    }

    public void clear() {
        publishedEvents.clear();
    }

    public record PublishedEventRecord(String topic, GenericEventEnvelope<?> envelope) {}
}
