package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
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

    /**
     * The same facts as the notice, in a card that mail clients draw alike (tables and inline styles only). The course name,
     * the reason and the name are escaped (people type them).
     */
    static String emailHtml(CourseDecisionEvent event, String fullName) {
        boolean approved = event.approved();
        String accent = approved ? "#15803d" : "#b91c1c";
        String tint = approved ? "#f0fdf4" : "#fef2f2";
        String greeting = fullName == null || fullName.isBlank() ? "Xin chào," : "Xin chào " + escapeHtml(fullName) + ",";
        String course = escapeHtml(event.courseName());
        String sentence = (approved ? "Quản lý đào tạo đã phê duyệt " : "Quản lý đào tạo đã từ chối ")
                + "khóa học <strong>«" + course + "»</strong> (phiên bản " + event.versionNumber() + ")."
                + (approved ? " Khóa học đã được công bố." : "");
        String callout = approved
                ? box(tint, accent, "Khóa học đã được công bố", "Học viên có thể được phân công khóa học này.")
                : box(tint, accent, "Lý do từ chối", escapeHtml(event.rejectionReason()))
                        + "<p style=\"margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6\">"
                        + "Bạn có thể chỉnh sửa khóa học rồi gửi duyệt lại.</p>";
        return """
            <!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
            <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
            <table role="presentation" width="100%%" style="max-width:600px;margin:0 auto;border-collapse:collapse">
            <tr><td style="padding:18px 28px;background:#172554;border-radius:12px 12px 0 0;color:#ffffff;font-size:24px;font-weight:bold"><img src="cid:learnup-logo" alt="LearnUP" width="140" style="display:block;border:0;height:auto;color:#ffffff;font-size:24px;font-weight:bold"/></td></tr>
            <tr><td style="padding:32px 28px;background:#ffffff;color:#0f172a">
              <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:%s;color:%s;font-size:12px;font-weight:bold">%s</span>
              <h1 style="margin:14px 0 8px;font-size:22px;line-height:1.3">%s</h1>
              <p style="margin:0 0 16px;color:#334155;font-size:15px">%s</p>
              <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6">%s</p>
              <table role="presentation" width="100%%" style="margin:0 0 20px;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;font-size:14px">
                <tr><td style="padding:10px 14px;color:#64748b;width:110px">Khóa học</td><td style="padding:10px 14px;font-weight:bold">%s</td></tr>
                <tr><td style="padding:10px 14px;color:#64748b;border-top:1px solid #e2e8f0">Phiên bản</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0">%d</td></tr>
                <tr><td style="padding:10px 14px;color:#64748b;border-top:1px solid #e2e8f0">Kết quả</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;color:%s;font-weight:bold">%s</td></tr>
              </table>
              %s
              <p style="margin:24px 0 0;color:#334155;font-size:14px">Vui lòng đăng nhập LearnUP để xem chi tiết.</p>
            </td></tr>
            <tr><td style="padding:16px 28px;background:#f8fafc;border-radius:0 0 12px 12px;color:#94a3b8;font-size:12px;text-align:center">
              Email tự động từ LearnUP, vui lòng không trả lời thư này.
            </td></tr></table></body></html>
            """.formatted(tint, accent, approved ? "ĐÃ PHÊ DUYỆT" : "BỊ TỪ CHỐI", title(event), greeting, sentence,
                course, event.versionNumber(), accent, approved ? "Đã phê duyệt" : "Bị từ chối", callout);
    }

    private static String box(String tint, String accent, String heading, String text) {
        return "<div style=\"padding:14px 16px;background:" + tint + ";border-left:4px solid " + accent
                + ";border-radius:4px\"><div style=\"color:" + accent + ";font-size:13px;font-weight:bold;margin-bottom:4px\">"
                + heading + "</div><div style=\"color:#0f172a;font-size:14px;line-height:1.6\">" + text + "</div></div>";
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
