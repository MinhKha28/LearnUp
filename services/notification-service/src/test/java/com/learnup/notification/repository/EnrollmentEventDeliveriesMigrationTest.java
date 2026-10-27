package com.learnup.notification.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The real migrations (V1, V2) run on a fresh database, and the rules of the table are the ones of the database. */
class EnrollmentEventDeliveriesMigrationTest {

    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:delivery_migration;DB_CLOSE_DELAY=-1;MODE=PostgreSQL", "sa", "");
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(dataSource);
    }

    private static final UUID ORGANIZATION = UUID.randomUUID();

    private static void insert(UUID eventId, UUID recipient, String channel, String status, int attempts) {
        jdbc.update("""
                INSERT INTO enrollment_event_deliveries
                  (id, event_id, event_type, organization_id, enrollment_id, recipient_user_id, channel, status, attempts, occurred_at)
                VALUES (?, ?, 'EnrollmentAssigned', ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), eventId, ORGANIZATION, UUID.randomUUID(), recipient, channel, status, attempts,
                Timestamp.from(Instant.parse("2026-10-27T01:00:00Z")));
    }

    @Test
    void theSameEventForTheSamePersonOnTheSameChannelCannotBeWrittenTwice() {
        UUID event = UUID.randomUUID();
        UUID person = UUID.randomUUID();
        insert(event, person, "EMAIL", "PENDING", 0);
        assertThatThrownBy(() -> insert(event, person, "EMAIL", "PENDING", 0))
                .hasMessageContaining("uq_enrollment_event_delivery".toUpperCase());
    }

    @Test
    void anotherChannelAnotherPersonOrAnotherEventIsAnotherDelivery() {
        UUID event = UUID.randomUUID();
        UUID person = UUID.randomUUID();
        insert(event, person, "EMAIL", "PENDING", 0);
        insert(event, person, "IN_APP", "PENDING", 0);
        insert(event, UUID.randomUUID(), "EMAIL", "PENDING", 0);
        insert(UUID.randomUUID(), person, "EMAIL", "PENDING", 0);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM enrollment_event_deliveries WHERE event_id = ?", Integer.class, event)).isEqualTo(3);
    }

    @Test
    void onlyTheFourStatesAreAccepted() {
        for (String status : new String[]{"PENDING", "SENT", "FAILED", "SKIPPED"}) {
            insert(UUID.randomUUID(), UUID.randomUUID(), "EMAIL", status, 0);
        }
        assertThatThrownBy(() -> insert(UUID.randomUUID(), UUID.randomUUID(), "EMAIL", "DONE", 0))
                .hasMessageContaining("CK_ENROLLMENT_EVENT_DELIVERY_STATUS");
    }

    @Test
    void onlyTheTwoChannelsAreAccepted() {
        assertThatThrownBy(() -> insert(UUID.randomUUID(), UUID.randomUUID(), "SMS", "PENDING", 0))
                .hasMessageContaining("CK_ENROLLMENT_EVENT_DELIVERY_CHANNEL");
    }

    @Test
    void theNumberOfAttemptsIsNeverNegative() {
        assertThatThrownBy(() -> insert(UUID.randomUUID(), UUID.randomUUID(), "EMAIL", "PENDING", -1))
                .hasMessageContaining("CK_ENROLLMENT_EVENT_DELIVERY_ATTEMPTS");
    }
}
