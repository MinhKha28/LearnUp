package com.learnup.common.event;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Standardized generic event envelope wrapping all asynchronous Kafka event messages across LearnUP.
 *
 * @param <T> Domain event payload type
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GenericEventEnvelope<T> {

    @Builder.Default
    private String eventId = UUID.randomUUID().toString();

    private String eventType;

    @Builder.Default
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant occurredAt = Instant.now();

    private String producer;

    private T payload;

    private String organizationId;

    private String correlationId;

    public static <T> GenericEventEnvelope<T> of(String eventType, String producer, String organizationId, String correlationId, T payload) {
        return GenericEventEnvelope.<T>builder()
                .eventId(UUID.randomUUID().toString())
                .eventType(eventType)
                .occurredAt(Instant.now())
                .producer(producer)
                .organizationId(organizationId)
                .correlationId(correlationId)
                .payload(payload)
                .build();
    }
}
