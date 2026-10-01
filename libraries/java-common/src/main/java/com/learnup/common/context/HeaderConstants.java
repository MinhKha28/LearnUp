package com.learnup.common.context;

/**
 * Standard HTTP header names used across the LearnUP platform for trusted context propagation.
 */
public final class HeaderConstants {

    public static final String X_INTERNAL_KEY = "x-internal-key";
    public static final String X_USER_ID = "X-User-ID";
    public static final String X_ORGANIZATION_ID = "X-Organization-ID";
    public static final String X_USER_ROLE = "X-User-Role";
    public static final String X_CORRELATION_ID = "X-Correlation-ID";

    private HeaderConstants() {
        // Prevent instantiation
    }
}
