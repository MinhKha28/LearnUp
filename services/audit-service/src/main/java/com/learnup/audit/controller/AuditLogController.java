package com.learnup.audit.controller;

import com.learnup.audit.dto.AuditLogResponse;
import com.learnup.audit.dto.CreateAuditLogRequest;
import com.learnup.audit.security.AuditCaller;
import com.learnup.audit.security.AuditServiceAuthenticationFilter;
import com.learnup.audit.service.AuditLogService;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.response.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Audit trail. Writing is for the services (AuditServiceAuthenticationFilter lets only a request with the internal key and no
 * user context through); reading is for an Admin (everything) and an Organizer (the own Organization), UC50 and UC51.
 */
@RestController
@RequestMapping({"/api/v1/audit/logs", "/api/audit/logs"})
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AuditLogResponse>> createAuditLog(
            @Valid @RequestBody CreateAuditLogRequest request,
            HttpServletRequest httpRequest) {
        if (!AuditServiceAuthenticationFilter.isAuthenticatedService(httpRequest)) {
            throw BusinessException.forbidden("Only internal services may write audit entries");
        }
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
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            HttpServletRequest httpRequest) {

        UUID scope = AuditCaller.require(httpRequest).scopeOf(organizationId);
        PageResponse<AuditLogResponse> response = auditLogService.queryAuditLogs(
                scope, actionType, targetResourceType, targetResourceId, actorUserId, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditLogResponse>> getAuditLogById(@PathVariable UUID id, HttpServletRequest httpRequest) {
        AuditCaller caller = AuditCaller.require(httpRequest);
        AuditLogResponse response = auditLogService.getAuditLogById(id);
        if (!caller.mayRead(response.getOrganizationId())) {
            // The same answer as for an id that does not exist: an Organizer cannot learn that an entry of another Organization exists.
            throw BusinessException.notFound("Audit log entry not found with ID: " + id);
        }
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
