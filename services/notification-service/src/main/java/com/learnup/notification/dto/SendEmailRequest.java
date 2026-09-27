package com.learnup.notification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class SendEmailRequest {

    @NotBlank(message = "recipientEmail is required")
    @Email(message = "Invalid recipientEmail format")
    private String recipientEmail;

    @NotBlank(message = "subject is required")
    private String subject;

    @NotBlank(message = "body is required")
    private String body;

    private String templateCode;

    public SendEmailRequest() {
    }

    public SendEmailRequest(String recipientEmail, String subject, String body, String templateCode) {
        this.recipientEmail = recipientEmail;
        this.subject = subject;
        this.body = body;
        this.templateCode = templateCode;
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

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getTemplateCode() {
        return templateCode;
    }

    public void setTemplateCode(String templateCode) {
        this.templateCode = templateCode;
    }
}
