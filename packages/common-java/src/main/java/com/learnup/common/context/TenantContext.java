package com.learnup.common.context;

import java.util.Objects;
import java.util.function.Supplier;

/**
 * ThreadLocal-based holder for the active multi-tenant organization context (organizationId).
 */
public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
        // Prevent instantiation
    }

    /**
     * Gets the currently active organizationId.
     *
     * @return organizationId string or null if not set
     */
    public static String getOrganizationId() {
        return CURRENT_TENANT.get();
    }

    /**
     * Sets the active organizationId for the current thread execution.
     *
     * @param organizationId Standardized tenant identifier
     */
    public static void setOrganizationId(String organizationId) {
        CURRENT_TENANT.set(organizationId);
    }

    /**
     * Retrieves the active organizationId or throws an IllegalStateException if missing.
     *
     * @return non-null organizationId string
     */
    public static String requireOrganizationId() {
        String orgId = CURRENT_TENANT.get();
        if (orgId == null || orgId.trim().isEmpty()) {
            throw new IllegalStateException("TenantContext organizationId is required but was not present in the current execution context.");
        }
        return orgId;
    }

    /**
     * Checks if an active tenant organizationId is present.
     */
    public static boolean isSet() {
        String orgId = CURRENT_TENANT.get();
        return orgId != null && !orgId.trim().isEmpty();
    }

    /**
     * Clears the active tenant context for the current thread.
     */
    public static void clear() {
        CURRENT_TENANT.remove();
    }

    /**
     * Executes a supplier function within an explicitly scoped tenant context, restoring the previous context upon completion.
     */
    public static <T> T runWithTenant(String organizationId, Supplier<T> supplier) {
        Objects.requireNonNull(supplier, "Supplier must not be null");
        String previousTenant = CURRENT_TENANT.get();
        try {
            CURRENT_TENANT.set(organizationId);
            return supplier.get();
        } finally {
            if (previousTenant != null) {
                CURRENT_TENANT.set(previousTenant);
            } else {
                CURRENT_TENANT.remove();
            }
        }
    }

    /**
     * Executes a runnable task within an explicitly scoped tenant context, restoring the previous context upon completion.
     */
    public static void runWithTenant(String organizationId, Runnable runnable) {
        Objects.requireNonNull(runnable, "Runnable must not be null");
        runWithTenant(organizationId, () -> {
            runnable.run();
            return null;
        });
    }
}
