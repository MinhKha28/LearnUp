package com.learnup.notification.entity;

/** Where one delivery of an enrollment event stands. SENT and SKIPPED are final; PENDING and FAILED are tried again. */
public enum DeliveryStatus {
    PENDING,
    SENT,
    FAILED,
    SKIPPED;

    public boolean isFinal() {
        return this == SENT || this == SKIPPED;
    }
}
