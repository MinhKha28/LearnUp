package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.mail.EmailLayout;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** UC23: Notification delivers messages. The owning Course Service records Audit. */
@Component
public class CourseOwnershipTransferredEventHandler {
    private static final Logger log = LoggerFactory.getLogger(CourseOwnershipTransferredEventHandler.class);

    private final RecipientDirectory directory;
    private final CourseOwnershipDeliveryLedger ledger;
    private final NotificationService notifications;
    private final EmailDeliveryService emails;

    public CourseOwnershipTransferredEventHandler(
            RecipientDirectory directory,
            CourseOwnershipDeliveryLedger ledger,
            NotificationService notifications,
            EmailDeliveryService emails) {
        this.directory = directory;
        this.ledger = ledger;
        this.notifications = notifications;
        this.emails = emails;
    }

    public void handle(CourseOwnershipTransferredEvent event) {
        boolean retry = false;
        for (String channel : new String[] { "IN_APP", "EMAIL" }) {
            UUID recipientId = event.toInstructorId();
            boolean claimed = false;
            try {
                claimed = ledger.claim(event, recipientId, channel);
                if (!claimed) continue;

                Recipient recipient = directory.find(event.organizationId(), recipientId).orElse(null);
                if (recipient == null || !recipient.canBeWrittenTo()) {
                    ledger.skipped(event.eventId(), recipientId, channel);
                    continue;
                }
                if ("IN_APP".equals(channel)) {
                    notifications.sendNotification(new CreateNotificationRequest(
                            event.organizationId(), recipient.id(),
                            "Chuyển quyền phụ trách Course",
                            "Bạn đã được chuyển quyền phụ trách Course \"" + event.courseName() + "\".",
                            "COURSE_OWNERSHIP", "IN_APP",
                            "{\"courseId\":\"" + event.courseId() + "\",\"chainId\":\""
                                    + event.chainId() + "\"}"));
                } else {
                    if (!recipient.hasEmail()) {
                        ledger.skipped(event.eventId(), recipientId, channel);
                        continue;
                    }
                    EmailLogResponse result = emails.sendEmail(new SendEmailRequest(
                            recipient.email(), "LearnUP - Chuyển quyền phụ trách Course",
                            emailHtml(event), "COURSE_OWNERSHIP_TRANSFERRED"));
                    if (!"SENT".equals(result.getStatus()) && !"SIMULATED".equals(result.getStatus())) {
                        throw new DependencyUnavailableException("EMAIL_FAILED");
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

    static String emailHtml(CourseOwnershipTransferredEvent event) {
        return EmailLayout.render(EmailLayout.Card.of("Chuyển quyền phụ trách khóa học")
                .badge("Phụ trách khóa học", EmailLayout.Tone.INFO)
                .greeting(null)
                .paragraph("Bạn đã được chuyển quyền phụ trách khóa học «" + event.courseName() + "».")
                .detail("Khóa học", event.courseName())
                .paragraph("Việc chuyển quyền áp dụng cho toàn bộ phiên bản khóa học.")
                .closing("Vui lòng đăng nhập LearnUP để xem chi tiết."));
    }
}
