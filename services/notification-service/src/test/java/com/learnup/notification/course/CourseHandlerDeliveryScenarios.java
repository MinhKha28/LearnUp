package com.learnup.notification.course;

import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.service.EmailDeliveryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The in-app delivery rules each Course event handler must keep, run against the real ledger tables. */
abstract class CourseHandlerDeliveryScenarios extends CourseDeliveryDatabaseTest {
    @Autowired CourseDeliveryLedger realLedger;
    final EmailDeliveryService emails = mock(EmailDeliveryService.class);
    CourseDeliveryLedger ledger;

    abstract CourseDeliveryTable table();

    /** A new event for each test; the in-app obligation of its recipient. */
    abstract CourseDeliveryLedger.Obligation newEvent();

    /** Handles the current event with a fresh handler that uses the given ledger. */
    abstract void handle(CourseDeliveryLedger ledger);

    private CourseDeliveryLedger.Obligation inApp;

    @BeforeEach
    void prepareScenario() {
        reset(emails);
        EmailLogResponse sent = new EmailLogResponse();
        sent.setStatus("SENT");
        when(emails.sendEmail(any())).thenReturn(sent);
        ledger = spy(realLedger);
        inApp = newEvent();
    }

    private String inAppStatus() {
        return status(table(), inApp.eventId(), inApp.recipientUserId(), "IN_APP");
    }

    private long inAppNotices() {
        return notices(inApp.recipientUserId());
    }

    @Test
    void aFailureAfterTheNoticeRollsItBackAndTheRetryDeliversOnce() {
        AtomicBoolean firstDelivery = new AtomicBoolean(true);
        doAnswer(invocation -> {
            if (!firstDelivery.getAndSet(false)) return invocation.callRealMethod();
            Runnable writeNotice = invocation.getArgument(1);
            realLedger.deliverInApp(invocation.getArgument(0), () -> {
                writeNotice.run();
                throw new IllegalStateException("TEST_AFTER_NOTICE");
            });
            return null;
        }).when(ledger).deliverInApp(any(), any());

        assertThatThrownBy(() -> handle(ledger)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(inAppNotices()).isZero();
        assertThat(inAppStatus()).isEqualTo("FAILED");

        handle(ledger);
        assertThat(inAppNotices()).isEqualTo(1);
        assertThat(inAppStatus()).isEqualTo("SENT");
        verify(emails, times(1)).sendEmail(any());
    }

    @Test
    void aFailureBetweenTheNoticeAndSentLeavesNoNoticeBehind() {
        doAnswer(invocation -> {
            Object saved = invocation.callRealMethod();
            jdbc.update("UPDATE " + table().tableName() + " SET attempts = attempts + 100"
                    + " WHERE event_id = ? AND recipient_user_id = ? AND channel = 'IN_APP'",
                    inApp.eventId(), inApp.recipientUserId());
            return saved;
        }).when(notificationService).sendNotification(any());

        assertThatThrownBy(() -> handle(ledger)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(inAppNotices()).isZero();
        assertThat(inAppStatus()).isEqualTo("FAILED");
        assertThat(attempts(table(), inApp.eventId(), inApp.recipientUserId(), "IN_APP")).isEqualTo(1);
    }

    @Test
    void aRetryAfterAnotherConsumerFinishedTheTakenOverClaimIsAcknowledged() {
        AtomicBoolean firstDelivery = new AtomicBoolean(true);
        doAnswer(invocation -> {
            if (firstDelivery.getAndSet(false)) {
                expireClaim(table(), inApp.eventId(), inApp.recipientUserId(), "IN_APP");
                CourseDeliveryLedger.Claim other = realLedger.claim(table(), inApp).orElseThrow();
                realLedger.deliverInApp(other, () -> notificationService.sendNotification(new CreateNotificationRequest(
                        inApp.organizationId(), inApp.recipientUserId(), "Tiêu đề", "Nội dung",
                        "COURSE_APPROVAL", "IN_APP", null)));
            }
            return invocation.callRealMethod();
        }).when(ledger).deliverInApp(any(), any());

        assertThatThrownBy(() -> handle(ledger)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(inAppNotices()).isEqualTo(1);
        assertThat(inAppStatus()).isEqualTo("SENT");

        assertThatCode(() -> handle(ledger)).doesNotThrowAnyException();
        assertThat(inAppNotices()).isEqualTo(1);
        assertThat(attempts(table(), inApp.eventId(), inApp.recipientUserId(), "IN_APP")).isEqualTo(2);
        verify(emails, times(1)).sendEmail(any());
    }
}
