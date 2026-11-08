package com.learnup.notification.course;

import com.learnup.notification.enrollment.DependencyUnavailableException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * Each (event, recipient, channel) has one durable obligation.
 * Atomic SQL claim prevents concurrent consumers from delivering the same channel.
 * Kafka is at-least-once; a crash after an external send but before SENT may duplicate it.
 */
@Component
public class CourseSubmissionDeliveryLedger {
    private final JdbcTemplate jdbc;

    public CourseSubmissionDeliveryLedger(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean claim(CourseSubmittedEvent event, UUID recipient, String channel) {
        jdbc.update("""
            INSERT INTO course_submission_deliveries
                (id, event_id, organization_id, course_id, recipient_user_id,
                 channel, status, occurred_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, now(), now())
            ON CONFLICT (event_id, recipient_user_id, channel) DO NOTHING
            """, UUID.randomUUID(), event.eventId(), event.organizationId(), event.courseId(),
                recipient, channel, Timestamp.from(event.occurredAt()));

        int affected = jdbc.update("""
            UPDATE course_submission_deliveries
            SET status = 'PROCESSING', claimed_at = now(), attempts = attempts + 1,
                updated_at = now(), last_error = NULL
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND (status IN ('PENDING', 'FAILED')
                   OR (status = 'PROCESSING' AND claimed_at < ?))
            """, event.eventId(), recipient, channel,
                Timestamp.from(Instant.now().minusSeconds(120)));

        if (affected == 1) return true;
        String status = jdbc.queryForObject("""
            SELECT status FROM course_submission_deliveries
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
            """, String.class, event.eventId(), recipient, channel);

        if ("SENT".equals(status) || "SKIPPED".equals(status)) return false;
        throw new DependencyUnavailableException("COURSE_DELIVERY_CLAIMED");
    }

    public void sent(UUID eventId, UUID recipient, String channel) {
        jdbc.update("""
            UPDATE course_submission_deliveries
            SET status = 'SENT', claimed_at = NULL, sent_at = now(),
                updated_at = now(), last_error = NULL
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND status = 'PROCESSING'
            """, eventId, recipient, channel);
    }

    public void failed(UUID eventId, UUID recipient, String channel, String code) {
        jdbc.update("""
            UPDATE course_submission_deliveries
            SET status = 'FAILED', claimed_at = NULL, last_error = ?,
                updated_at = now()
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND status = 'PROCESSING'
            """, code, eventId, recipient, channel);
    }
}
