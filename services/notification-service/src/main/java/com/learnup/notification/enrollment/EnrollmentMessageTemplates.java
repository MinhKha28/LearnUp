package com.learnup.notification.enrollment;

import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * The words of the messages about an enrollment (Vietnamese: the Learner reads them in the bell and in the mailbox).
 * Dates are written in the time zone given, never as a raw ISO time. A due date is the end of a day (BR-167) and
 * learning stores it as 00:00 of the next day, so that is written as "hết ngày" and the day before: the Learner reads the
 * day the Organizer chose. Any other time is written as dd/MM/yyyy HH:mm. A withdrawal writes to nobody.
 */
@Component
public class EnrollmentMessageTemplates {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public Optional<EnrollmentMessage> render(EnrollmentEvent event, String courseName, String learnerName, ZoneId zone) {
        String course = courseName == null || courseName.isBlank() ? null : courseName.strip();
        String title;
        String text;
        String type;
        switch (event.type()) {
            case ASSIGNED -> {
                type = "ENROLLMENT_ASSIGNED";
                switch (event.kind()) {
                    case CREATE -> {
                        title = "Bạn được giao một khóa học";
                        text = "Bạn được giao " + courseRef(course) + ". Hạn hoàn thành: " + date(event.dueAt(), zone) + ".";
                    }
                    case RESTORE -> {
                        title = "Bạn được giao lại một khóa học";
                        text = "Bạn được giao lại " + courseRef(course) + ". Hạn hoàn thành: " + date(event.dueAt(), zone) + ".";
                    }
                    case CONVERT -> {
                        title = "Khóa học đã trở thành bắt buộc";
                        text = capitalize(courseRef(course)) + " đã chuyển thành khóa học bắt buộc. Hạn hoàn thành: "
                                + date(event.dueAt(), zone) + ".";
                    }
                    case CONVERT_COMPLETED -> {
                        title = "Khóa học đã trở thành bắt buộc";
                        text = capitalize(courseRef(course)) + " đã chuyển thành khóa học bắt buộc. "
                                + "Bạn đã hoàn thành khóa học này nên không cần làm thêm.";
                    }
                    default -> throw new IllegalStateException("kind " + event.kind());
                }
            }
            case DUE_DATE_EXTENDED -> {
                type = "ENROLLMENT_DUE_DATE_EXTENDED";
                title = "Hạn hoàn thành đã được gia hạn";
                StringBuilder builder = new StringBuilder("Hạn hoàn thành ")
                        .append(courseRef(course)).append(" được gia hạn đến ").append(date(event.newDueAt(), zone));
                if (event.previousDueAt() != null) {
                    builder.append(" (trước đó: ").append(date(event.previousDueAt(), zone)).append(")");
                }
                builder.append(".");
                if (event.reason() != null) {
                    builder.append(" Lý do: ").append(event.reason()).append(".");
                }
                text = builder.toString();
            }
            case EXEMPTED -> {
                type = "ENROLLMENT_EXEMPTED";
                title = "Bạn được miễn khóa học";
                text = "Bạn được miễn " + courseRef(course) + "." + (event.reason() != null ? " Lý do: " + event.reason() + "." : "");
            }
            default -> {
                // LearnerWithdrew: nobody is written to (decision D2 of 23/10).
                return Optional.empty();
            }
        }

        String greeting = learnerName == null || learnerName.isBlank() ? "Xin chào," : "Xin chào " + HtmlUtils.htmlEscape(learnerName.strip(), "UTF-8") + ",";
        String html = "<p>" + greeting + "</p><p>" + HtmlUtils.htmlEscape(text, "UTF-8") + "</p><p>LearnUP</p>";
        String metadata = "{\"enrollmentId\":\"" + event.enrollmentId() + "\",\"courseId\":\"" + event.courseId()
                + "\",\"event\":\"" + event.type().wireName() + "\"}";
        return Optional.of(new EnrollmentMessage(title, text, type, title, html, metadata));
    }

    /** "khóa học «Name»", or "một khóa học" when the name is not known. */
    private static String courseRef(String course) {
        return course == null ? "một khóa học" : "khóa học «" + course + "»";
    }

    private static String capitalize(String text) {
        return text.isEmpty() ? text : Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    private static String date(Instant instant, ZoneId zone) {
        ZonedDateTime local = instant.atZone(zone);
        if (local.toLocalTime().equals(LocalTime.MIDNIGHT)) {
            return "hết ngày " + DATE.format(local.minusDays(1));
        }
        return DATE_TIME.format(local);
    }
}
