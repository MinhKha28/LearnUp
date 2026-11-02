package com.learnup.notification.enrollment;

import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.EnrollmentEventDelivery;

import java.time.Instant;
import java.util.UUID;

/** The history of what was sent for which event: one row for each event, person and channel. */
public interface DeliveryLedger {

    /**
     * The row of this event, person and channel: the one that exists, or a new PENDING one. Two callers at the same
     * moment get the same row.
     */
    EnrollmentEventDelivery open(EnrollmentEvent event, UUID recipientUserId, DeliveryChannel channel, Instant now);

    /**
     * Takes the row for the caller before anything is sent. True: the caller owns it (status PROCESSING, one more
     * attempt) and must leave it SENT, SKIPPED or FAILED. False: another handler holds it, or it is already final; the
     * caller sends nothing. A claim older than the lease is taken over, so a handler that died does not block the row.
     */
    boolean claim(EnrollmentEventDelivery delivery, Instant now);

    /** Stores the new state of a row. */
    void record(EnrollmentEventDelivery delivery);
}
