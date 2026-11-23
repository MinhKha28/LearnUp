package com.learnup.notification.course;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.enrollment.InvalidEventException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Mirrors Course's contract {@code contracts/events/course-review-decision.json} (UC21.3). */
class CourseDecisionEventParserTest {
    private static final String ORG = "019a0000-0000-7000-8000-000000000002";
    private static final String COURSE = "019a0000-0000-7000-8000-000000000001";
    private static final String INSTRUCTOR = "019a0000-0000-7000-8000-000000000003";
    private static final String AT = "2026-11-10T08:00:00.000Z";

    private final CourseDecisionEventParser parser = new CourseDecisionEventParser(new ObjectMapper());

    private static String event(String type, String decisionFields) {
        return """
            {"eventId":"%s","eventType":"%s","version":1,"producer":"course-service",
             "organizationId":"%s","occurredAt":"%s",
             "data":{"organizationId":"%s","courseId":"%s","courseName":"Workplace Safety","versionNumber":2,
                     "instructorId":"%s","organizerId":"019a0000-0000-7000-8000-000000000004",
                     "occurredAt":"%s","decidedAt":"%s"%s}}
            """.formatted(UUID.randomUUID(), type, ORG, AT, ORG, COURSE, INSTRUCTOR, AT, AT, decisionFields);
    }

    @Test
    void parsesARejectionWithItsReason() {
        var parsed = parser.parse(event("CourseRejected",
                ",\"rejectedAt\":\"" + AT + "\",\"rejectionReason\":\"  Please revise the Assignment rubric.  \"")).orElseThrow();
        assertThat(parsed.approved()).isFalse();
        assertThat(parsed.rejectionReason()).isEqualTo("Please revise the Assignment rubric.");
        assertThat(parsed.instructorId()).isEqualTo(UUID.fromString(INSTRUCTOR));
        assertThat(parsed.organizationId()).isEqualTo(UUID.fromString(ORG));
        assertThat(parsed.versionNumber()).isEqualTo(2);
    }

    @Test
    void parsesAnApproval() {
        var parsed = parser.parse(event("CoursePublished", ",\"publishedAt\":\"" + AT + "\"")).orElseThrow();
        assertThat(parsed.approved()).isTrue();
        assertThat(parsed.rejectionReason()).isNull();
        assertThat(parsed.courseName()).isEqualTo("Workplace Safety");
    }

    @ParameterizedTest
    @ValueSource(strings = {"CourseSubmitted", "CourseArchived", "SomethingNew"})
    void otherCourseEventsAreNotDecisions(String type) {
        assertThat(parser.parse(event(type, ""))).isEmpty();
    }

    @Test
    void aRejectionWithoutAReasonIsInvalid() {
        assertThatThrownBy(() -> parser.parse(event("CourseRejected", ",\"rejectedAt\":\"" + AT + "\"")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(event("CourseRejected",
                ",\"rejectedAt\":\"" + AT + "\",\"rejectionReason\":\"   \"")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(event("CourseRejected",
                ",\"rejectedAt\":\"" + AT + "\",\"rejectionReason\":\"" + "x".repeat(1001) + "\"")))
                .isInstanceOf(InvalidEventException.class);
    }

    @Test
    void anApprovalWithoutPublishedAtIsInvalid() {
        assertThatThrownBy(() -> parser.parse(event("CoursePublished", "")))
                .isInstanceOf(InvalidEventException.class);
    }

    @Test
    void scopeAndEnvelopeAreChecked() {
        String otherOrg = event("CoursePublished", ",\"publishedAt\":\"" + AT + "\"")
                .replaceFirst("\"data\":\\{\"organizationId\":\"" + ORG, "\"data\":{\"organizationId\":\"" + UUID.randomUUID());
        assertThatThrownBy(() -> parser.parse(otherOrg)).isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(event("CoursePublished", ",\"publishedAt\":\"" + AT + "\"")
                .replace("course-service", "tenant-service"))).isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(event("CoursePublished", ",\"publishedAt\":\"" + AT + "\"")
                .replace("\"version\":1", "\"version\":2"))).isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse("not json")).isInstanceOf(InvalidEventException.class);
    }
}
