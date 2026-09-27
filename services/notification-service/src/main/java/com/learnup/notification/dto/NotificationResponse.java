package com.learnup.notification.dto;

import com.learnup.notification.entity.Notification;

import java.time.Instant;
import java.util.UUID;

public class NotificationResponse {

    private UUID id;
    private UUID organizationId;
    private UUID recipientUserId;
    private String title;
    private String message;
    private String type;
    private String channel;
    @com.fasterxml.jackson.annotation.JsonProperty("isRead")
    private boolean isRead;
    private Instant readAt;
    private String metadata;
    private Instant createdAt;

    public NotificationResponse() {
    }

    public static NotificationResponse fromEntity(Notification entity) {
        NotificationResponse res = new NotificationResponse();
        res.id = entity.getId();
        res.organizationId = entity.getOrganizationId();
        res.recipientUserId = entity.getRecipientUserId();
        res.title = entity.getTitle();
        res.message = entity.getMessage();
        res.type = entity.getType();
        res.channel = entity.getChannel();
        res.isRead = entity.isRead();
        res.readAt = entity.getReadAt();
        res.metadata = entity.getMetadata();
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

    public UUID getRecipientUserId() {
        return recipientUserId;
    }

    public void setRecipientUserId(UUID recipientUserId) {
        this.recipientUserId = recipientUserId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("isRead")
    public boolean isRead() {
        return isRead;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("isRead")
    public void setRead(boolean read) {
        isRead = read;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant readAt) {
        this.readAt = readAt;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
