package com.learnup.notification.entity;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EnrollmentEventDeliveryTest {

    private static final Instant T0 = Instant.parse("2026-10-27T01:00:00Z");
    private static final Instant T1 = Instant.parse("2026-10-27T01:00:05Z");

    private EnrollmentEventDelivery delivery() {
        return new EnrollmentEventDelivery(UUID.randomUUID(), "EnrollmentAssigned", UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), DeliveryChannel.EMAIL, T0, T0);
    }

    @Test
    void aNewDeliveryIsPendingWithNoAttempt() {
        EnrollmentEventDelivery delivery = delivery();
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.getAttempts()).isZero();
        assertThat(delivery.getLastError()).isNull();
        assertThat(delivery.getSentAt()).isNull();
    }

    @Test
    void aFailureKeepsOnlyTheCodeAndALaterSuccessClearsIt() {
        EnrollmentEventDelivery delivery = delivery();
        delivery.startAttempt(T0);
        delivery.markFailed("TENANT_UNAVAILABLE", T0);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getLastError()).isEqualTo("TENANT_UNAVAILABLE");
        assertThat(delivery.getAttempts()).isEqualTo(1);

        delivery.startAttempt(T1);
        delivery.markSent(T1);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(delivery.getLastError()).isNull();
        assertThat(delivery.getSentAt()).isEqualTo(T1);
        assertThat(delivery.getAttempts()).isEqualTo(2);
    }

    @Test
    void onlySentAndSkippedAreFinal() {
        assertThat(DeliveryStatus.SENT.isFinal()).isTrue();
        assertThat(DeliveryStatus.SKIPPED.isFinal()).isTrue();
        assertThat(DeliveryStatus.PENDING.isFinal()).isFalse();
        assertThat(DeliveryStatus.FAILED.isFinal()).isFalse();
    }

    @Test
    void skippingRecordsTheReason() {
        EnrollmentEventDelivery delivery = delivery();
        delivery.markSkipped("EVENT_TOO_OLD", T1);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.SKIPPED);
        assertThat(delivery.getLastError()).isEqualTo("EVENT_TOO_OLD");
    }
}
