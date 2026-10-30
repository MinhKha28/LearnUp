package com.learnup.identity.dto.internal;

import com.learnup.common.security.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public class SetCredentialsRequest {

    @NotNull(message = "userId is required")
    private UUID userId;

    @NotBlank(message = "password cannot be blank")
    @Size(min = 6, message = "password must be at least 6 characters")
    private String password;

    @Size(max = 50, message = "username must be at most 50 characters")
    private String username;
    // Optional only for password replacement on an existing email-owning canonical user.
    @Email(message = "invalid email format")
    @Size(max = 100, message = "email must be at most 100 characters")
    private String email;
    private String fullName;
    private UserRole role;
    private UUID organizationId;

    public SetCredentialsRequest() {
    }

    public SetCredentialsRequest(UUID userId, String password) {
        this.userId = userId;
        this.password = password;
    }

    public SetCredentialsRequest(UUID userId, String password, String username, String email,
                                 String fullName, UserRole role, UUID organizationId) {
        this.userId = userId;
        this.password = password;
        this.username = username;
        setEmail(email);
        this.fullName = fullName;
        this.role = role;
        this.organizationId = organizationId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email == null ? null : email.trim();
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
    }
}
