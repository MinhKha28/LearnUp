package com.learnup.common.context;

import java.util.Optional;
import java.util.UUID;

/**
 * Technical context accessor for multi-tenant organization identification.
 */
public final class OrganizationContext {

    private OrganizationContext() {
        // Prevent instantiation
    }

    /**
     * Retrieve the current organization ID as a String.
     *
     * @return organization ID or null
     */
    public static String getOrganizationId() {
        return RequestContextHolder.getOrganizationId();
    }

    /**
     * Retrieve the current organization ID as a UUID.
     *
     * @return organization ID as UUID or null
     */
    public static UUID getOrganizationIdAsUuid() {
        return RequestContextHolder.getOrganizationIdAsUuid();
    }

    /**
     * Retrieve the current organization ID wrapped in an Optional.
     *
     * @return Optional of organization ID
     */
    public static Optional<String> getOrganizationIdOptional() {
        return Optional.ofNullable(RequestContextHolder.getOrganizationId());
    }

    /**
     * Check whether an organization context is currently present.
     *
     * @return true if present and non-blank, false otherwise
     */
    public static boolean hasOrganization() {
        String orgId = RequestContextHolder.getOrganizationId();
        return orgId != null && !orgId.isBlank();
    }

    /**
     * Helper to set or update organizationId on the current RequestContext.
     *
     * @param organizationId the organization ID to set
     */
    public static void setOrganizationId(String organizationId) {
        RequestContext current = RequestContextHolder.get();
        if (current != null) {
            RequestContext updated = RequestContext.builder()
                    .userId(current.getUserId())
                    .organizationId(organizationId)
                    .role(current.getRole())
                    .correlationId(current.getCorrelationId())
                    .build();
            RequestContextHolder.set(updated);
        } else {
            RequestContext ctx = RequestContext.builder()
                    .organizationId(organizationId)
                    .build();
            RequestContextHolder.set(ctx);
        }
    }

    /**
     * Clear current request context.
     */
    public static void clear() {
        RequestContextHolder.clear();
    }
}
