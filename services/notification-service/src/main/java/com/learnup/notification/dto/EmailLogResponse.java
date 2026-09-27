package com.learnup.notification.dto;

import com.learnup.notification.entity.EmailLog;

import java.time.Instant;
import java.util.UUID;

public class EmailLogResponse {

    private UUID id;
    private String recipientEmail;
    private String subject;
    private String status;
    private String errorMessage;
    private Instant sentAt;

    public EmailLogResponse() {
    }

    public static EmailLogResponse fromEntity(EmailLog entity) {
        EmailLogResponse res = new EmailLogResponse();
        res.id = entity.getId();
        res.recipientEmail = entity.getRecipientEmail();
        res.subject = entity.getSubject();
        res.status = entity.getStatus();
        res.errorMessage = entity.getErrorMessage();
        res.sentAt = entity.getSentAt();
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public void setRecipientEmail(String recipientEmail) {
        this.recipientEmail = recipientEmail;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }
}
