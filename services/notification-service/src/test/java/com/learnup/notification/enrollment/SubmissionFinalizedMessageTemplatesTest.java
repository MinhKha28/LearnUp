package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.config.SubmissionFinalizedEventsProperties;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;

class SubmissionFinalizedMessageTemplatesTest {
    private final SubmissionFinalizedEventsProperties properties = new SubmissionFinalizedEventsProperties();
    private final SubmissionFinalizedMessageTemplates templates =
            new SubmissionFinalizedMessageTemplates(new ObjectMapper(), properties);

    @Test void usesTheApprovedVietnameseDraftsAndResolverWithoutComments() throws Exception {
        properties.setFrontendBaseUrl("https://learnup.example/app///");
        var event = SubmissionFinalizedEventParserTest.event();
        assertThat(templates.text(event)).isEqualTo("Bài tập «An toàn» đã được chốt điểm. Điểm của bạn: 66,67/100. Xem chi tiết trong kết quả khóa học.");
        assertThat(templates.email(event, null)).contains("Xin chào học viên,", "Kết quả bài tập «An toàn» đã được công bố.",
                "Điểm của bạn: 66,67/100.", "Bạn có thể xem chi tiết trong kết quả khóa học trên LearnUP.",
                "Xem kết quả", "https://learnup.example/app/learner/courses/by-course/" + event.courseId() + "/results");
        assertThat(SubmissionFinalizedMessageTemplates.TITLE).isEqualTo("Kết quả bài tập đã được công bố");
        var metadata = new ObjectMapper().readTree(templates.metadata(event));
        assertThat(metadata.size()).isEqualTo(6);
        assertThat(metadata.get("assignmentId").asText()).isEqualTo(event.assessmentId().toString());
        assertThat(metadata.get("link").asText()).startsWith("/learner/courses/by-course/");
    }

    @Test void formatsBoundaryAndWholeScoresWithoutPercentOrGrouping() {
        for (String score : new String[] {"0.00", "80.00", "100.00"}) {
            var source = SubmissionFinalizedEventParserTest.event();
            var event = new SubmissionFinalizedEvent(source.eventId(), source.occurredAt(), source.organizationId(),
                    source.learnerId(), source.submissionId(), source.assessmentId(), source.assessmentTitle(),
                    new BigDecimal(score), source.maxScore(), source.courseId(), source.finalizedAt());
            assertThat(templates.text(event)).contains(new BigDecimal(score).intValue() + "/100").doesNotContain("%", ",00");
        }
    }

    @Test void unknownCommentFieldsCannotReachMessageEmailOrMetadata() {
        properties.setFrontendBaseUrl("https://learnup.example");
        var envelope = SubmissionFinalizedEventParserTest.envelope(SubmissionFinalizedEventParserTest.event());
        ((com.fasterxml.jackson.databind.node.ObjectNode) envelope.get("data"))
                .put("finalizationComment", "PRIVATE_GRADER_COMMENT").put("graderComment", "PRIVATE_GRADER_COMMENT");
        var event = new SubmissionFinalizedEventParser(new ObjectMapper()).parse(envelope.toString()).orElseThrow();
        assertThat(templates.text(event) + templates.email(event, "Hà") + templates.metadata(event))
                .doesNotContain("PRIVATE_GRADER_COMMENT", "finalizationComment", "graderComment");
    }
    @Test void escapesUntrustedTitleAndGreetingInEmail() {
        properties.setFrontendBaseUrl("https://learnup.example");
        var source = SubmissionFinalizedEventParserTest.event();
        var event = new SubmissionFinalizedEvent(source.eventId(), source.occurredAt(), source.organizationId(),
                source.learnerId(), source.submissionId(), source.assessmentId(), "<script>alert(1)</script>",
                source.finalScore(), source.maxScore(), source.courseId(), source.finalizedAt());
        assertThat(templates.email(event, "<img src=x>")).contains("&lt;script&gt;", "&lt;img")
                .doesNotContain("<script>", "<img src=x>");
    }
}
