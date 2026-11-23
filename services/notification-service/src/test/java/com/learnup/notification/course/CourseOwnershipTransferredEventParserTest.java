package com.learnup.notification.course;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.enrollment.InvalidEventException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CourseOwnershipTransferredEventParserTest {
    private final CourseOwnershipTransferredEventParser parser =
            new CourseOwnershipTransferredEventParser(new ObjectMapper());

    private static String valid() {
        return """
            {
              "eventId":"019a0000-0000-7000-8000-000000000001",
              "eventType":"CourseOwnershipTransferred",
              "version":1,
              "producer":"course-service",
              "organizationId":"019a0000-0000-7000-8000-000000000002",
              "occurredAt":"2026-11-10T12:00:00.000Z",
              "data":{
                "organizationId":"019a0000-0000-7000-8000-000000000002",
                "courseId":"019a0000-0000-7000-8000-000000000003",
                "chainId":"019a0000-0000-7000-8000-000000000004",
                "fromInstructorId":"019a0000-0000-7000-8000-000000000005",
                "toInstructorId":"019a0000-0000-7000-8000-000000000006",
                "actorUserId":"019a0000-0000-7000-8000-000000000007",
                "courseName":"Safety Training",
                "occurredAt":"2026-11-10T12:00:00.000Z"
              }
            }
            """;
    }

    @Test
    void parsesValidTransfer() {
        var event = parser.parse(valid()).orElseThrow();
        assertThat(event.courseName()).isEqualTo("Safety Training");
        assertThat(event.reason()).isNull();
        assertThat(event.fromInstructorId()).isNotEqualTo(event.toInstructorId());
    }

    @Test
    void ignoresOtherCourseEvents() {
        assertThat(parser.parse(valid().replace("CourseOwnershipTransferred", "CourseSubmitted"))).isEmpty();
    }

    @Test
    void rejectsBadScopeAndInvalidIds() {
        assertThatThrownBy(() -> parser.parse(valid().replaceFirst(
                "\"courseName\":\"Safety Training\"", "\"courseName\":\"\"")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(valid().replace(
                "\"version\":1", "\"version\":2")))
                .isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> parser.parse(valid().replace(
                "019a0000-0000-7000-8000-000000000006", "not-a-uuid")))
                .isInstanceOf(InvalidEventException.class);
    }
}
