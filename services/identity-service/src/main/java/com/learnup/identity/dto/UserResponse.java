package com.learnup.identity.dto;

import com.learnup.common.security.UserRole;
import com.learnup.identity.domain.User;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
public class UserResponse {

    private UUID id;
    private String username;
    private String email;
    private String fullName;
    private UserRole role;
    private UUID organizationId;
    private boolean enabled;
    private Instant createdAt;

    public UserResponse() {
    }

    public UserResponse(UUID id, String username, String email, String fullName, UserRole role, UUID organizationId, boolean enabled, Instant createdAt) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.fullName = fullName;
        this.role = role;
        this.organizationId = organizationId;
        this.enabled = enabled;
        this.createdAt = createdAt;
    }

    public static UserResponse fromUser(User user) {
        if (user == null) {
            return null;
        }
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getOrganizationId(),
                user.isEnabled(),
                user.getCreatedAt()
        );
    }

}
