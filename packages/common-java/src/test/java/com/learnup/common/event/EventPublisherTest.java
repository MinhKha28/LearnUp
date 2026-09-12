package com.learnup.common.event;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;

class EventPublisherTest {

    private InMemoryEventPublisher publisher;

    @BeforeEach
    void setUp() {
        this.publisher = new InMemoryEventPublisher("identity-service");
    }

    @Test
    @DisplayName("Should record published events in-memory")
    void shouldPublishEventsInMemory() throws Exception {
        Map<String, String> payload = Map.of("email", "user@enterprise.com");

        CompletableFuture<Void> future = this.publisher.publish(
                "learnup.identity.user-registered.v1",
                "identity.user.registered",
                "org_123",
                "corr_456",
                payload
        );

        future.get();

        List<InMemoryEventPublisher.PublishedEventRecord> records = this.publisher.getPublishedEvents();
        assertThat(records).hasSize(1);

        InMemoryEventPublisher.PublishedEventRecord record = records.get(0);
        assertThat(record.topic()).isEqualTo("learnup.identity.user-registered.v1");
        assertThat(record.envelope().getOrganizationId()).isEqualTo("org_123");
        assertThat(record.envelope().getProducer()).isEqualTo("identity-service");
        assertThat(record.envelope().getPayload()).isEqualTo(payload);
    }
}
