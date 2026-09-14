package com.learnup.common.context;

import com.learnup.common.security.UserRole;

import java.util.Optional;
import java.util.UUID;

/**
 * Thread-safe holder for the current request context.
 */
public final class RequestContextHolder {

    private static final ThreadLocal<RequestContext> CONTEXT_HOLDER = new ThreadLocal<>();

    private RequestContextHolder() {
        // Prevent instantiation
    }

    /**
     * Bind the given RequestContext to the current thread.
     *
     * @param context the context to associate
     */
    public static void set(RequestContext context) {
        if (context == null) {
            clear();
        } else {
            CONTEXT_HOLDER.set(context);
        }
    }

    /**
     * Retrieve the current RequestContext.
     *
     * @return the RequestContext bound to the current thread, or null if none
     */
    public static RequestContext get() {
        return CONTEXT_HOLDER.get();
    }

    /**
     * Retrieve the current RequestContext wrapped in an Optional.
     *
     * @return Optional containing current RequestContext, or empty
     */
    public static Optional<RequestContext> getOptional() {
        return Optional.ofNullable(CONTEXT_HOLDER.get());
    }

    /**
     * Retrieve the current authenticated user's ID as a String.
     *
     * @return userId or null
     */
    public static String getUserId() {
        RequestContext ctx = get();
        return ctx != null ? ctx.getUserId() : null;
    }

    /**
     * Retrieve the current authenticated user's ID as a UUID.
     *
     * @return userId as UUID or null
     */
    public static UUID getUserIdAsUuid() {
        RequestContext ctx = get();
        return ctx != null ? ctx.getUserIdAsUuid() : null;
    }

    /**
     * Retrieve the current organization ID as a String.
     *
     * @return organizationId or null
     */
    public static String getOrganizationId() {
        RequestContext ctx = get();
        return ctx != null ? ctx.getOrganizationId() : null;
    }

    /**
     * Retrieve the current organization ID as a UUID.
     *
     * @return organizationId as UUID or null
     */
    public static UUID getOrganizationIdAsUuid() {
        RequestContext ctx = get();
        return ctx != null ? ctx.getOrganizationIdAsUuid() : null;
    }

    /**
     * Retrieve the current user's role.
     *
     * @return UserRole or null
     */
    public static UserRole getRole() {
        RequestContext ctx = get();
        return ctx != null ? ctx.getRole() : null;
    }

    /**
     * Retrieve the current request's correlation ID.
     *
     * @return correlationId or null
     */
    public static String getCorrelationId() {
        RequestContext ctx = get();
        return ctx != null ? ctx.getCorrelationId() : null;
    }

    /**
     * Clear the request context for the current thread to prevent memory/context leaks.
     */
    public static void clear() {
        CONTEXT_HOLDER.remove();
    }
}
