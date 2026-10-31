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
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

/**
 * The handler with the real ledger, the real in-app notices and the real e-mail records on a database; only the two
 * other services (tenant, course) are replaced. The consumer of Kafka is off.
 * <p>
 * The tables are made by the real migrations (V1, V2), not by Hibernate: the unique key of the ledger and the CHECKs
 * are what the claim relies on, and a schema made from the entities alone does not have them.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class EnrollmentEventHandlerIntegrationTest {

    /** Its own in-memory database, so no other test class has made these tables before the migrations run. Unless a PostgreSQL is given (see below). */
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        if (!"true".equals(System.getenv("NOTIFICATION_TEST_POSTGRES"))) {
            registry.add("spring.datasource.url",
                    () -> "jdbc:h2:mem:handler_integration;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL");
        }
    }

    @Autowired
    private EnrollmentEventHandler handler;
    @Autowired
    private EnrollmentEventDeliveryRepository deliveries;
    @Autowired
    private NotificationRepository notifications;
    @Autowired
    private EmailLogRepository emailLogs;

    @SpyBean
    private JpaDeliveryLedger ledger;
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
                    assertThat(notice.getMessage()).contains("An toàn lao động").contains("hết ngày 30/11/2026");
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

    @Test
    void aClaimIsExclusiveUntilTheLeaseEndsAndThenTheRowCanBeTakenOver() {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = assigned(learner);
        Instant start = Instant.parse("2026-10-30T01:00:00Z");
        EnrollmentEventDelivery mine = ledger.open(event, learner, DeliveryChannel.EMAIL, start);
        EnrollmentEventDelivery theirs = ledger.open(event, learner, DeliveryChannel.EMAIL, start);

        assertThat(ledger.claim(mine, start)).isTrue();
        assertThat(mine.getStatus()).isEqualTo(DeliveryStatus.PROCESSING);
        assertThat(ledger.claim(theirs, start.plusSeconds(60))).isFalse();
        assertThat(theirs.getStatus()).isEqualTo(DeliveryStatus.PENDING);

        // The default lease is 2 minutes: after it the other handler takes the row over.
        assertThat(ledger.claim(theirs, start.plusSeconds(180))).isTrue();
        EnrollmentEventDelivery stored = deliveries.findById(mine.getId()).orElseThrow();
        assertThat(stored.getClaimedAt()).isEqualTo(start.plusSeconds(180));
        assertThat(stored.getAttempts()).isEqualTo(2);
        assertThat(theirs.getAttempts()).isEqualTo(2);
    }

    @Test
    void aFailedRowCanBeClaimedAgainButASentOneNever() {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = assigned(learner);
        Instant start = Instant.parse("2026-10-30T01:00:00Z");
        EnrollmentEventDelivery row = ledger.open(event, learner, DeliveryChannel.IN_APP, start);
        assertThat(ledger.claim(row, start)).isTrue();
        row.markFailed("IN_APP_FAILED", start.plusSeconds(1));
        ledger.record(row);

        assertThat(ledger.claim(row, start.plusSeconds(2))).isTrue();
        row.markSent(start.plusSeconds(3));
        ledger.record(row);

        EnrollmentEventDelivery stale = ledger.open(event, learner, DeliveryChannel.IN_APP, start);
        stale.refreshFrom(new EnrollmentEventDelivery(event.eventId(), "EnrollmentAssigned", event.organizationId(),
                event.enrollmentId(), learner, DeliveryChannel.IN_APP, event.occurredAt(), start));
        assertThat(stale.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(ledger.claim(stale, start.plusSeconds(1000))).isFalse();
        assertThat(deliveries.findById(row.getId()).orElseThrow().getStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    /**
     * The overlap of two consumers on one event, made deterministic: handler B has loaded both rows as PENDING, then
     * handler A handles the whole event, then B goes on with its old view of the rows. B must find the rows taken and
     * send nothing. Without the claim B would pass its own check ("not final") and send a second notice and a second mail.
     */
    @Test
    void aHandlerThatLoadedTheRowsBeforeAnotherFinishedSendsNothing() throws Exception {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = assigned(learner);
        when(recipients.find(any(), any())).thenReturn(Optional.of(new Recipient(learner, "Nguyễn Văn An", "late.integration@example.com", "Active")));
        when(courses.nameOf(any(), any())).thenReturn(Optional.of("An toàn lao động"));
        CountDownLatch lateHasLoadedTheRows = new CountDownLatch(1);
        CountDownLatch firstHasFinished = new CountDownLatch(1);
        doAnswer(call -> {
            Object row = call.callRealMethod();
            if (Thread.currentThread().getName().equals("late-handler") && call.getArgument(2) == DeliveryChannel.EMAIL) {
                lateHasLoadedTheRows.countDown();
                if (!firstHasFinished.await(30, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("the first handler did not finish");
                }
            }
            return row;
        }).when(ledger).open(any(), any(), any(), any());

        ExecutorService pool = Executors.newSingleThreadExecutor(runnable -> new Thread(runnable, "late-handler"));
        try {
            Future<?> late = pool.submit(() -> handler.handle(event));
            assertThat(lateHasLoadedTheRows.await(30, TimeUnit.SECONDS)).isTrue();
            handler.handle(event);
            firstHasFinished.countDown();
            late.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, org.springframework.data.domain.Pageable.unpaged()).getTotalElements())
                .isEqualTo(1);
        assertThat(emailLogs.findByRecipientEmailOrderBySentAtDesc("late.integration@example.com",
                org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
        assertThat(deliveries.findByEventId(event.eventId())).hasSize(2).allSatisfy(row -> {
            assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT);
            assertThat(row.getAttempts()).isEqualTo(1);
            assertThat(row.getClaimedAt()).isNull();
        });
    }

    /**
     * Two handlers really at the same moment. It also runs on PostgreSQL: with NOTIFICATION_TEST_POSTGRES=true, and
     * SPRING_DATASOURCE_URL / _USERNAME / _PASSWORD / _DRIVER_CLASS_NAME and
     * SPRING_JPA_DATABASE_PLATFORM=org.hibernate.dialect.PostgreSQLDialect pointing at a throw-away database.
     */
    @Test
    void twoHandlersAtTheSameTimeForOneEventSendOneNoticeAndOneMail() throws Exception {
        UUID learner = UUID.randomUUID();
        EnrollmentEvent event = assigned(learner);
        CyclicBarrier together = new CyclicBarrier(2);
        // A handler that does not reach the barrier (it lost the claim) waits for the timeout and goes on.
        when(recipients.find(any(), any())).thenAnswer(call -> {
            try {
                together.await(2, TimeUnit.SECONDS);
            } catch (TimeoutException alone) {
                // The other handler never got here.
            }
            return Optional.of(new Recipient(learner, "Nguyễn Văn An", "race.integration@example.com", "Active"));
        });
        when(courses.nameOf(any(), any())).thenReturn(Optional.of("An toàn lao động"));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<?>> runs = List.of(pool.submit(() -> handler.handle(event)), pool.submit(() -> handler.handle(event)));
            for (Future<?> run : runs) {
                run.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(notifications.findByRecipientUserIdOrderByCreatedAtDesc(learner, org.springframework.data.domain.Pageable.unpaged()).getTotalElements())
                .isEqualTo(1);
        assertThat(emailLogs.findByRecipientEmailOrderBySentAtDesc("race.integration@example.com",
                org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
        assertThat(deliveries.findByEventId(event.eventId())).hasSize(2)
                .allSatisfy(row -> {
                    assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT);
                    assertThat(row.getAttempts()).isEqualTo(1);
                });
    }
}
