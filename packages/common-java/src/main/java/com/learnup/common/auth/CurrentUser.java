package com.learnup.common.auth;

import com.learnup.common.constant.RoleConstants;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Objects;

/**
 * Immutable abstraction representing the currently authenticated user in the active request context.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurrentUser implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String organizationId;
    private String role;
    private String correlationId;

    /**
     * Checks if the current user has the specified platform role.
     *
     * @param targetRole The role name to check (e.g. ORGANIZER, ADMIN).
     * @return true if the user possesses the role (case-insensitive), false otherwise.
     */
    public boolean hasRole(String targetRole) {
        if (this.role == null || targetRole == null) {
            return false;
        }
        return this.role.equalsIgnoreCase(targetRole.trim());
    }

    /**
     * Checks if the current user is a platform administrator.
     */
    public boolean isAdmin() {
        return hasRole(RoleConstants.ADMIN);
    }

    /**
     * Checks if the current user is an organization administrator.
     */
    public boolean isOrganizer() {
        return hasRole(RoleConstants.ORGANIZER);
    }

    /**
     * Checks if the current user is an instructor.
     */
    public boolean isInstructor() {
        return hasRole(RoleConstants.INSTRUCTOR);
    }

    /**
     * Checks if the current user is a learner.
     */
    public boolean isLearner() {
        return hasRole(RoleConstants.LEARNER);
    }

    /**
     * Checks if the user belongs to a specific organization.
     *
     * @param targetOrgId The organization identifier to compare.
     * @return true if the user's organizationId equals targetOrgId.
     */
    public boolean belongsToOrganization(String targetOrgId) {
        if (this.organizationId == null || targetOrgId == null) {
            return false;
        }
        return Objects.equals(this.organizationId, targetOrgId);
    }
}
