package com.learnup.common.constant;

import java.util.Set;

/**
 * Standardized canonical platform roles for LearnUP.
 */
public final class RoleConstants {

    private RoleConstants() {
        // Prevent instantiation
    }

    /**
     * Platform Super-Administrator with cross-organization system privileges.
     */
    public static final String ADMIN = "ADMIN";

    /**
     * Enterprise Organization Administrator managing seats, employees, and licenses.
     */
    public static final String ORGANIZER = "ORGANIZER";

    /**
     * Educator/Instructor creating curriculum and grading student assessments.
     */
    public static final String INSTRUCTOR = "INSTRUCTOR";

    /**
     * End-user Learner consuming courses and earning certificates.
     */
    public static final String LEARNER = "LEARNER";

    /**
     * Immutable set of all allowed platform roles.
     */
    public static final Set<String> ALLOWED_ROLES = Set.of(
            ADMIN,
            ORGANIZER,
            INSTRUCTOR,
            LEARNER
    );

    /**
     * Validates if a given role string is a canonical platform role.
     */
    public static boolean isValidRole(String role) {
        return role != null && ALLOWED_ROLES.contains(role.toUpperCase());
    }
}
