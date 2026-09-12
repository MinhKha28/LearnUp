package com.learnup.common.event;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GenericEventEnvelopeTest {

    @Test
    @DisplayName("Should create event envelope with default UUID and timestamp")
    void shouldCreateEventEnvelope() {
        Map<String, String> payload = Map.of("key", "value");

        GenericEventEnvelope<Map<String, String>> envelope = GenericEventEnvelope.of(
                "learnup.identity.user-registered.v1",
                "identity-service",
                "org_100",
                "corr_200",
                payload
        );

        assertThat(envelope.getEventId()).isNotBlank();
        assertThat(envelope.getEventType()).isEqualTo("learnup.identity.user-registered.v1");
        assertThat(envelope.getProducer()).isEqualTo("identity-service");
        assertThat(envelope.getOrganizationId()).isEqualTo("org_100");
        assertThat(envelope.getCorrelationId()).isEqualTo("corr_200");
        assertThat(envelope.getPayload()).isEqualTo(payload);
        assertThat(envelope.getOccurredAt()).isNotNull();
    }
}
