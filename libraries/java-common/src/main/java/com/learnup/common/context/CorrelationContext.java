package com.learnup.common.context;

import java.util.Optional;

/**
 * Accessor for the active request's correlation ID used for end-to-end distributed tracing.
 */
public final class CorrelationContext {

    private CorrelationContext() {
        // Prevent instantiation
    }

    /**
     * Retrieve the active correlation ID.
     *
     * @return correlation ID string, or null if unset
     */
    public static String getCorrelationId() {
        return RequestContextHolder.getCorrelationId();
    }

    /**
     * Retrieve the active correlation ID wrapped in an Optional.
     *
     * @return Optional containing correlation ID
     */
    public static Optional<String> getCorrelationIdOptional() {
        return Optional.ofNullable(RequestContextHolder.getCorrelationId());
    }

    /**
     * Helper to set or update correlationId on the current RequestContext.
     *
     * @param correlationId the correlation ID to set
     */
    public static void setCorrelationId(String correlationId) {
        RequestContext current = RequestContextHolder.get();
        if (current != null) {
            RequestContext updated = RequestContext.builder()
                    .userId(current.getUserId())
                    .organizationId(current.getOrganizationId())
                    .role(current.getRole())
                    .correlationId(correlationId)
                    .build();
            RequestContextHolder.set(updated);
        } else {
            RequestContext ctx = RequestContext.builder()
                    .correlationId(correlationId)
                    .build();
            RequestContextHolder.set(ctx);
        }
    }

    /**
     * Clear the context.
     */
    public static void clear() {
        RequestContextHolder.clear();
    }
}
