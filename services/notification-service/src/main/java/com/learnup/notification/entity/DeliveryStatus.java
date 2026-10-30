package com.learnup.notification.entity;

/**
 * Where one delivery of an enrollment event stands. SENT and SKIPPED are final; PENDING and FAILED are tried again.
 * PROCESSING means one handler has claimed the row and is working on it; the claim is retaken after the lease.
 */
public enum DeliveryStatus {
    PENDING,
    PROCESSING,
    SENT,
    FAILED,
    SKIPPED;

    public boolean isFinal() {
        return this == SENT || this == SKIPPED;
    }
}
