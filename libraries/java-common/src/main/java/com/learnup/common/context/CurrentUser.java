package com.learnup.common.context;

import com.learnup.common.security.UserRole;

import java.util.Optional;
import java.util.UUID;

/**
 * Static accessor for retrieving the current authenticated user identity and role from the active request context.
 */
public final class CurrentUser {

    private CurrentUser() {
        // Prevent instantiation
    }

    /**
     * Get the authenticated user ID as a String.
     *
     * @return user ID or null if unauthenticated
     */
    public static String getUserId() {
        return RequestContextHolder.getUserId();
    }

    /**
     * Get the authenticated user ID as a UUID.
     *
     * @return user ID as UUID or null if unauthenticated
     */
    public static UUID getUserIdAsUuid() {
        return RequestContextHolder.getUserIdAsUuid();
    }

    /**
     * Get the authenticated user's role.
     *
     * @return UserRole or null
     */
    public static UserRole getRole() {
        return RequestContextHolder.getRole();
    }

    /**
     * Get the authenticated user's role wrapped in an Optional.
     *
     * @return Optional of UserRole
     */
    public static Optional<UserRole> getRoleOptional() {
        return Optional.ofNullable(RequestContextHolder.getRole());
    }

    /**
     * Get the organization ID associated with the current user.
     *
     * @return organization ID as String or null
     */
    public static String getOrganizationId() {
        return RequestContextHolder.getOrganizationId();
    }

    /**
     * Get the organization ID associated with the current user as UUID.
     *
     * @return organization ID as UUID or null
     */
    public static UUID getOrganizationIdAsUuid() {
        return RequestContextHolder.getOrganizationIdAsUuid();
    }

    /**
     * Check if a valid user is currently authenticated in the request context.
     *
     * @return true if authenticated, false otherwise
     */
    public static boolean isAuthenticated() {
        RequestContext ctx = RequestContextHolder.get();
        return ctx != null && ctx.isAuthenticated();
    }

    /**
     * Check if the current user has the specified role.
     *
     * @param targetRole the role to check
     * @return true if role matches, false otherwise
     */
    public static boolean hasRole(UserRole targetRole) {
        RequestContext ctx = RequestContextHolder.get();
        return ctx != null && ctx.hasRole(targetRole);
    }
}
