package com.learnup.notification.course;

import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CourseDeliveryLedgerIntegrationTest extends CourseDeliveryDatabaseTest {
    @Autowired CourseDeliveryLedger ledger;

    private static CourseDeliveryLedger.Obligation obligation(String channel) {
        return new CourseDeliveryLedger.Obligation(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                Instant.now().minusSeconds(60), UUID.randomUUID(), channel);
    }

    private void writeNotice(CourseDeliveryLedger.Obligation o) {
        notificationService.sendNotification(new CreateNotificationRequest(o.organizationId(), o.recipientUserId(),
                "Tiêu đề", "Nội dung", "COURSE_APPROVAL", "IN_APP", null));
    }

    private static void assertClaimLost(Runnable call) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(DependencyUnavailableException.class,
                e -> assertThat(e.code()).isEqualTo(CourseDeliveryLedger.CLAIM_LOST));
    }

    @ParameterizedTest
    @EnumSource(CourseDeliveryTable.class)
    void claimCarriesItsAttemptAndAFinishedObligationIsNotClaimedAgain(CourseDeliveryTable table) {
        var o = obligation("IN_APP");
        var claim = ledger.claim(table, o).orElseThrow();
        assertThat(claim.attempts()).isEqualTo(1);
        assertThat(claim.claimedAt()).isNotNull();

        ledger.deliverInApp(claim, () -> writeNotice(o));

        assertThat(status(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo("SENT");
        assertThat(notices(o.recipientUserId())).isEqualTo(1);
        assertThat(ledger.claim(table, o)).isEmpty();
        assertThat(attempts(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(CourseDeliveryTable.class)
    void anActiveClaimRejectsASecondConsumerWithTheTableCode(CourseDeliveryTable table) {
        var o = obligation("EMAIL");
        ledger.claim(table, o).orElseThrow();

        assertThatThrownBy(() -> ledger.claim(table, o)).isInstanceOfSatisfying(DependencyUnavailableException.class,
                e -> assertThat(e.code()).isEqualTo(table.claimedCode()));
    }

    @ParameterizedTest
    @EnumSource(CourseDeliveryTable.class)
    void aConsumerWhoseLeaseWasTakenOverCannotFinishOrFailTheNewClaim(CourseDeliveryTable table) {
        var o = obligation("IN_APP");
        var stale = ledger.claim(table, o).orElseThrow();
        expireClaim(table, o.eventId(), o.recipientUserId(), "IN_APP");
        var current = ledger.claim(table, o).orElseThrow();
        assertThat(current.attempts()).isEqualTo(2);

        assertClaimLost(() -> ledger.deliverInApp(stale, () -> writeNotice(o)));
        assertClaimLost(() -> ledger.requireOwned(stale));
        assertClaimLost(() -> ledger.sent(stale));
        assertClaimLost(() -> ledger.skipped(stale));
        ledger.failIfOwned(stale, "IN_APP_FAILED");

        assertThat(notices(o.recipientUserId())).isZero();
        assertThat(status(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo("PROCESSING");

        ledger.deliverInApp(current, () -> writeNotice(o));
        assertThat(status(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo("SENT");
        assertThat(notices(o.recipientUserId())).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(CourseDeliveryTable.class)
    void aFailureAfterTheNoticeRollsBackTheNoticeAndLeavesTheClaimToFail(CourseDeliveryTable table) {
        var o = obligation("IN_APP");
        var claim = ledger.claim(table, o).orElseThrow();

        assertThatThrownBy(() -> ledger.deliverInApp(claim, () -> {
            writeNotice(o);
            throw new IllegalStateException("TEST_AFTER_NOTICE");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(notices(o.recipientUserId())).isZero();
        assertThat(status(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo("PROCESSING");
        ledger.failIfOwned(claim, "IN_APP_FAILED");
        assertThat(status(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo("FAILED");
    }

    /**
     * The in-app transaction locks the row before writing. A consumer that sees the claim as abandoned
     * must wait for that transaction, then find SENT instead of delivering a second notice.
     */
    @ParameterizedTest
    @EnumSource(CourseDeliveryTable.class)
    void aTakeoverWaitsForTheDeliveringTransactionAndThenSeesSent(CourseDeliveryTable table) throws Exception {
        var o = obligation("IN_APP");
        ledger.claim(table, o).orElseThrow();
        expireClaim(table, o.eventId(), o.recipientUserId(), "IN_APP");
        OffsetDateTime claimedAt = jdbc.queryForObject("SELECT claimed_at FROM " + table.tableName()
                + " WHERE event_id = ? AND recipient_user_id = ? AND channel = 'IN_APP'",
                OffsetDateTime.class, o.eventId(), o.recipientUserId());
        UUID id = jdbc.queryForObject("SELECT id FROM " + table.tableName()
                + " WHERE event_id = ? AND recipient_user_id = ? AND channel = 'IN_APP'",
                UUID.class, o.eventId(), o.recipientUserId());
        var slowOwner = new CourseDeliveryLedger.Claim(table, id, 1, claimedAt);

        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CompletableFuture<Void> delivering = CompletableFuture.runAsync(() -> ledger.deliverInApp(slowOwner, () -> {
            locked.countDown();
            await(release);
            writeNotice(o);
        }));
        assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();

        CompletableFuture<Optional<CourseDeliveryLedger.Claim>> takeover =
                CompletableFuture.supplyAsync(() -> ledger.claim(table, o));
        Thread.sleep(500);
        assertThat(takeover).isNotDone();

        release.countDown();
        delivering.get(10, TimeUnit.SECONDS);
        assertThat(takeover.get(10, TimeUnit.SECONDS)).isEmpty();
        assertThat(notices(o.recipientUserId())).isEqualTo(1);
        assertThat(status(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo("SENT");
        assertThat(attempts(table, o.eventId(), o.recipientUserId(), "IN_APP")).isEqualTo(1);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("TEST_RELEASE_TIMEOUT");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
