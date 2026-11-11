package com.learnup.notification.course;

import com.learnup.notification.enrollment.DependencyUnavailableException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Component
public class CourseOwnershipDeliveryLedger {
    private final JdbcTemplate jdbc;

    public CourseOwnershipDeliveryLedger(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean claim(CourseOwnershipTransferredEvent event, UUID recipient, String channel) {
        jdbc.update("""
            INSERT INTO course_ownership_deliveries
                (id, event_id, organization_id, course_id, recipient_user_id,
                 channel, status, occurred_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, now(), now())
            ON CONFLICT (event_id, recipient_user_id, channel) DO NOTHING
            """, UUID.randomUUID(), event.eventId(), event.organizationId(), event.courseId(),
                recipient, channel, Timestamp.from(event.occurredAt()));

        int updated = jdbc.update("""
            UPDATE course_ownership_deliveries
            SET status = 'PROCESSING', claimed_at = now(), attempts = attempts + 1,
                updated_at = now(), last_error = NULL
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND (status IN ('PENDING', 'FAILED')
                   OR (status = 'PROCESSING' AND claimed_at < ?))
            """, event.eventId(), recipient, channel,
                Timestamp.from(Instant.now().minusSeconds(120)));
        if (updated == 1) return true;

        String status = jdbc.queryForObject("""
            SELECT status FROM course_ownership_deliveries
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
            """, String.class, event.eventId(), recipient, channel);
        if ("SENT".equals(status) || "SKIPPED".equals(status)) return false;
        throw new DependencyUnavailableException("OWNERSHIP_DELIVERY_CLAIMED");
    }

    public void sent(UUID eventId, UUID recipient, String channel) {
        jdbc.update("""
            UPDATE course_ownership_deliveries
            SET status = 'SENT', claimed_at = NULL, sent_at = now(),
                updated_at = now(), last_error = NULL
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND status = 'PROCESSING'
            """, eventId, recipient, channel);
    }

    public void failed(UUID eventId, UUID recipient, String channel, String error) {
        jdbc.update("""
            UPDATE course_ownership_deliveries
            SET status = 'FAILED', claimed_at = NULL, last_error = ?,
                updated_at = now()
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND status = 'PROCESSING'
            """, error, eventId, recipient, channel);
    }

    public void skipped(UUID eventId, UUID recipient, String channel) {
        jdbc.update("""
            UPDATE course_ownership_deliveries
            SET status = 'SKIPPED', claimed_at = NULL, updated_at = now()
            WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
              AND status = 'PROCESSING'
            """, eventId, recipient, channel);
    }
}
