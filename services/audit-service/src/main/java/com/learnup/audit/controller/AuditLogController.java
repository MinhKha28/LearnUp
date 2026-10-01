package com.learnup.audit.controller;

import com.learnup.audit.dto.AuditLogResponse;
import com.learnup.audit.dto.CreateAuditLogRequest;
import com.learnup.audit.service.AuditLogService;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.response.PageResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/audit/logs", "/api/audit/logs"})
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AuditLogResponse>> createAuditLog(
            @Valid @RequestBody CreateAuditLogRequest request) {
        AuditLogResponse response = auditLogService.recordAuditLog(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AuditLogResponse>>> queryAuditLogs(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) String targetResourceType,
            @RequestParam(required = false) String targetResourceId,
            @RequestParam(required = false) UUID actorUserId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        PageResponse<AuditLogResponse> response = auditLogService.queryAuditLogs(
                organizationId, actionType, targetResourceType, targetResourceId, actorUserId, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditLogResponse>> getAuditLogById(@PathVariable UUID id) {
        AuditLogResponse response = auditLogService.getAuditLogById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
