package com.learnup.notification.enrollment;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.config.SubmissionFinalizedEventsProperties;
import com.learnup.notification.mail.EmailLayout;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;

@Component
public class SubmissionFinalizedMessageTemplates {
    public static final String TITLE = "Kết quả bài tập đã được công bố";
    public static final String TYPE = "ASSIGNMENT_RESULT";
    public static final String TEMPLATE = "ASSIGNMENT_FINALIZED";
    private final ObjectMapper mapper;
    private final SubmissionFinalizedEventsProperties properties;

    public SubmissionFinalizedMessageTemplates(ObjectMapper mapper, SubmissionFinalizedEventsProperties properties) {
        this.mapper = mapper;
        this.properties = properties;
    }

    public String text(SubmissionFinalizedEvent event) {
        return "Bài tập «" + event.assessmentTitle() + "» đã được chốt điểm. Điểm của bạn: "
                + score(event) + ". Xem chi tiết trong kết quả khóa học.";
    }

    public String email(SubmissionFinalizedEvent event, String fullName) {
        String name = fullName == null || fullName.isBlank() ? "học viên" : fullName;
        return EmailLayout.render(EmailLayout.Card.of(TITLE).greeting(name)
                .paragraph("Kết quả bài tập «" + event.assessmentTitle() + "» đã được công bố.")
                .paragraph("Điểm của bạn: " + score(event) + ".")
                .paragraph("Bạn có thể xem chi tiết trong kết quả khóa học trên LearnUP.")
                .button("Xem kết quả", properties.resultUrl(event.courseId())));
    }

    public String metadata(SubmissionFinalizedEvent event) {
        try {
            return mapper.writeValueAsString(Map.of(
                    "link", SubmissionFinalizedEventsProperties.resultPath(event.courseId()),
                    "courseId", event.courseId().toString(), "assessmentId", event.assessmentId().toString(),
                    "assignmentId", event.assessmentId().toString(), "submissionId", event.submissionId().toString(),
                    "finalizedAt", event.finalizedAt().toString()));
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("RESULT_METADATA_FAILED");
        }
    }

    private static String score(SubmissionFinalizedEvent event) {
        return number(event.finalScore()) + "/" + number(event.maxScore());
    }

    private static String number(BigDecimal value) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN"));
        format.setGroupingUsed(false);
        format.setMaximumFractionDigits(2);
        return format.format(value);
    }
}
