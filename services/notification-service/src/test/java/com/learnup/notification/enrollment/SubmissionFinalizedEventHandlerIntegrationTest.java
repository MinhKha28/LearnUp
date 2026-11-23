package com.learnup.notification.enrollment;

import com.learnup.notification.client.Recipient;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.DeliveryStatus;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import com.learnup.notification.repository.NotificationRepository;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate",
        "learnup.frontend-base-url=https://learnup.example",
        "learnup.enrollment-events.enabled=false", "learnup.course-events.enabled=false",
        "learnup.submission-finalized.enabled=false"
})
@ActiveProfiles("test")
class SubmissionFinalizedEventHandlerIntegrationTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String postgres = System.getenv("SUBMISSION_FINALIZED_TEST_POSTGRES_URL");
        registry.add("spring.datasource.url", () -> postgres == null
                ? "jdbc:h2:mem:submission_finalized_it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL" : postgres);
        if (postgres != null) {
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
            registry.add("spring.datasource.username", () -> System.getenv("SUBMISSION_FINALIZED_TEST_POSTGRES_USER"));
            registry.add("spring.datasource.password", () -> System.getenv("SUBMISSION_FINALIZED_TEST_POSTGRES_PASSWORD"));
            registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        }
    }

    @Autowired org.springframework.context.ApplicationContext context;
    @Autowired SubmissionFinalizedEventHandler handler;
    @Autowired JpaDeliveryLedger ledger;
    @Autowired EnrollmentEventDeliveryRepository deliveries;
    @Autowired NotificationRepository notifications;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @MockBean RecipientDirectory recipients;
    @SpyBean NotificationService notificationService;

    @BeforeEach void setup() {
        reset(notificationService, recipients);
        when(recipients.find(any(), any())).thenReturn(Optional.empty());
    }

    private EnrollmentEventDelivery open(SubmissionFinalizedEvent event) {
        return ledger.open(event.eventId(), "SubmissionFinalized", event.organizationId(), null,
                event.learnerId(), DeliveryChannel.IN_APP, event.occurredAt(), Instant.now());
    }

    private long noticeCount(SubmissionFinalizedEvent event) {
        return notifications.findByRecipientUserIdOrderByCreatedAtDesc(event.learnerId(), Pageable.unpaged()).getTotalElements();
    }

    @Test void disabledConsumerDoesNotRegisterAListenerOrStarter() {
        assertThat(context.getBeansOfType(SubmissionFinalizedEventListener.class)).isEmpty();
        assertThat(context.getBeansOfType(SubmissionFinalizedEventListenerStarter.class)).isEmpty();
    }
    @Test void migrationsSupportTheReusedLedgerAndReplayProducesOneNotice() {
        var event = SubmissionFinalizedEventParserTest.event();
        handler.handle(event); handler.handle(event);
        assertThat(noticeCount(event)).isEqualTo(1);
        assertThat(deliveries.findByEventId(event.eventId())).hasSize(2).allSatisfy(row -> {
            assertThat(row.getEnrollmentId()).isNull();
            assertThat(row.getEventType()).isEqualTo("SubmissionFinalized");
            assertThat(row.getAttempts()).isEqualTo(1);
        });
    }

    @Test void insertAndSentRollBackTogetherWhenSendingThrowsAfterInsert() {
        var event = SubmissionFinalizedEventParserTest.event();
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("TEST_AFTER_INSERT");
        }).when(notificationService).sendNotification(any());
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(noticeCount(event)).isZero();
        assertThat(deliveries.findByEventId(event.eventId())).filteredOn(row -> row.getChannel() == DeliveryChannel.IN_APP)
                .singleElement().satisfies(row -> assertThat(row.getStatus()).isEqualTo(DeliveryStatus.FAILED));
        reset(notificationService);
        handler.handle(event);
        assertThat(noticeCount(event)).isEqualTo(1);
    }

    @Test void aFreshClaimIsRetryableAndOnlyOneConcurrentClaimWins() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        var row = open(event);
        var start = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var first = workers.submit(() -> attemptClaim(event, row, start));
            var second = workers.submit(() -> attemptClaim(event, row, start));
            start.countDown();
            assertThat((first.get(10, TimeUnit.SECONDS) ? 1 : 0) + (second.get(10, TimeUnit.SECONDS) ? 1 : 0)).isEqualTo(1);
        }
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(noticeCount(event)).isZero();
        assertThat(deliveries.findById(row.getId()).orElseThrow().getStatus()).isEqualTo(DeliveryStatus.PROCESSING);
    }

    private boolean attemptClaim(SubmissionFinalizedEvent event, EnrollmentEventDelivery row, CountDownLatch start) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        try {
            return handler.claim(event, row.getId()) != null;
        } catch (DependencyUnavailableException held) {
            return false;
        }
    }

    @Test void leaseTakeoverFencesOldInsertCompletionAndFailure() {
        var event = SubmissionFinalizedEventParserTest.event();
        var row = open(event);
        var oldClaim = handler.claim(event, row.getId());
        jdbc.update("UPDATE enrollment_event_deliveries SET claimed_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().minusSeconds(180)), row.getId());
        var newClaim = handler.claim(event, row.getId());
        assertThat(newClaim.attempt()).isEqualTo(oldClaim.attempt() + 1);
        assertThatThrownBy(() -> handler.sendInApp(event, oldClaim)).hasMessage("DELIVERY_CLAIM_LOST");
        handler.failIfOwned(oldClaim, "STALE_FAILURE");
        assertThat(noticeCount(event)).isZero();
        handler.sendInApp(event, newClaim);
        handler.failIfOwned(oldClaim, "STALE_FAILURE");
        assertThatThrownBy(() -> handler.sendInApp(event, oldClaim)).hasMessage("DELIVERY_CLAIM_LOST");
        var stored = deliveries.findById(row.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(stored.getLastError()).isNull();
        assertThat(noticeCount(event)).isEqualTo(1);
    }

    @Test void lockedRecheckWaitsForTheOtherTransactionAndObservesItsNewState() throws Exception {
        var event = SubmissionFinalizedEventParserTest.event();
        var row = open(event);
        var claim = handler.claim(event, row.getId());
        var locked = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var holder = workers.submit(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
                var stored = deliveries.lockById(row.getId()).orElseThrow();
                stored.markSent(Instant.now());
                deliveries.saveAndFlush(stored);
                locked.countDown();
                try {
                    if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("TEST_LOCK_TIMEOUT");
                } catch (InterruptedException failure) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("TEST_INTERRUPTED");
                }
            }));
            assertThat(locked.await(5, TimeUnit.SECONDS)).isTrue();
            var stale = workers.submit(() -> handler.sendInApp(event, claim));
            try {
                assertThatThrownBy(() -> stale.get(150, TimeUnit.MILLISECONDS))
                        .isInstanceOf(java.util.concurrent.TimeoutException.class);
            } finally {
                release.countDown();
            }
            holder.get(5, TimeUnit.SECONDS);
            assertThatThrownBy(() -> stale.get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(DependencyUnavailableException.class);
        }
        assertThat(noticeCount(event)).isZero();
    }

    @Test void tenantOutageDoesNotUndoInAppAndRecoversWithoutRepeatingIt() {
        var event = SubmissionFinalizedEventParserTest.event();
        when(recipients.find(any(), any())).thenThrow(new DependencyUnavailableException("TENANT_UNAVAILABLE"))
                .thenReturn(Optional.of(new Recipient(event.learnerId(), null, "test@example.test", "Active")));
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(DependencyUnavailableException.class);
        assertThat(noticeCount(event)).isEqualTo(1);
        handler.handle(event);
        assertThat(noticeCount(event)).isEqualTo(1);
        assertThat(deliveries.findByEventId(event.eventId())).allSatisfy(row ->
                assertThat(row.getStatus()).isEqualTo(DeliveryStatus.SENT));
    }

    @Test void mismatchedOrganizationCannotReuseTheExistingReceipt() {
        var event = SubmissionFinalizedEventParserTest.event();
        open(event);
        var other = new SubmissionFinalizedEvent(event.eventId(), event.occurredAt(), java.util.UUID.randomUUID(),
                event.learnerId(), event.submissionId(), event.assessmentId(), event.assessmentTitle(),
                event.finalScore(), event.maxScore(), event.courseId(), event.finalizedAt());
        assertThatThrownBy(() -> handler.handle(other)).isInstanceOf(InvalidEventException.class);
        assertThat(noticeCount(event)).isZero();
    }
}
