package com.learnup.notification.course;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
import com.learnup.notification.service.EmailDeliveryService;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
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
    private final RecipientDirectory directory = mock(RecipientDirectory.class);
    private final EmailDeliveryService emails = mock(EmailDeliveryService.class);
    private final CourseDecisionEventHandler handler =
            new CourseDecisionEventHandler(ledger, notifications, directory, emails);

    private static CourseDecisionEvent decision(boolean approved, Instant at) {
        return decision("Workplace Safety", approved, approved ? null : "Please revise the Assignment rubric.", at);
    }

    private static CourseDecisionEvent decision(String courseName, boolean approved, String reason, Instant at) {
        return new CourseDecisionEvent(UUID.randomUUID(), ORG, COURSE, INSTRUCTOR, courseName, 2,
                approved, reason, at);
    }

    private static Recipient instructor(String status, String email) {
        return new Recipient(INSTRUCTOR, "Trần Văn Minh", email, status);
    }

    private static EmailLogResponse mail(String status) {
        EmailLogResponse result = new EmailLogResponse();
        result.setStatus(status);
        return result;
    }

    private CreateNotificationRequest delivered(CourseDecisionEvent event) {
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("IN_APP"))).thenReturn(true);
        handler.handle(event);
        ArgumentCaptor<CreateNotificationRequest> sent = ArgumentCaptor.forClass(CreateNotificationRequest.class);
        verify(notifications).sendNotification(sent.capture());
        verify(ledger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
        return sent.getValue();
    }

    /** Both channels are open for this event and the Instructor can be written to. */
    private void bothChannelsOpen(CourseDecisionEvent event, Recipient recipient) {
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("IN_APP"))).thenReturn(true);
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("EMAIL"))).thenReturn(true);
        when(directory.find(ORG, INSTRUCTOR)).thenReturn(Optional.of(recipient));
        when(emails.sendEmail(any(SendEmailRequest.class))).thenReturn(mail("SENT"));
    }

    private SendEmailRequest emailSent() {
        ArgumentCaptor<SendEmailRequest> sent = ArgumentCaptor.forClass(SendEmailRequest.class);
        verify(emails).sendEmail(sent.capture());
        return sent.getValue();
    }

    // ---- in-app notice (UC49) ----

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
        verifyNoInteractions(ledger, notifications, directory, emails);
    }

    // ---- e-mail (UC21.3, BR-84) ----

    @Test
    void emailsTheInstructorTheRejectionWithTheReason() {
        CourseDecisionEvent event = decision(false, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));

        handler.handle(event);

        SendEmailRequest mail = emailSent();
        assertThat(mail.getRecipientEmail()).isEqualTo("minh@abc.vn");
        assertThat(mail.getSubject()).isEqualTo("LearnUP - Khóa học bị từ chối");
        assertThat(mail.getTemplateCode()).isEqualTo("COURSE_REJECTED");
        assertThat(mail.getBody()).contains("Xin chào Trần Văn Minh,")
                .contains("Quản lý đào tạo đã từ chối khóa học")
                .contains("«Workplace Safety»").contains("phiên bản 2")
                .contains("Please revise the Assignment rubric.")
                .contains("gửi duyệt lại");
        verify(ledger).sent(event.eventId(), INSTRUCTOR, "EMAIL");
        verify(ledger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
    }

    @Test
    void emailsTheInstructorTheApproval() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));

        handler.handle(event);

        SendEmailRequest mail = emailSent();
        assertThat(mail.getSubject()).isEqualTo("LearnUP - Khóa học đã được phê duyệt");
        assertThat(mail.getTemplateCode()).isEqualTo("COURSE_APPROVED");
        assertThat(mail.getBody()).contains("Quản lý đào tạo đã phê duyệt khóa học")
                .contains("đã được công bố")
                .doesNotContain("Lý do").doesNotContain("gửi duyệt lại");
    }

    @Test
    void whatPeopleTypedIsEscapedInTheEmail() {
        CourseDecisionEvent event = decision("<b>Safety</b> & \"Co\"", false,
                "<script>alert(1)</script> don't", Instant.now());
        bothChannelsOpen(event, new Recipient(INSTRUCTOR, "<i>Minh</i>", "minh@abc.vn", "Active"));

        handler.handle(event);

        String body = emailSent().getBody();
        assertThat(body).doesNotContain("<script>").doesNotContain("<b>Safety").doesNotContain("<i>Minh")
                .contains("&lt;script&gt;alert(1)&lt;/script&gt; don&#39;t")
                .contains("&lt;b&gt;Safety&lt;/b&gt; &amp; &quot;Co&quot;")
                .contains("&lt;i&gt;Minh&lt;/i&gt;");
    }

    @Test
    void anInstructorWithoutAKnownNameStillGetsTheEmail() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, new Recipient(INSTRUCTOR, null, "minh@abc.vn", "Active"));
        handler.handle(event);
        assertThat(emailSent().getBody()).contains("Xin chào,").doesNotContain("null");
    }

    @Test
    void looksTheInstructorUpInTheOrganizationOfTheCourse() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        handler.handle(event);
        verify(directory).find(ORG, INSTRUCTOR);
    }

    @Test
    void aSimulatedEmailCountsAsDelivered() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        when(emails.sendEmail(any(SendEmailRequest.class))).thenReturn(mail("SIMULATED"));

        handler.handle(event);

        verify(ledger).sent(event.eventId(), INSTRUCTOR, "EMAIL");
    }

    @Test
    void anEmailAlreadySentIsNotSentAgainWhenTheEventIsRedelivered() {
        CourseDecisionEvent event = decision(true, Instant.now());
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("IN_APP"))).thenReturn(false);
        when(ledger.claim(eq(event), eq(INSTRUCTOR), eq("EMAIL"))).thenReturn(false);

        handler.handle(event);

        verifyNoInteractions(notifications, directory, emails);
    }

    @Test
    void noEmailIsWrittenToAnInstructorWhoIsGoneDeactivatedOrWithoutAnAddress() {
        for (Recipient recipient : new Recipient[] {
                instructor("Deleted", "minh@abc.vn"), instructor("Deactivated", "minh@abc.vn"),
                instructor("Active", null), instructor("Active", "  ") }) {
            CourseSubmissionDeliveryLedger freshLedger = mock(CourseSubmissionDeliveryLedger.class);
            NotificationService freshNotifications = mock(NotificationService.class);
            RecipientDirectory freshDirectory = mock(RecipientDirectory.class);
            EmailDeliveryService freshEmails = mock(EmailDeliveryService.class);
            CourseDecisionEvent event = decision(true, Instant.now());
            when(freshLedger.claim(eq(event), eq(INSTRUCTOR), any())).thenReturn(true);
            when(freshDirectory.find(ORG, INSTRUCTOR)).thenReturn(Optional.of(recipient));

            new CourseDecisionEventHandler(freshLedger, freshNotifications, freshDirectory, freshEmails)
                    .handle(event);

            verifyNoInteractions(freshEmails);
            verify(freshLedger).skipped(event.eventId(), INSTRUCTOR, "EMAIL");
            verify(freshLedger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
        }
    }

    @Test
    void noEmailIsWrittenWhenTheOrganizationHasNoSuchInstructor() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        when(directory.find(ORG, INSTRUCTOR)).thenReturn(Optional.empty());

        handler.handle(event);

        verifyNoInteractions(emails);
        verify(ledger).skipped(event.eventId(), INSTRUCTOR, "EMAIL");
    }

    @Test
    void aFailedEmailIsMarkedAndRetriedButTheNoticeStillGoes() {
        CourseDecisionEvent event = decision(false, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        when(emails.sendEmail(any(SendEmailRequest.class))).thenReturn(mail("FAILED"));

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);

        verify(ledger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
        verify(ledger).failed(event.eventId(), INSTRUCTOR, "EMAIL", "EMAIL_FAILED");
        verify(ledger, never()).sent(event.eventId(), INSTRUCTOR, "EMAIL");
    }

    @Test
    void aFailedNoticeDoesNotStopTheEmail() {
        CourseDecisionEvent event = decision(false, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        when(notifications.sendNotification(any())).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);

        verify(ledger).failed(event.eventId(), INSTRUCTOR, "IN_APP", "IN_APP_FAILED");
        verify(ledger).sent(event.eventId(), INSTRUCTOR, "EMAIL");
    }

    @Test
    void tenantServiceDownForAMomentMeansRetryNotLoss() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        when(directory.find(ORG, INSTRUCTOR)).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"));

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);

        verify(ledger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
        verify(ledger).failed(event.eventId(), INSTRUCTOR, "EMAIL", "EMAIL_FAILED");
        verifyNoInteractions(emails);
    }

    @Test
    void aRefusalFromTenantServiceIsNotRetried() {
        CourseDecisionEvent event = decision(true, Instant.now());
        bothChannelsOpen(event, instructor("Active", "minh@abc.vn"));
        when(directory.find(ORG, INSTRUCTOR)).thenThrow(new PermanentDeliveryException("TENANT_REJECTED"));

        handler.handle(event); // no exception: the event is not redelivered for something retrying cannot fix

        verify(ledger).sent(event.eventId(), INSTRUCTOR, "IN_APP");
        verify(ledger).failed(event.eventId(), INSTRUCTOR, "EMAIL", "TENANT_REJECTED");
        verifyNoInteractions(emails);
    }

    @Test
    void theApprovalEmailIsACardWithABadgeTheCourseDetailsAndAFooter() {
        String body = CourseDecisionEventHandler.emailHtml(decision(true, Instant.now()), "Trần Văn Minh");
        assertThat(body).startsWith("<!DOCTYPE html>").contains("lang=\"vi\"").contains("charset=\"UTF-8\"")
                .contains("ĐÃ PHÊ DUYỆT").contains("Khóa học đã được công bố")
                .contains("Phiên bản").contains(">Đã phê duyệt<")
                .contains("không trả lời thư này")
                .doesNotContain("BỊ TỪ CHỐI").doesNotContain("Lý do từ chối")
                .doesNotContain("%s").doesNotContain("%d").doesNotContain("null");
    }

    @Test
    void theRejectionEmailPutsTheReasonInAMarkedBox() {
        String body = CourseDecisionEventHandler.emailHtml(decision(false, Instant.now()), "Trần Văn Minh");
        assertThat(body).contains("BỊ TỪ CHỐI").contains(">Bị từ chối<").contains("Lý do từ chối")
                .contains("Please revise the Assignment rubric.").contains("gửi duyệt lại")
                .doesNotContain("ĐÃ PHÊ DUYỆT").doesNotContain("Khóa học đã được công bố")
                .doesNotContain("%s").doesNotContain("%d").doesNotContain("null");
    }
}
