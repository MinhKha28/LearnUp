package com.learnup.audit.service;

import com.learnup.audit.dto.CreateAuditLogRequest;
import com.learnup.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** UC23: Audit must be idempotent when the Course relay retries after a network failure. */
@SpringBootTest
@ActiveProfiles("test")
class AuditLogIdempotencyTest {
    @Autowired private AuditLogService service;
    @Autowired private AuditLogRepository repository;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void clear() {
        repository.deleteAll();
        // H2 unit profile disables Flyway. Reproduce the V3 uniqueness invariant.
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_test_action_correlation "
                + "ON audit_logs(action_type, correlation_id)");
    }

    private static CreateAuditLogRequest newRequest(String correlationId) {
        CreateAuditLogRequest request = new CreateAuditLogRequest(
                UUID.randomUUID(), UUID.randomUUID(), "ORGANIZER",
                "COURSE_OWNERSHIP_TRANSFERRED", "CourseChain", UUID.randomUUID().toString(),
                "{\"reason\":\"reassigned\"}", null, correlationId);
        request.setOccurredAt(Instant.parse("2026-11-10T12:00:00Z"));
        return request;
    }

    @Test
    void duplicateCorrelationIdReturnsTheExistingAuditAndPreservesActionTime() {
        var request = newRequest(UUID.randomUUID().toString());
        var first = service.recordAuditLog(request);
        var repeated = service.recordAuditLog(request);

        assertThat(repeated.getId()).isEqualTo(first.getId());
        assertThat(first.getCreatedAt()).isEqualTo(request.getOccurredAt());
        assertThat(repeated.getCreatedAt()).isEqualTo(request.getOccurredAt());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void newOutboxCorrelationIdCreatesAnotherAction() {
        service.recordAuditLog(newRequest(UUID.randomUUID().toString()));
        service.recordAuditLog(newRequest(UUID.randomUUID().toString()));
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test
    void rejectsImplausibleActionTimestamp() {
        var request = newRequest(UUID.randomUUID().toString());
        request.setOccurredAt(Instant.parse("2010-01-01T00:00:00Z"));
        assertThatThrownBy(() -> service.recordAuditLog(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("occurredAt");
        assertThat(repository.count()).isZero();
    }
}
