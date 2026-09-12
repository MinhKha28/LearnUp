package com.learnup.common.context;

/**
 * ThreadLocal-based holder for the active tenant organization context.
 */
public final class OrganizationContext {

    private static final ThreadLocal<String> CURRENT_ORG_ID = new ThreadLocal<>();

    private OrganizationContext() {
        // Prevent instantiation
    }

    public static String getOrganizationId() {
        return CURRENT_ORG_ID.get();
    }

    public static void setOrganizationId(String organizationId) {
        CURRENT_ORG_ID.set(organizationId);
    }

    public static void clear() {
        CURRENT_ORG_ID.remove();
    }
}
