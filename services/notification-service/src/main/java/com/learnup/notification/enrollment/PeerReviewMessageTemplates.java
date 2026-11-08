package com.learnup.notification.enrollment;

import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * The words of the notice about the reviews handed out by a closed peer review cycle (Vietnamese: the Learner reads it
 * in the bell and in the mailbox). The deadline is written as dd/MM/yyyy HH:mm in the time zone given, never as a raw
 * ISO time. Everything that came from a person (the name, the title of the Assignment) is escaped in the e-mail.
 */
@Component
public class PeerReviewMessageTemplates {

    static final String TYPE = "PEER_REVIEW";
    static final String TITLE = "Bạn có bài cần chấm chéo";

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public EnrollmentMessage render(PeerReviewAssignedEvent event, String reviewerName, ZoneId zone) {
        String text = "Bạn có " + event.reviewCount() + " bài nộp cần chấm cho bài tập «" + event.assignmentTitle()
                + "». Vui lòng hoàn thành trước " + DATE_TIME.format(event.reviewDueAt().atZone(zone)) + ".";
        String greeting = reviewerName == null || reviewerName.isBlank()
                ? "Xin chào,"
                : "Xin chào " + HtmlUtils.htmlEscape(reviewerName.strip(), "UTF-8") + ",";
        String html = "<p>" + greeting + "</p><p>" + HtmlUtils.htmlEscape(text, "UTF-8") + "</p><p>LearnUP</p>";
        // The same keys as the notice that assessment-service used to send itself, so the screen links it the same way.
        String metadata = "{\"assignmentId\":\"" + event.assessmentId() + "\",\"cycleId\":\"" + event.cycleId()
                + "\",\"event\":\"" + PeerReviewAssignedEvent.WIRE_NAME + "\"}";
        return new EnrollmentMessage(TITLE, text, TYPE, TITLE, html, metadata);
    }
}
