package com.learnup.audit.dto;

import com.learnup.audit.entity.AuditLog;

import java.time.Instant;
import java.util.UUID;

public class AuditLogResponse {

    private UUID id;
    private UUID organizationId;
    private UUID actorUserId;
    private String actorRole;
    private String actionType;
    private String targetResourceType;
    private String targetResourceId;
    private String details;
    private String ipAddress;
    private String correlationId;
    private Instant createdAt;

    public AuditLogResponse() {
    }

    public static AuditLogResponse fromEntity(AuditLog entity) {
        AuditLogResponse res = new AuditLogResponse();
        res.id = entity.getId();
        res.organizationId = entity.getOrganizationId();
        res.actorUserId = entity.getActorUserId();
        res.actorRole = entity.getActorRole();
        res.actionType = entity.getActionType();
        res.targetResourceType = entity.getTargetResourceType();
        res.targetResourceId = entity.getTargetResourceId();
        res.details = entity.getDetails();
        res.ipAddress = entity.getIpAddress();
        res.correlationId = entity.getCorrelationId();
        res.createdAt = entity.getCreatedAt();
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
