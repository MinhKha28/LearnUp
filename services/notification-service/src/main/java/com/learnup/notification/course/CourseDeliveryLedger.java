package com.learnup.notification.course;

import com.learnup.notification.enrollment.DependencyUnavailableException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Each (event, recipient, channel) has one durable obligation. A claim carries its attempt number and claim time,
 * so a consumer whose lease was taken over cannot write SENT, SKIPPED or FAILED for the new owner.
 * Kafka is at-least-once; SMTP cannot join a transaction, so a crash after sending e-mail but before SENT may resend it.
 */
@Component
public class CourseDeliveryLedger {
    static final Duration CLAIM_LEASE = Duration.ofSeconds(120);
    static final String CLAIM_LOST = "COURSE_DELIVERY_CLAIM_LOST";

    public record Claim(CourseDeliveryTable table, UUID id, int attempts, OffsetDateTime claimedAt) {}

    public record Obligation(UUID eventId, UUID organizationId, UUID courseId, Instant occurredAt,
                             UUID recipientUserId, String channel) {}

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;

    public CourseDeliveryLedger(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(manager);
    }

    /** @return the claim, or empty when the obligation is already SENT or SKIPPED */
    public Optional<Claim> claim(CourseDeliveryTable table, Obligation obligation) {
        return transaction.execute(status -> {
            jdbc.update("""
                INSERT INTO %s
                    (id, event_id, organization_id, course_id, recipient_user_id,
                     channel, status, occurred_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, now(), now())
                ON CONFLICT DO NOTHING
                """.formatted(table.tableName()), UUID.randomUUID(), obligation.eventId(),
                    obligation.organizationId(), obligation.courseId(), obligation.recipientUserId(),
                    obligation.channel(), utc(obligation.occurredAt()));

            int affected = jdbc.update("""
                UPDATE %s
                SET status = 'PROCESSING', claimed_at = ?, attempts = attempts + 1,
                    updated_at = now(), last_error = NULL
                WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
                  AND (status IN ('PENDING', 'FAILED')
                       OR (status = 'PROCESSING' AND claimed_at < ?))
                """.formatted(table.tableName()), utc(Instant.now()), obligation.eventId(),
                    obligation.recipientUserId(), obligation.channel(), utc(Instant.now().minus(CLAIM_LEASE)));

            Row row = jdbc.queryForObject("""
                SELECT id, status, attempts, claimed_at FROM %s
                WHERE event_id = ? AND recipient_user_id = ? AND channel = ?
                """.formatted(table.tableName()), Row.MAPPER, obligation.eventId(),
                    obligation.recipientUserId(), obligation.channel());

            if (affected == 1) return Optional.of(new Claim(table, row.id(), row.attempts(), row.claimedAt()));
            if ("SENT".equals(row.status()) || "SKIPPED".equals(row.status())) return Optional.<Claim>empty();
            throw new DependencyUnavailableException(table.claimedCode());
        });
    }

    /** Writes the in-app notice and SENT in one transaction, only while the claim still owns the obligation. */
    public void deliverInApp(Claim claim, Runnable writeNotice) {
        transaction.executeWithoutResult(status -> {
            requireOwnedLocked(claim);
            writeNotice.run();
            if (mark(claim, "SENT", null) != 1) throw new DependencyUnavailableException(CLAIM_LOST);
        });
    }

    /** Rechecks ownership before an external send, such as SMTP, that cannot join the transaction. */
    public void requireOwned(Claim claim) {
        transaction.executeWithoutResult(status -> requireOwnedLocked(claim));
    }

    public void sent(Claim claim) {
        finish(claim, "SENT");
    }

    /** Nothing to deliver to this recipient on this channel (for example a missing e-mail address). */
    public void skipped(Claim claim) {
        finish(claim, "SKIPPED");
    }

    /** Records the failure only while the claim still owns the obligation; a newer owner is left alone. */
    public void failIfOwned(Claim claim, String code) {
        transaction.executeWithoutResult(status -> mark(claim, "FAILED", code));
    }

    private void finish(Claim claim, String finalStatus) {
        transaction.executeWithoutResult(status -> {
            requireOwnedLocked(claim);
            if (mark(claim, finalStatus, null) != 1) throw new DependencyUnavailableException(CLAIM_LOST);
        });
    }

    private void requireOwnedLocked(Claim claim) {
        List<Row> rows = jdbc.query("""
            SELECT id, status, attempts, claimed_at FROM %s WHERE id = ? FOR UPDATE
            """.formatted(claim.table().tableName()), Row.MAPPER, claim.id());
        if (rows.size() != 1 || !rows.get(0).ownedBy(claim)) throw new DependencyUnavailableException(CLAIM_LOST);
    }

    private int mark(Claim claim, String finalStatus, String code) {
        String sentAt = "SENT".equals(finalStatus) ? ", sent_at = now()" : "";
        return jdbc.update("""
            UPDATE %s
            SET status = ?, claimed_at = NULL, last_error = ?, updated_at = now()%s
            WHERE id = ? AND status = 'PROCESSING' AND attempts = ? AND claimed_at = ?
            """.formatted(claim.table().tableName(), sentAt), finalStatus, code,
                claim.id(), claim.attempts(), claim.claimedAt());
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }

    private record Row(UUID id, String status, int attempts, OffsetDateTime claimedAt) {
        static final org.springframework.jdbc.core.RowMapper<Row> MAPPER = (rs, n) -> new Row(
                rs.getObject("id", UUID.class), rs.getString("status"), rs.getInt("attempts"),
                rs.getObject("claimed_at", OffsetDateTime.class));

        boolean ownedBy(Claim claim) {
            return "PROCESSING".equals(status) && attempts == claim.attempts()
                    && claimedAt != null && claimedAt.toInstant().equals(claim.claimedAt().toInstant());
        }
    }
}
