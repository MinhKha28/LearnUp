package com.learnup.notification.course;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.mail.EmailLayout;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
public class CourseSubmittedEventHandler {
    private static final Logger log = LoggerFactory.getLogger(CourseSubmittedEventHandler.class);
    private static final Duration MAX_EVENT_AGE = Duration.ofHours(72);

    private final RestClient tenant;
    private final CourseSubmissionDeliveryLedger ledger;
    private final NotificationService notifications;
    private final EmailDeliveryService emails;

    public CourseSubmittedEventHandler(
            @Qualifier("tenantRestClient") RestClient tenant,
            CourseSubmissionDeliveryLedger ledger,
            NotificationService notifications,
            EmailDeliveryService emails) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.notifications = notifications;
        this.emails = emails;
    }

    public void handle(CourseSubmittedEvent event) {
        if (event.occurredAt().isBefore(Instant.now().minus(MAX_EVENT_AGE))) {
            log.info("event=course_submission_ignored reason=EVENT_TOO_OLD event_id={}", event.eventId());
            return;
        }
        Organizer organizer = resolveOrganizer(event.organizationId());
        boolean retry = false;

        for (String channel : new String[] { "IN_APP", "EMAIL" }) {
            boolean claimed = false;
            try {
                claimed = ledger.claim(event, organizer.id(), channel);
                if (!claimed) continue;

                if ("IN_APP".equals(channel)) {
                    String metadata = "{\"courseId\":\"" + event.courseId() + "\"}";
                    notifications.sendNotification(new CreateNotificationRequest(
                            event.organizationId(), organizer.id(), "Khóa học đang chờ phê duyệt",
                            "Khóa học «" + event.courseName() + "» đã được gửi để phê duyệt.",
                            "COURSE_APPROVAL", "IN_APP", metadata));
                } else {
                    EmailLogResponse result = emails.sendEmail(new SendEmailRequest(
                            organizer.email(), "LearnUP - Khóa học đang chờ phê duyệt",
                            emailHtml(event), "COURSE_APPROVAL_SUBMITTED"));
                    if (!"SENT".equals(result.getStatus()) && !"SIMULATED".equals(result.getStatus())) {
                        throw new DependencyUnavailableException("EMAIL_FAILED");
                    }
                    if ("SIMULATED".equals(result.getStatus())) {
                        log.warn("event=course_submission_email_simulated event_id={}", event.eventId());
                    }
                }
                ledger.sent(event.eventId(), organizer.id(), channel);
            } catch (RuntimeException failure) {
                if (claimed) {
                    ledger.failed(event.eventId(), organizer.id(), channel, channel + "_FAILED");
                }
                log.warn("event=course_submission_retry channel={} event_id={} error_type={}",
                        channel, event.eventId(), failure.getClass().getSimpleName());
                retry = true;
            }
        }

        if (retry) throw new DependencyUnavailableException("COURSE_SUBMISSION_DELIVERY_FAILED");
        log.info("event=course_submission_handled event_id={}", event.eventId());
    }

    private Organizer resolveOrganizer(UUID organizationId) {
        try {
            OrganizerEnvelope response = tenant.get()
                    .uri("/api/v1/users/internal/organizer")
                    .header(HeaderConstants.X_ORGANIZATION_ID, organizationId.toString())
                    .retrieve()
                    .body(OrganizerEnvelope.class);
            if (response == null || response.data() == null ||
                    response.data().id() == null ||
                    response.data().email() == null || response.data().email().isBlank()) {
                throw new DependencyUnavailableException("ORGANIZER_UNAVAILABLE");
            }
            return response.data();
        } catch (RestClientException failure) {
            throw new DependencyUnavailableException("TENANT_UNAVAILABLE");
        }
    }

    static String emailHtml(CourseSubmittedEvent event) {
        return EmailLayout.render(EmailLayout.Card.of("Khóa học đang chờ phê duyệt")
                .badge("Chờ phê duyệt", EmailLayout.Tone.WARNING)
                .greeting(null)
                .paragraph("Giảng viên đã gửi một khóa học để bạn xem xét và phê duyệt.")
                .detail("Khóa học", event.courseName())
                .detail("Phiên bản", String.valueOf(event.versionNumber()))
                .detail("Trạng thái", "Chờ phê duyệt", EmailLayout.Tone.WARNING)
                .callout("Khóa học chưa được công bố", "Khóa học chỉ được công bố sau khi bạn phê duyệt.",
                        EmailLayout.Tone.WARNING)
                .closing("Vui lòng đăng nhập LearnUP để xem xét khóa học này."));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OrganizerEnvelope(Organizer data) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Organizer(UUID id, String email) {}
}
