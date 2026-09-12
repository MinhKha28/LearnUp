package com.learnup.common.context;

/**
 * ThreadLocal-based holder for the complete UserContext.
 */
public final class SecurityContextHolder {

    private static final ThreadLocal<UserContext> CONTEXT_HOLDER = new ThreadLocal<>();

    private SecurityContextHolder() {
        // Prevent instantiation
    }

    public static UserContext getContext() {
        return CONTEXT_HOLDER.get();
    }

    public static void setContext(UserContext context) {
        CONTEXT_HOLDER.set(context);
        if (context != null && context.getOrganizationId() != null) {
            OrganizationContext.setOrganizationId(context.getOrganizationId());
        }
    }

    public static void clear() {
        CONTEXT_HOLDER.remove();
        OrganizationContext.clear();
    }
}
