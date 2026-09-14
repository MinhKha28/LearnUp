package com.learnup.common.security;

import java.util.Arrays;
import java.util.Optional;

/**
 * Standard user roles across the LearnUP platform.
 * Exactly four roles are recognized: ADMIN, ORGANIZER, INSTRUCTOR, LEARNER.
 */
public enum UserRole {
    ADMIN,
    ORGANIZER,
    INSTRUCTOR,
    LEARNER;

    /**
     * Safely parse a role string from an HTTP header or token claim.
     *
     * @param roleStr the string representation of the role
     * @return the matched UserRole, or null if input is null or blank
     * @throws IllegalArgumentException if the provided string does not match any valid role
     */
    public static UserRole fromHeader(String roleStr) {
        if (roleStr == null || roleStr.isBlank()) {
            return null;
        }
        String normalized = roleStr.trim().toUpperCase();
        for (UserRole role : values()) {
            if (role.name().equals(normalized)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Invalid user role: '" + roleStr + "'. Allowed roles: " + Arrays.toString(values()));
    }

    /**
     * Check whether a given string corresponds to a valid UserRole.
     *
     * @param roleStr the string to validate
     * @return true if valid, false otherwise
     */
    public static boolean isValid(String roleStr) {
        if (roleStr == null || roleStr.isBlank()) {
            return false;
        }
        String normalized = roleStr.trim().toUpperCase();
        for (UserRole role : values()) {
            if (role.name().equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Try to parse a role string, returning an Optional.
     *
     * @param roleStr the string representation of the role
     * @return Optional containing the UserRole if valid, or empty Optional if invalid/null
     */
    public static Optional<UserRole> tryParse(String roleStr) {
        if (roleStr == null || roleStr.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(fromHeader(roleStr));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
