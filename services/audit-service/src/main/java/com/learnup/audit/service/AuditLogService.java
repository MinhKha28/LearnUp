package com.learnup.audit.service;

import com.learnup.audit.dto.AuditLogResponse;
import com.learnup.audit.dto.CreateAuditLogRequest;
import com.learnup.audit.entity.AuditLog;
import com.learnup.audit.repository.AuditLogRepository;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.PageResponse;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /** A little clock difference between two services is normal; an action dated further in the future than this is refused. */
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(5);
    /** The platform did not exist before this: a date earlier than it (an epoch of 0, a number out of range) is a writer's mistake. */
    private static final Instant EARLIEST_ACTION = Instant.parse("2020-01-01T00:00:00Z");

    @Transactional
    public AuditLogResponse recordAuditLog(CreateAuditLogRequest request) {
        Instant now = Instant.now();
        Instant occurredAt = request.getOccurredAt();
        if (occurredAt != null && occurredAt.isAfter(now.plus(CLOCK_SKEW))) {
            throw BusinessException.badRequest("occurredAt cannot be in the future");
        }
        if (occurredAt != null && occurredAt.isBefore(EARLIEST_ACTION)) {
            throw BusinessException.badRequest("occurredAt is before the platform existed");
        }
        // the time of the action when the writer says it, else the time of the delivery
        final Instant eventTime = occurredAt != null ? occurredAt : now;

        // General idempotency for all Outbox writers, not an UC23 special case.
        // A unique index on (action_type, correlation_id) resolves concurrent retries.
        if (request.getCorrelationId() != null && !request.getCorrelationId().isBlank()) {
            entityManager.createNativeQuery("""
                INSERT INTO audit_logs
                    (id, organization_id, actor_user_id, actor_role, action_type,
                     target_resource_type, target_resource_id, details, ip_address,
                     correlation_id, created_at)
                VALUES (:id, :organizationId, :actorUserId, :actorRole,
                        :actionType, :resourceType, :resourceId, :details,
                        :ipAddress, :correlationId, :createdAt)
                ON CONFLICT DO NOTHING
                """)
                .setParameter("id", UUID.randomUUID())
                .setParameter("organizationId", request.getOrganizationId())
                .setParameter("actorUserId", request.getActorUserId())
                .setParameter("actorRole", request.getActorRole())
                .setParameter("actionType", request.getActionType())
                .setParameter("resourceType", request.getTargetResourceType())
                .setParameter("resourceId", request.getTargetResourceId())
                .setParameter("details", request.getDetails())
                .setParameter("ipAddress", request.getIpAddress())
                .setParameter("correlationId", request.getCorrelationId())
                .setParameter("createdAt", eventTime)
                .executeUpdate();

            return auditLogRepository
                    .findFirstByActionTypeAndCorrelationId(
                            request.getActionType(), request.getCorrelationId())
                    .map(AuditLogResponse::fromEntity)
                    .orElseThrow(() -> new IllegalStateException("Audit record missing"));
        }

        AuditLog auditLog = new AuditLog(
                UUID.randomUUID(),
                request.getOrganizationId(),
                request.getActorUserId(),
                request.getActorRole(),
                request.getActionType(),
                request.getTargetResourceType(),
                request.getTargetResourceId(),
                request.getDetails(),
                request.getIpAddress(),
                request.getCorrelationId(),
                eventTime
        );

        AuditLog saved = auditLogRepository.save(auditLog);
        return AuditLogResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> queryAuditLogs(
            UUID organizationId,
            String actionType,
            String targetResourceType,
            String targetResourceId,
            UUID actorUserId,
            Instant from,
            Instant to,
            Pageable pageable) {

        Specification<AuditLog> spec = (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (organizationId != null) {
                predicates.add(criteriaBuilder.equal(root.get("organizationId"), organizationId));
            }
            if (actionType != null && !actionType.isBlank()) {
                predicates.add(criteriaBuilder.equal(root.get("actionType"), actionType));
            }
            if (targetResourceType != null && !targetResourceType.isBlank()) {
                predicates.add(criteriaBuilder.equal(root.get("targetResourceType"), targetResourceType));
            }
            if (targetResourceId != null && !targetResourceId.isBlank()) {
                predicates.add(criteriaBuilder.equal(root.get("targetResourceId"), targetResourceId));
            }
            if (actorUserId != null) {
                predicates.add(criteriaBuilder.equal(root.get("actorUserId"), actorUserId));
            }
            // UC50, UC51: a time range, from included to excluded (so "a whole day" is [00:00 of the day, 00:00 of the next day)).
            if (from != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(criteriaBuilder.lessThan(root.get("createdAt"), to));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };

        Page<AuditLog> pageResult = auditLogRepository.findAll(spec, pageable);
        List<AuditLogResponse> items = pageResult.getContent().stream()
                .map(AuditLogResponse::fromEntity)
                .toList();

        return PageResponse.of(items, pageResult.getNumber(), pageResult.getSize(), pageResult.getTotalElements());
    }

    @Transactional(readOnly = true)
    public AuditLogResponse getAuditLogById(UUID id) {
        return auditLogRepository.findById(id)
                .map(AuditLogResponse::fromEntity)
                .orElseThrow(() -> BusinessException.notFound("Audit log entry not found with ID: " + id));
    }
}
