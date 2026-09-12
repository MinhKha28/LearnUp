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
 * CloudEvent-compatible generic event envelope for all Kafka domain events in Java.
 *
 * @param <T> Payload domain data type
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GenericEventEnvelope<T> {

    @Builder.Default
    private String id = UUID.randomUUID().toString();

    private String source;

    private String type;

    @Builder.Default
    private String specversion = "1.0";

    @Builder.Default
    private String datacontenttype = "application/json";

    @Builder.Default
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant time = Instant.now();

    private String organizationId;

    private String correlationId;

    private T data;

    public static <T> GenericEventEnvelope<T> of(String source, String type, String organizationId, String correlationId, T data) {
        return GenericEventEnvelope.<T>builder()
                .id(UUID.randomUUID().toString())
                .source(source)
                .type(type)
                .specversion("1.0")
                .datacontenttype("application/json")
                .time(Instant.now())
                .organizationId(organizationId)
                .correlationId(correlationId)
                .data(data)
                .build();
    }
}
