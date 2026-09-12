package com.learnup.common.context;

import com.learnup.common.auth.CurrentUser;

import java.util.Optional;

/**
 * ThreadLocal-based holder managing the authenticated {@link CurrentUser} for the active thread.
 */
public final class SecurityContextHolder {

    private static final ThreadLocal<CurrentUser> CURRENT_USER_HOLDER = new ThreadLocal<>();

    private SecurityContextHolder() {
        // Prevent instantiation
    }

    /**
     * Retrieves the active CurrentUser.
     */
    public static CurrentUser getCurrentUser() {
        return CURRENT_USER_HOLDER.get();
    }

    /**
     * Retrieves the active CurrentUser wrapped in an Optional.
     */
    public static Optional<CurrentUser> findCurrentUser() {
        return Optional.ofNullable(CURRENT_USER_HOLDER.get());
    }

    /**
     * Retrieves the active CurrentUser or throws an IllegalStateException if missing.
     */
    public static CurrentUser requireCurrentUser() {
        CurrentUser user = CURRENT_USER_HOLDER.get();
        if (user == null) {
            throw new IllegalStateException("Authentication context is required but no CurrentUser was found in the current thread.");
        }
        return user;
    }

    /**
     * Sets the active CurrentUser and synchronizes the TenantContext with the user's organizationId.
     */
    public static void setCurrentUser(CurrentUser user) {
        CURRENT_USER_HOLDER.set(user);
        if (user != null && user.getOrganizationId() != null) {
            TenantContext.setOrganizationId(user.getOrganizationId());
        }
    }

    /**
     * Backward compatibility adapter for legacy UserContext.
     */
    public static UserContext getContext() {
        CurrentUser u = CURRENT_USER_HOLDER.get();
        if (u == null) {
            return null;
        }
        return UserContext.builder()
                .userId(u.getUserId())
                .organizationId(u.getOrganizationId())
                .role(u.getRole())
                .correlationId(u.getCorrelationId())
                .build();
    }

    /**
     * Backward compatibility adapter setting UserContext.
     */
    public static void setContext(UserContext context) {
        if (context == null) {
            clear();
            return;
        }
        CurrentUser user = CurrentUser.builder()
                .userId(context.getUserId())
                .organizationId(context.getOrganizationId())
                .role(context.getRole())
                .correlationId(context.getCorrelationId())
                .build();
        setCurrentUser(user);
    }

    /**
     * Clears both the active CurrentUser and TenantContext.
     */
    public static void clear() {
        CURRENT_USER_HOLDER.remove();
        TenantContext.clear();
    }
}
