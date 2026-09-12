package com.learnup.common.event;

import java.util.concurrent.CompletableFuture;

/**
 * Technology-neutral event publishing contract for asynchronous domain events.
 */
public interface EventPublisher {

    /**
     * Publishes a domain event wrapped in a standard {@link GenericEventEnvelope}.
     *
     * @param topic          Target Kafka topic name (e.g. learnup.identity.user-registered.v1)
     * @param eventType      Event type identifier
     * @param organizationId Tenant organization ID used as partition key
     * @param correlationId  Trace correlation ID
     * @param payload        Domain payload object
     * @param <T>            Payload type
     * @return CompletableFuture completing when message is acknowledged by the broker
     */
    <T> CompletableFuture<Void> publish(String topic, String eventType, String organizationId, String correlationId, T payload);

    /**
     * Publishes a pre-constructed {@link GenericEventEnvelope}.
     *
     * @param topic    Target Kafka topic name
     * @param envelope Pre-built event envelope
     * @param <T>      Payload type
     * @return CompletableFuture completing when message is acknowledged by the broker
     */
    <T> CompletableFuture<Void> publish(String topic, GenericEventEnvelope<T> envelope);
}
