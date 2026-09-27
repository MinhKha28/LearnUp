package com.learnup.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class CreateNotificationRequest {

    private UUID organizationId;

    @NotNull(message = "recipientUserId is required")
    private UUID recipientUserId;

    @NotBlank(message = "title is required")
    private String title;

    @NotBlank(message = "message is required")
    private String message;

    private String type = "INFO";
    private String channel = "IN_APP";
    private String metadata;

    public CreateNotificationRequest() {
    }

    public CreateNotificationRequest(UUID organizationId, UUID recipientUserId, String title,
                                     String message, String type, String channel, String metadata) {
        this.organizationId = organizationId;
        this.recipientUserId = recipientUserId;
        this.title = title;
        this.message = message;
        this.type = type != null ? type : "INFO";
        this.channel = channel != null ? channel : "IN_APP";
        this.metadata = metadata;
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

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }
}
