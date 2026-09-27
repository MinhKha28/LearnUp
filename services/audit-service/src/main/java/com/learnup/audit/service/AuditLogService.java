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
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public AuditLogResponse recordAuditLog(CreateAuditLogRequest request) {
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
                Instant.now()
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
