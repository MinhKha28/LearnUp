package com.learnup.notification.enrollment;

import com.learnup.notification.client.CourseDirectory;
import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.repository.EmailLogRepository;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

/**
 * The handler with the real ledger, the real in-app notices and the real e-mail records on a database; only the two
 * other services (tenant, course) are replaced. The consumer of Kafka is off.
 */
@SpringBootTest
@ActiveProfiles("test")
class EnrollmentEventHandlerIntegrationTest {

    @Autowired
    private EnrollmentEventHandler handler;
    @Autowired
    private EnrollmentEventDeliveryRepository deliveries;
    @Autowired
    private NotificationRepository notifications;
    @Autowired
    private EmailLogRepository emailLogs;

    @MockBean
    private RecipientDirectory recipients;
    @MockBean
    private CourseDirectory courses;

    private EnrollmentEvent assigned(UUID learner) {
        return new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.ASSIGNED, Instant.now().minusSeconds(30),
                UUID.randomUUID(), UUID.randomUUID(), learner, UUID.randomUUID(), AssignmentKind.CREATE,
                Instant.parse("2026-11-30T17:00:00Z"), null, null, null);
    }

    @Test
    void anAssignmentMakesOneNoticeOneMailRecordAndTwoRowsOfTheLedgerAndAnotherRunChangesNothing() {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = assigned(learner);
        when(recipients.find(any(), any())).thenReturn(Optional.of(new Recipient(learner, "Nguyễn Văn An", "an.integration@example.com", "Active")));
        when(courses.nameOf(any(), any())).thenReturn(Optional.of("An toàn lao động"));

        handler.handle(event);

        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, org.springframework.data.domain.Pageable.unpaged()).getContent())
                .singleElement().satisfies(notice -> {
                    assertThat(notice.getTitle()).isEqualTo("Bạn được giao một khóa học");
                    assertThat(notice.getMessage()).contains("An toàn lao động").contains("01/12/2026 00:00");
                    assertThat(notice.getType()).isEqualTo("ENROLLMENT_ASSIGNED");
                    assertThat(notice.getOrganizationId()).isEqualTo(event.organizationId());
                    assertThat(notice.isRead()).isFalse();
                });
        assertThat(emailLogs.findByRecipientEmailOrderBySentAtDesc("an.integration@example.com",
                org.springframework.data.domain.Pageable.unpaged()).getContent())
                .singleElement().satisfies(log -> assertThat(log.getStatus()).isEqualTo("SIMULATED"));
        assertThat(deliveries.findByEventId(event.eventId())).hasSize(2)
                .allSatisfy(row -> assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT));

        handler.handle(event);

        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, org.springframework.data.domain.Pageable.unpaged()).getTotalElements())
                .isEqualTo(1);
        assertThat(emailLogs.findByRecipientEmailOrderBySentAtDesc("an.integration@example.com",
                org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
    }

    @Test
    void aServiceThatIsDownLeavesFailedRowsAndTheRetryCompletesThem() {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = assigned(learner);
        when(recipients.find(any(), any())).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"));

        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(deliveries.findByEventId(event.eventId())).hasSize(2).allSatisfy(row -> {
            assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED);
            assertThat(row.getLastError()).isEqualTo("TENANT_UNAVAILABLE");
            assertThat(row.getAttempts()).isEqualTo(1);
        });

        doReturn(Optional.of(new Recipient(learner, "An", "retry.integration@example.com", "Active")))
                .when(recipients).find(any(), any());
        when(courses.nameOf(any(), any())).thenReturn(Optional.empty());
        handler.handle(event);

        EnrollmentEventDelivery email = deliveries
                .findByEventIdAndRecipientUserIdAndChannel(event.eventId(), learner, DeliveryChannel.EMAIL).orElseThrow();
        assertThat(email.getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(email.getAttempts()).isEqualTo(2);
        assertThat(email.getLastError()).isNull();
        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, org.springframework.data.domain.Pageable.unpaged()).getTotalElements())
                .isEqualTo(1);
    }

    @Test
    void aWithdrawalLeavesNoTraceAtAll() {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.WITHDREW, Instant.now(),
                UUID.randomUUID(), UUID.randomUUID(), learner, UUID.randomUUID(), null, null, null, null, null);

        handler.handle(event);

        assertThat(deliveries.findByEventId(event.eventId())).isEmpty();
        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, org.springframework.data.domain.Pageable.unpaged()).getTotalElements())
                .isZero();
    }
}
