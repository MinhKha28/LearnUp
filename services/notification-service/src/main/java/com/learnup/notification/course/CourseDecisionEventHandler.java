package com.learnup.notification.course;

import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * UC49 content "kết quả phê duyệt Course": the Instructor of the Course receives the UC21.3 decision in-app, scoped to
 * the Course's Organization. One durable obligation per (event, Instructor, IN_APP); a redelivered event is not repeated.
 */
@Component
public class CourseDecisionEventHandler {
    private static final Logger log = LoggerFactory.getLogger(CourseDecisionEventHandler.class);
    private static final Duration MAX_EVENT_AGE = Duration.ofHours(72);
    static final String CHANNEL = "IN_APP";
    static final String TYPE = "COURSE_APPROVAL";

    private final CourseSubmissionDeliveryLedger ledger;
    private final NotificationService notifications;

    public CourseDecisionEventHandler(CourseSubmissionDeliveryLedger ledger, NotificationService notifications) {
        this.ledger = ledger;
        this.notifications = notifications;
    }

    public void handle(CourseDecisionEvent event) {
        if (event.occurredAt().isBefore(Instant.now().minus(MAX_EVENT_AGE))) {
            log.info("event=course_decision_ignored reason=EVENT_TOO_OLD event_id={}", event.eventId());
            return;
        }
        boolean claimed = false;
        try {
            claimed = ledger.claim(event, event.instructorId(), CHANNEL);
            if (!claimed) return;
            notifications.sendNotification(new CreateNotificationRequest(
                    event.organizationId(), event.instructorId(), title(event), message(event), TYPE, CHANNEL,
                    "{\"courseId\":\"" + event.courseId() + "\",\"versionNumber\":" + event.versionNumber() + "}"));
            ledger.sent(event.eventId(), event.instructorId(), CHANNEL);
        } catch (RuntimeException failure) {
            if (claimed) {
                ledger.failed(event.eventId(), event.instructorId(), CHANNEL, "IN_APP_FAILED");
            }
            log.warn("event=course_decision_retry event_id={} error_type={}",
                    event.eventId(), failure.getClass().getSimpleName());
            throw new DependencyUnavailableException("COURSE_DECISION_DELIVERY_FAILED");
        }
        log.info("event=course_decision_handled event_id={} approved={}", event.eventId(), event.approved());
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
}
