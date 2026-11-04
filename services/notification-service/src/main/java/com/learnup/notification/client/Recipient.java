package com.learnup.notification.client;

import java.util.UUID;

/** A person this service writes to, as tenant-service describes them. */
public record Recipient(UUID id, String fullName, String email, String status) {

    /** A person who was deleted or deactivated is not written to. */
    public boolean canBeWrittenTo() {
        return !"Deleted".equalsIgnoreCase(status) && !"Deactivated".equalsIgnoreCase(status);
    }

    public boolean hasEmail() {
        return email != null && !email.isBlank();
    }
}
