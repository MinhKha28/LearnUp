package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
import com.learnup.notification.mail.EmailLayout;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * UC21.3 / BR-84: the Instructor of the Course receives the review decision in-app (UC49 content "kết quả phê duyệt
 * Course") and by e-mail, scoped to the Course's Organization. One durable obligation per (event, Instructor, channel);
 * a redelivered event does not repeat a channel that was already sent, and a channel that fails does not stop the other.
 */
@Component
public class CourseDecisionEventHandler {
    private static final Logger log = LoggerFactory.getLogger(CourseDecisionEventHandler.class);
    private static final Duration MAX_EVENT_AGE = Duration.ofHours(72);
    static final String CHANNEL = "IN_APP";
    static final String EMAIL_CHANNEL = "EMAIL";
    static final String TYPE = "COURSE_APPROVAL";
    static final String APPROVED_TEMPLATE = "COURSE_APPROVED";
    static final String REJECTED_TEMPLATE = "COURSE_REJECTED";

    private final CourseSubmissionDeliveryLedger ledger;
    private final NotificationService notifications;
    private final RecipientDirectory directory;
    private final EmailDeliveryService emails;

    public CourseDecisionEventHandler(CourseSubmissionDeliveryLedger ledger, NotificationService notifications,
                                      RecipientDirectory directory, EmailDeliveryService emails) {
        this.ledger = ledger;
        this.notifications = notifications;
        this.directory = directory;
        this.emails = emails;
    }

    public void handle(CourseDecisionEvent event) {
        if (event.occurredAt().isBefore(Instant.now().minus(MAX_EVENT_AGE))) {
            log.info("event=course_decision_ignored reason=EVENT_TOO_OLD event_id={}", event.eventId());
            return;
        }
        UUID instructor = event.instructorId();
        boolean retry = false;
        for (String channel : new String[] { CHANNEL, EMAIL_CHANNEL }) {
            boolean claimed = false;
            try {
                claimed = ledger.claim(event, instructor, channel);
                if (!claimed) continue;
                if (CHANNEL.equals(channel)) {
                    notifications.sendNotification(new CreateNotificationRequest(
                            event.organizationId(), instructor, title(event), message(event), TYPE, CHANNEL,
                            "{\"courseId\":\"" + event.courseId() + "\",\"versionNumber\":" + event.versionNumber() + "}"));
                } else if (!sendEmail(event)) {
                    ledger.skipped(event.eventId(), instructor, channel);
                    continue;
                }
                ledger.sent(event.eventId(), instructor, channel);
            } catch (PermanentDeliveryException refused) {
                // another service refused the request: trying again cannot fix it
                if (claimed) ledger.failed(event.eventId(), instructor, channel, refused.code());
                log.error("event=course_decision_failed channel={} event_id={} reason={}",
                        channel, event.eventId(), refused.code());
            } catch (RuntimeException failure) {
                if (claimed) ledger.failed(event.eventId(), instructor, channel, channel + "_FAILED");
                log.warn("event=course_decision_retry channel={} event_id={} error_type={}",
                        channel, event.eventId(), failure.getClass().getSimpleName());
                retry = true;
            }
        }
        if (retry) throw new DependencyUnavailableException("COURSE_DECISION_DELIVERY_FAILED");
        log.info("event=course_decision_handled event_id={} approved={}", event.eventId(), event.approved());
    }

    /** @return false when there is nobody to write to (the Instructor is gone, deactivated or has no e-mail) */
    private boolean sendEmail(CourseDecisionEvent event) {
        Recipient recipient = directory.find(event.organizationId(), event.instructorId()).orElse(null);
        if (recipient == null || !recipient.canBeWrittenTo() || !recipient.hasEmail()) {
            log.info("event=course_decision_email_skipped reason=RECIPIENT_UNAVAILABLE event_id={}", event.eventId());
            return false;
        }
        EmailLogResponse result = emails.sendEmail(new SendEmailRequest(
                recipient.email(), emailSubject(event), emailHtml(event, recipient.fullName()),
                event.approved() ? APPROVED_TEMPLATE : REJECTED_TEMPLATE));
        if (!"SENT".equals(result.getStatus()) && !"SIMULATED".equals(result.getStatus())) {
            throw new DependencyUnavailableException("EMAIL_FAILED");
        }
        if ("SIMULATED".equals(result.getStatus())) {
            log.warn("event=course_decision_email_simulated event_id={}", event.eventId());
        }
        return true;
    }

    static String title(CourseDecisionEvent event) {
        return event.approved() ? "Khóa học đã được phê duyệt" : "Khóa học bị từ chối";
    }

    /** The Organizer is "quản lý đào tạo" in the team glossary (docs/frontend/ui-glossary-vi.md). */
    static String message(CourseDecisionEvent event) {
        String course = "khóa học «" + event.courseName() + "» (phiên bản " + event.versionNumber() + ")";
        return event.approved()
                ? "Quản lý đào tạo đã phê duyệt " + course + ". Khóa học đã được công bố."
                : "Quản lý đào tạo đã từ chối " + course + ". Lý do: " + event.rejectionReason();
    }

    static String emailSubject(CourseDecisionEvent event) {
        return "LearnUP - " + title(event);
    }

    /** The same facts as the notice, in the card all e-mails of this service share; every text is escaped there. */
    static String emailHtml(CourseDecisionEvent event, String fullName) {
        boolean approved = event.approved();
        EmailLayout.Tone tone = approved ? EmailLayout.Tone.SUCCESS : EmailLayout.Tone.DANGER;
        EmailLayout.Card card = EmailLayout.Card.of(title(event))
                .badge(approved ? "ĐÃ PHÊ DUYỆT" : "BỊ TỪ CHỐI", tone)
                .greeting(fullName)
                .paragraph((approved ? "Quản lý đào tạo đã phê duyệt " : "Quản lý đào tạo đã từ chối ")
                        + "khóa học «" + event.courseName() + "» (phiên bản " + event.versionNumber() + ")."
                        + (approved ? " Khóa học đã được công bố." : ""))
                .detail("Khóa học", event.courseName())
                .detail("Phiên bản", String.valueOf(event.versionNumber()))
                .detail("Kết quả", approved ? "Đã phê duyệt" : "Bị từ chối", tone);
        if (approved) {
            card.callout("Khóa học đã được công bố", "Học viên có thể được phân công khóa học này.", tone);
        } else {
            card.callout("Lý do từ chối", event.rejectionReason(), tone)
                    .paragraph("Bạn có thể chỉnh sửa khóa học rồi gửi duyệt lại.");
        }
        return EmailLayout.render(card.closing("Vui lòng đăng nhập LearnUP để xem chi tiết."));
    }
}
