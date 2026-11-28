package com.learnup.notification.course;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** A mocked ledger whose in-app delivery runs the notice write, as the real transaction does. */
final class CourseLedgerMocks {
    private CourseLedgerMocks() {
    }

    static CourseDeliveryLedger ledger() {
        CourseDeliveryLedger ledger = mock(CourseDeliveryLedger.class);
        doAnswer(invocation -> {
            invocation.<Runnable>getArgument(1).run();
            return null;
        }).when(ledger).deliverInApp(any(), any());
        return ledger;
    }

    static CourseDeliveryLedger.Claim claim(CourseDeliveryTable table, String channel) {
        return new CourseDeliveryLedger.Claim(table,
                UUID.nameUUIDFromBytes((table + channel).getBytes(StandardCharsets.UTF_8)), 1,
                OffsetDateTime.parse("2026-11-27T00:00:00Z"));
    }

    static CourseDeliveryLedger.Obligation obligation(UUID eventId, UUID recipient, String channel) {
        return argThat(o -> o != null && eventId.equals(o.eventId())
                && recipient.equals(o.recipientUserId()) && channel.equals(o.channel()));
    }

    /** Each entry answers one claim: true opens the channel, false finds it already finished. */
    static void claims(CourseDeliveryLedger ledger, CourseDeliveryTable table, UUID eventId, UUID recipient,
                       String channel, boolean first, boolean... later) {
        Optional<CourseDeliveryLedger.Claim> open = Optional.of(claim(table, channel));
        Optional<CourseDeliveryLedger.Claim> firstAnswer = first ? open : Optional.empty();
        @SuppressWarnings("unchecked")
        Optional<CourseDeliveryLedger.Claim>[] rest = new Optional[later.length];
        for (int i = 0; i < later.length; i++) rest[i] = later[i] ? open : Optional.empty();
        when(ledger.claim(eq(table), obligation(eventId, recipient, channel))).thenReturn(firstAnswer, rest);
    }
}
