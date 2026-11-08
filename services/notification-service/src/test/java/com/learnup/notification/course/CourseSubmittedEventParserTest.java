package com.learnup.notification.course;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.enrollment.InvalidEventException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CourseSubmittedEventParserTest {
    private static final String EVENT = "019a0000-0000-7000-8000-000000000001";
    private static final String ORG = "019a0000-0000-7000-8000-000000000002";
    private static final String COURSE = "019a0000-0000-7000-8000-000000000003";
    private static final String INSTRUCTOR = "019a0000-0000-7000-8000-000000000004";
    private final CourseSubmittedEventParser parser = new CourseSubmittedEventParser(new ObjectMapper());

    private static String valid() {
        return """
            {"eventId":"%s","eventType":"CourseSubmitted","version":1,
             "occurredAt":"2026-11-08T05:00:00.000Z","organizationId":"%s","producer":"course-service",
             "data":{"organizationId":"%s","courseId":"%s","instructorId":"%s",
             "courseName":"Safety Training","versionNumber":1,
             "occurredAt":"2026-11-08T05:00:00.000Z",
             "submittedAt":"2026-11-08T05:00:00.000Z"}}
            """.formatted(EVENT, ORG, ORG, COURSE, INSTRUCTOR);
    }

    @Test
    void parsesAValidCourseSubmissionEvent() {
        var event = parser.parse(valid()).orElseThrow();
        assertThat(event.eventId()).isEqualTo(UUID.fromString(EVENT));
        assertThat(event.organizationId()).isEqualTo(UUID.fromString(ORG));
        assertThat(event.courseId()).isEqualTo(UUID.fromString(COURSE));
        assertThat(event.instructorId()).isEqualTo(UUID.fromString(INSTRUCTOR));
        assertThat(event.versionNumber()).isEqualTo(1);
        assertThat(event.courseName()).isEqualTo("Safety Training");
    }

    @Test
    void ignoresOtherCourseEventsFromSharedTopic() {
        assertThat(parser.parse(valid().replace("CourseSubmitted", "CourseDisabled"))).isEmpty();
    }

    @Test
    void rejectsInvalidPayloads() {
        assertThatThrownBy(() -> parser.parse(valid().replace("\"versionNumber\":1", "\"versionNumber\":0")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(valid().replace(INSTRUCTOR, "not-uuid")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(valid().replace("course-service", "other-service")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(valid().replaceFirst("2026-11-08T05:00:00.000Z", "2026-11-07T05:00:00.000Z")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse("not-json"))
                .isInstanceOf(InvalidEventException.class);
    }
}
