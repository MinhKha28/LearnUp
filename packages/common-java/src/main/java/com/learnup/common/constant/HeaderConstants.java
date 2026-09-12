package com.learnup.common.constant;

/**
 * Standardized HTTP headers used across the LearnUP platform.
 */
public final class HeaderConstants {

    private HeaderConstants() {
        // Prevent instantiation
    }

    /**
     * Subject/User identifier derived from trusted JWT claims by the API Gateway.
     */
    public static final String X_USER_ID = "X-User-ID";

    /**
     * Standardized tenant organization identifier derived from trusted JWT claims by the API Gateway.
     */
    public static final String X_ORGANIZATION_ID = "X-Organization-ID";

    /**
     * Request correlation identifier propagated across HTTP requests and Kafka events.
     */
    public static final String X_CORRELATION_ID = "X-Correlation-ID";

    /**
     * Standard Bearer Authorization header.
     */
    public static final String AUTHORIZATION = "Authorization";

    /**
     * Bearer token prefix.
     */
    public static final String BEARER_PREFIX = "Bearer ";
}
