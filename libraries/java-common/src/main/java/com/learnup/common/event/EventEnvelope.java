package com.learnup.common.event;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Standard envelope representation for all asynchronous domain events published to Apache Kafka.
 * Conforms to the JSON schema defined in contracts/events/event-envelope.schema.json.
 *
 * @param <T> Domain payload type
 */
public class EventEnvelope<T> {

    private final String eventId;
    private final String eventType;
    private final int version;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private final Instant occurredAt;

    private final String organizationId;
    private final String producer;
    private final T data;

    @JsonCreator
    public EventEnvelope(
            @JsonProperty("eventId") String eventId,
            @JsonProperty("eventType") String eventType,
            @JsonProperty("version") int version,
            @JsonProperty("occurredAt") Instant occurredAt,
            @JsonProperty("organizationId") String organizationId,
            @JsonProperty("producer") String producer,
            @JsonProperty("data") T data) {
        this.eventId = Objects.requireNonNull(eventId, "eventId must not be null");
        this.eventType = Objects.requireNonNull(eventType, "eventType must not be null");
        this.version = version > 0 ? version : 1;
        this.occurredAt = occurredAt != null ? occurredAt : Instant.now();
        this.organizationId = Objects.requireNonNull(organizationId, "organizationId must not be null");
        this.producer = Objects.requireNonNull(producer, "producer must not be null");
        this.data = Objects.requireNonNull(data, "data payload must not be null");
    }

    /**
     * Factory method for creating a new v1 domain event.
     *
     * @param eventType PascalCase domain event type (e.g. CourseCompleted)
     * @param organizationId tenant organization UUID as String
     * @param producer originating microservice name
     * @param data domain event payload
     * @param <T> payload type
     * @return new EventEnvelope instance
     */
    public static <T> EventEnvelope<T> create(String eventType, String organizationId, String producer, T data) {
        return new EventEnvelope<>(
                UUID.randomUUID().toString(),
                eventType,
                1,
                Instant.now(),
                organizationId,
                producer,
                data
        );
    }

    /**
     * Factory method with UUID organizationId.
     */
    public static <T> EventEnvelope<T> create(String eventType, UUID organizationId, String producer, T data) {
        return create(
                eventType,
                Objects.requireNonNull(organizationId, "organizationId must not be null").toString(),
                producer,
                data
        );
    }

    public String getEventId() {
        return eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public int getVersion() {
        return version;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getOrganizationId() {
        return organizationId;
    }

    @JsonIgnore
    public UUID getOrganizationIdAsUuid() {
        return organizationId != null ? UUID.fromString(organizationId) : null;
    }

    public String getProducer() {
        return producer;
    }

    public T getData() {
        return data;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EventEnvelope<?> that = (EventEnvelope<?>) o;
        return version == that.version &&
               Objects.equals(eventId, that.eventId) &&
               Objects.equals(eventType, that.eventType) &&
               Objects.equals(occurredAt, that.occurredAt) &&
               Objects.equals(organizationId, that.organizationId) &&
               Objects.equals(producer, that.producer) &&
               Objects.equals(data, that.data);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId, eventType, version, occurredAt, organizationId, producer, data);
    }

    @Override
    public String toString() {
        return "EventEnvelope{" +
               "eventId='" + eventId + '\'' +
               ", eventType='" + eventType + '\'' +
               ", version=" + version +
               ", occurredAt=" + occurredAt +
               ", organizationId='" + organizationId + '\'' +
               ", producer='" + producer + '\'' +
               ", data=" + data +
               '}';
    }
}
