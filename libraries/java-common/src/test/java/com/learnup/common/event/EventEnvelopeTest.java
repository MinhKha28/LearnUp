package com.learnup.common.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EventEnvelopeTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    @DisplayName("Should create EventEnvelope and serialize to JSON matching P0 schema contract")
    void shouldSerializeEventEnvelopeMatchingSchema() throws JsonProcessingException {
        UUID orgId = UUID.randomUUID();
        Map<String, Object> payload = Map.of(
                "learnerId", "123e4567-e89b-12d3-a456-426614174000",
                "courseId", "987fcdeb-51a2-43d7-b890-abcdef123456",
                "finalScore", 95.5
        );

        EventEnvelope<Map<String, Object>> event = EventEnvelope.create(
                "CourseCompleted",
                orgId,
                "learning-service",
                payload
        );

        assertThat(event.getEventId()).isNotBlank();
        assertThat(event.getEventType()).isEqualTo("CourseCompleted");
        assertThat(event.getVersion()).isEqualTo(1);
        assertThat(event.getOccurredAt()).isNotNull();
        assertThat(event.getOrganizationId()).isEqualTo(orgId.toString());
        assertThat(event.getOrganizationIdAsUuid()).isEqualTo(orgId);
        assertThat(event.getProducer()).isEqualTo("learning-service");
        assertThat(event.getData()).isEqualTo(payload);

        String json = objectMapper.writeValueAsString(event);

        // Verify JSON keys match contracts/events/event-envelope.schema.json exactly
        assertThat(json).contains("\"eventId\":\"" + event.getEventId() + "\"");
        assertThat(json).contains("\"eventType\":\"CourseCompleted\"");
        assertThat(json).contains("\"version\":1");
        assertThat(json).contains("\"occurredAt\":");
        assertThat(json).contains("\"organizationId\":\"" + orgId + "\"");
        assertThat(json).contains("\"producer\":\"learning-service\"");
        assertThat(json).contains("\"data\":{");
        assertThat(json).contains("\"finalScore\":95.5");

        // Verify deserialization back into EventEnvelope
        EventEnvelope<Map<String, Object>> deserialized = objectMapper.readValue(
                json,
                new TypeReference<>() {}
        );

        assertThat(deserialized.getEventId()).isEqualTo(event.getEventId());
        assertThat(deserialized.getEventType()).isEqualTo("CourseCompleted");
        assertThat(deserialized.getVersion()).isEqualTo(1);
        assertThat(deserialized.getOrganizationId()).isEqualTo(orgId.toString());
        assertThat(deserialized.getProducer()).isEqualTo("learning-service");
        assertThat(deserialized.getData().get("finalScore")).isEqualTo(95.5);
    }
}
