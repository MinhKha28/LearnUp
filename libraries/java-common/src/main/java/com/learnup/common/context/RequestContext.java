package com.learnup.common.context;

import com.learnup.common.security.UserRole;

import java.util.Objects;
import java.util.UUID;

/**
 * Immutable request context holding authentication, tenant, and tracing metadata.
 */
public final class RequestContext {

    private final String userId;
    private final String organizationId;
    private final UserRole role;
    private final String correlationId;

    public RequestContext(String userId, String organizationId, UserRole role, String correlationId) {
        this.userId = userId;
        this.organizationId = organizationId;
        this.role = role;
        this.correlationId = correlationId;
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getUserId() {
        return userId;
    }

    public UUID getUserIdAsUuid() {
        return userId != null && !userId.isBlank() ? UUID.fromString(userId) : null;
    }

    public String getOrganizationId() {
        return organizationId;
    }

    public UUID getOrganizationIdAsUuid() {
        return organizationId != null && !organizationId.isBlank() ? UUID.fromString(organizationId) : null;
    }

    public UserRole getRole() {
        return role;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public boolean isAuthenticated() {
        return userId != null && !userId.isBlank();
    }

    public boolean hasRole(UserRole targetRole) {
        return this.role != null && this.role == targetRole;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RequestContext that = (RequestContext) o;
        return Objects.equals(userId, that.userId) &&
               Objects.equals(organizationId, that.organizationId) &&
               role == that.role &&
               Objects.equals(correlationId, that.correlationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, organizationId, role, correlationId);
    }

    @Override
    public String toString() {
        return "RequestContext{" +
               "userId='" + userId + '\'' +
               ", organizationId='" + organizationId + '\'' +
               ", role=" + role +
               ", correlationId='" + correlationId + '\'' +
               '}';
    }

    public static class Builder {
        private String userId;
        private String organizationId;
        private UserRole role;
        private String correlationId;

        public Builder userId(String userId) {
            this.userId = userId;
            return this;
        }

        public Builder organizationId(String organizationId) {
            this.organizationId = organizationId;
            return this;
        }

        public Builder role(UserRole role) {
            this.role = role;
            return this;
        }

        public Builder correlationId(String correlationId) {
            this.correlationId = correlationId;
            return this;
        }

        public RequestContext build() {
            return new RequestContext(userId, organizationId, role, correlationId);
        }
    }
}
