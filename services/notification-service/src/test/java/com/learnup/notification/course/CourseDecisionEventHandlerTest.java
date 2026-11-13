package com.learnup.notification.course;

import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CourseDecisionEventHandlerTest {
    private static final UUID ORG = UUID.fromString("019a0000-0000-7000-8000-000000000002");
    private static final UUID COURSE = UUID.fromString("019a0000-0000-7000-8000-000000000001");
    private static final UUID INSTRUCTOR = UUID.fromString("019a0000-0000-7000-8000-000000000003");

    private final CourseSubmissionDeliveryLedger ledger = mock(CourseSubmissionDeliveryLedger.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final CourseDecisionEventHandler handler = new CourseDecisionEventHandler(ledger, notifications);

    private static CourseDecisionEvent decision(boolean approved, Instant at) {
        return new CourseDecisionEvent(UUID.randomUUID(), ORG, COURSE, INSTRUCTOR, "Workplace Safety", 2,
                approved, approved ? null : "Please revise the Assignment rubric.", at);
    }

    private CreateNotificationRequest delivered(CourseDecisionEvent event) {
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("IN_APP"))).thenReturn(true);
        handler.handle(event);
        ArgumentCaptor<CreateNotificationRequest> sent = ArgumentCaptor.forClass(CreateNotificationRequest.class);
        verify(notifications).sendNotification(sent.capture());
        verify(ledger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
        return sent.getValue();
    }

    @Test
    void tellsTheInstructorTheCourseWasRejectedWithTheReason() {
        CreateNotificationRequest notice = delivered(decision(false, Instant.now()));
        assertThat(notice.getRecipientUserId()).isEqualTo(INSTRUCTOR);
        assertThat(notice.getOrganizationId()).isEqualTo(ORG);
        assertThat(notice.getChannel()).isEqualTo("IN_APP");
        assertThat(notice.getType()).isEqualTo("COURSE_APPROVAL");
        assertThat(notice.getTitle()).isEqualTo("Khóa học bị từ chối");
        assertThat(notice.getMessage()).startsWith("Quản lý đào tạo đã từ chối khóa học «Workplace Safety»")
                .doesNotContain("Quản trị viên")
                .contains("«Workplace Safety»").contains("phiên bản 2")
                .contains("Lý do: Please revise the Assignment rubric.");
        assertThat(notice.getMetadata()).contains(COURSE.toString());
    }

    @Test
    void tellsTheInstructorTheCourseWasApproved() {
        CreateNotificationRequest notice = delivered(decision(true, Instant.now()));
        assertThat(notice.getTitle()).isEqualTo("Khóa học đã được phê duyệt");
        assertThat(notice.getMessage()).startsWith("Quản lý đào tạo đã phê duyệt khóa học «Workplace Safety»")
                .doesNotContain("Quản trị viên")
                .contains("«Workplace Safety»").contains("đã được công bố")
                .doesNotContain("Lý do");
    }

    @Test
    void aRedeliveredDecisionIsNotRepeated() {
        CourseDecisionEvent event = decision(true, Instant.now());
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("IN_APP"))).thenReturn(false);
        handler.handle(event);
        verifyNoInteractions(notifications);
    }

    @Test
    void aFailedDeliveryIsMarkedAndRetried() {
        CourseDecisionEvent event = decision(false, Instant.now());
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("IN_APP"))).thenReturn(true);
        when(notifications.sendNotification(any())).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        verify(ledger).failed(event.eventId(), INSTRUCTOR, "IN_APP", "IN_APP_FAILED");
        verify(ledger, never()).sent(any(), any(), any());
    }

    @Test
    void aDecisionOlderThanThreeDaysIsDropped() {
        handler.handle(decision(true, Instant.now().minus(73, ChronoUnit.HOURS)));
        verifyNoInteractions(ledger, notifications);
    }
}
