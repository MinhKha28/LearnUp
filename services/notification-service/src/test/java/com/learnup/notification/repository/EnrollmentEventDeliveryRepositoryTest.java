package com.learnup.notification.repository;

import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The entity against the schema that the migrations really build: Flyway makes the tables and Hibernate only
 * validates them (the way production runs), so a column that the entity and the migration do not agree on fails here.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.datasource.url=jdbc:h2:mem:delivery_repository;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
class EnrollmentEventDeliveryRepositoryTest {

    /** Only the JPA part: the application scans its web layer too, which this test does not need. */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan("com.learnup.notification.entity")
    @EnableJpaRepositories("com.learnup.notification.repository")
    static class JpaOnlyConfig {
    }

    private static final Instant NOW = Instant.parse("2026-10-27T01:00:00Z");

    @Autowired
    private EnrollmentEventDeliveryRepository repository;

    private EnrollmentEventDelivery delivery(UUID event, UUID person, DeliveryChannel channel) {
        return new EnrollmentEventDelivery(event, "EnrollmentAssigned", UUID.randomUUID(), UUID.randomUUID(),
                person, channel, NOW, NOW);
    }

    @Test
    void aDeliveryIsStoredAndFoundByEventPersonAndChannel() {
        UUID event = UUID.randomUUID();
        UUID person = UUID.randomUUID();
        EnrollmentEventDelivery saved = repository.saveAndFlush(delivery(event, person, DeliveryChannel.EMAIL));

        EnrollmentEventDelivery found = repository
                .findByEventIdAndRecipientUserIdAndChannel(event, person, DeliveryChannel.EMAIL).orElseThrow();
        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(found.getOccurredAt()).isEqualTo(NOW);
        assertThat(repository.findByEventIdAndRecipientUserIdAndChannel(event, person, DeliveryChannel.IN_APP)).isEmpty();
    }

    @Test
    void theStateOfADeliveryIsKept() {
        UUID event = UUID.randomUUID();
        UUID person = UUID.randomUUID();
        EnrollmentEventDelivery delivery = repository.saveAndFlush(delivery(event, person, DeliveryChannel.IN_APP));
        delivery.startAttempt(NOW.plusSeconds(1));
        delivery.markFailed("TENANT_UNAVAILABLE", NOW.plusSeconds(1));
        repository.saveAndFlush(delivery);

        EnrollmentEventDelivery found = repository
                .findByEventIdAndRecipientUserIdAndChannel(event, person, DeliveryChannel.IN_APP).orElseThrow();
        assertThat(found.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(found.getLastError()).isEqualTo("TENANT_UNAVAILABLE");
        assertThat(found.getAttempts()).isEqualTo(1);
    }

    @Test
    void aSecondRowForTheSameEventPersonAndChannelIsRefused() {
        UUID event = UUID.randomUUID();
        UUID person = UUID.randomUUID();
        repository.saveAndFlush(delivery(event, person, DeliveryChannel.EMAIL));
        assertThatThrownBy(() -> repository.saveAndFlush(delivery(event, person, DeliveryChannel.EMAIL)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theDeliveriesOfAnEventAreListed() {
        UUID event = UUID.randomUUID();
        UUID person = UUID.randomUUID();
        repository.saveAndFlush(delivery(event, person, DeliveryChannel.EMAIL));
        repository.saveAndFlush(delivery(event, person, DeliveryChannel.IN_APP));
        repository.saveAndFlush(delivery(UUID.randomUUID(), person, DeliveryChannel.EMAIL));
        assertThat(repository.findByEventId(event)).hasSize(2);
    }
}
