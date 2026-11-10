package com.learnup.notification.course;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class CourseOwnershipTransferredEventHandler {
    private static final Logger log = LoggerFactory.getLogger(CourseOwnershipTransferredEventHandler.class);
    private final RecipientDirectory directory;
    private final CourseOwnershipDeliveryLedger ledger;
    private final NotificationService notifications;
    private final EmailDeliveryService emails;
    private final ObjectMapper mapper;
    private final RestClient audit;
    private final String auditUrl;

    public CourseOwnershipTransferredEventHandler(
            RecipientDirectory directory,
            CourseOwnershipDeliveryLedger ledger,
            NotificationService notifications,
            EmailDeliveryService emails,
            ObjectMapper mapper,
            RestClient.Builder builder,
            Environment environment) {
        this.directory = directory;
        this.ledger = ledger;
        this.notifications = notifications;
        this.emails = emails;
        this.mapper = mapper;
        this.auditUrl = environment.getProperty("audit.service-url", "");
        this.audit = builder.defaultHeader("x-internal-key",
                environment.getProperty("security.internal-key", "")).build();
    }

    public void handle(CourseOwnershipTransferredEvent event) {
        boolean retry = false;
        for (String channel : new String[] { "IN_APP", "EMAIL", "AUDIT" }) {
            UUID recipientId = "AUDIT".equals(channel) ? event.actorUserId() : event.toInstructorId();
            boolean claimed = false;
            try {
                claimed = ledger.claim(event, recipientId, channel);
                if (!claimed) continue;
                if ("AUDIT".equals(channel)) {
                    sendAudit(event);
                } else {
                    Recipient recipient = directory.find(event.organizationId(), event.toInstructorId()).orElse(null);
                    if (recipient == null || !recipient.canBeWrittenTo()) {
                        ledger.skipped(event.eventId(), recipientId, channel);
                        continue;
                    }
                    if ("IN_APP".equals(channel)) {
                        notifications.sendNotification(new CreateNotificationRequest(
                                event.organizationId(), recipient.id(),
                                "Course ownership transferred",
                                "You are now responsible for Course \"" + event.courseName() + "\".",
                                "COURSE_OWNERSHIP", "IN_APP",
                                "{\"courseId\":\"" + event.courseId() + "\",\"chainId\":\"" + event.chainId() + "\"}"));
                    } else {
                        if (!recipient.hasEmail()) {
                            ledger.skipped(event.eventId(), recipientId, channel);
                            continue;
                        }
                        EmailLogResponse result = emails.sendEmail(new SendEmailRequest(
                                recipient.email(), "LearnUP - Course ownership transferred",
                                emailHtml(event), "COURSE_OWNERSHIP_TRANSFERRED"));
                        if (!"SENT".equals(result.getStatus()) && !"SIMULATED".equals(result.getStatus())) {
                            throw new DependencyUnavailableException("EMAIL_FAILED");
                        }
                    }
                }
                ledger.sent(event.eventId(), recipientId, channel);
            } catch (RuntimeException error) {
                if (claimed) ledger.failed(event.eventId(), recipientId, channel, channel + "_FAILED");
                log.warn("event=course_ownership_retry channel={} event_id={} error_type={}",
                        channel, event.eventId(), error.getClass().getSimpleName());
                retry = true;
            }
        }
        if (retry) throw new DependencyUnavailableException("OWNERSHIP_DELIVERY_FAILED");
    }

    private void sendAudit(CourseOwnershipTransferredEvent event) {
        if (auditUrl.isBlank()) throw new DependencyUnavailableException("AUDIT_URL_MISSING");
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("courseId", event.courseId().toString());
        details.put("fromInstructorId", event.fromInstructorId().toString());
        details.put("toInstructorId", event.toInstructorId().toString());
        details.put("occurredAt", event.occurredAt().toString());
        if (event.reason() != null) details.put("reason", event.reason());
        try {
            audit.post().uri(auditUrl.replaceAll("/+$", "") + "/api/v1/audit/logs")
                    .body(Map.of(
                            "organizationId", event.organizationId().toString(),
                            "actorUserId", event.actorUserId().toString(),
                            "actorRole", "ORGANIZER",
                            "actionType", "COURSE_OWNERSHIP_TRANSFERRED",
                            "targetResourceType", "CourseChain",
                            "targetResourceId", event.chainId().toString(),
                            "details", mapper.writeValueAsString(details),
                            "correlationId", event.eventId().toString()))
                    .retrieve().toBodilessEntity();
        } catch (RestClientException | JsonProcessingException error) {
            throw new DependencyUnavailableException("AUDIT_UNAVAILABLE");
        }
    }

    private static String emailHtml(CourseOwnershipTransferredEvent event) {
        return "<html><body><h1>LearnUP</h1><p>You are now responsible for Course: <strong>"
                + escapeHtml(event.courseName()) + "</strong>.</p>"
                + "<p>The transfer applies to all Course versions. Sign in to LearnUP for details.</p>"
                + "</body></html>";
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
