package com.learnup.audit.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class CreateAuditLogRequest {

    private UUID organizationId;
    private UUID actorUserId;
    private String actorRole;

    @NotBlank(message = "actionType is required")
    private String actionType;

    private String targetResourceType;
    private String targetResourceId;
    private String details;
    private String ipAddress;
    private String correlationId;

    public CreateAuditLogRequest() {
    }

    public CreateAuditLogRequest(UUID organizationId, UUID actorUserId, String actorRole,
                                 String actionType, String targetResourceType, String targetResourceId,
                                 String details, String ipAddress, String correlationId) {
        this.organizationId = organizationId;
        this.actorUserId = actorUserId;
        this.actorRole = actorRole;
        this.actionType = actionType;
        this.targetResourceType = targetResourceType;
        this.targetResourceId = targetResourceId;
        this.details = details;
        this.ipAddress = ipAddress;
        this.correlationId = correlationId;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public UUID getActorUserId() {
        return actorUserId;
    }

    public void setActorUserId(UUID actorUserId) {
        this.actorUserId = actorUserId;
    }

    public String getActorRole() {
        return actorRole;
    }

    public void setActorRole(String actorRole) {
        this.actorRole = actorRole;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getTargetResourceType() {
        return targetResourceType;
    }

    public void setTargetResourceType(String targetResourceType) {
        this.targetResourceType = targetResourceType;
    }

    public String getTargetResourceId() {
        return targetResourceId;
    }

    public void setTargetResourceId(String targetResourceId) {
        this.targetResourceId = targetResourceId;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }
}
