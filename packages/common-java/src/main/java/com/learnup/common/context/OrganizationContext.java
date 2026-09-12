package com.learnup.common.context;

/**
 * Convenience alias delegating to {@link TenantContext} for organizationId tenant scoping.
 */
public final class OrganizationContext {

    private OrganizationContext() {
        // Prevent instantiation
    }

    public static String getOrganizationId() {
        return TenantContext.getOrganizationId();
    }

    public static void setOrganizationId(String organizationId) {
        TenantContext.setOrganizationId(organizationId);
    }

    public static String requireOrganizationId() {
        return TenantContext.requireOrganizationId();
    }

    public static boolean isSet() {
        return TenantContext.isSet();
    }

    public static void clear() {
        TenantContext.clear();
    }
}
