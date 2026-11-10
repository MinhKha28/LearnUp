package com.learnup.notification.course;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** The Course topic carries submissions and decisions; each reaches exactly its own handler. */
class CourseEventsListenerDispatchTest {
    private static final String ORG = "019a0000-0000-7000-8000-000000000002";
    private static final String AT = "2026-11-10T08:00:00.000Z";

    private final CourseSubmittedEventHandler submitted = mock(CourseSubmittedEventHandler.class);
    private final CourseDecisionEventHandler decided = mock(CourseDecisionEventHandler.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final CourseSubmittedEventListener listener = new CourseSubmittedEventListener(
            new CourseSubmittedEventParser(mapper), submitted, new CourseDecisionEventParser(mapper), decided);

    private static ConsumerRecord<String, String> record(String type, String extra) {
        String json = """
            {"eventId":"%s","eventType":"%s","version":1,"producer":"course-service","organizationId":"%s","occurredAt":"%s",
             "data":{"organizationId":"%s","courseId":"%s","courseName":"Safety","versionNumber":1,"instructorId":"%s",
                     "occurredAt":"%s"%s}}
            """.formatted(UUID.randomUUID(), type, ORG, AT, ORG, UUID.randomUUID(), UUID.randomUUID(), AT, extra);
        return new ConsumerRecord<>("course-events", 0, 0L, "key", json);
    }

    @Test
    void aSubmissionGoesOnlyToTheSubmissionHandler() {
        listener.onMessage(record("CourseSubmitted", ",\"submittedAt\":\"" + AT + "\""));
        verify(submitted).handle(any());
        verify(decided, never()).handle(any());
    }

    @Test
    void aRejectionGoesOnlyToTheDecisionHandler() {
        listener.onMessage(record("CourseRejected", ",\"rejectedAt\":\"" + AT + "\",\"rejectionReason\":\"Fix it\""));
        verify(decided).handle(any());
        verify(submitted, never()).handle(any());
    }

    @Test
    void anApprovalGoesOnlyToTheDecisionHandler() {
        listener.onMessage(record("CoursePublished", ",\"publishedAt\":\"" + AT + "\""));
        verify(decided).handle(any());
        verify(submitted, never()).handle(any());
    }

    @Test
    void anUnrelatedCourseEventReachesNeither() {
        listener.onMessage(record("CourseArchived", ""));
        verify(submitted, never()).handle(any());
        verify(decided, never()).handle(any());
    }
}
