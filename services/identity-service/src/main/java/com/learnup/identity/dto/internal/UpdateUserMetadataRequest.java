package com.learnup.identity.dto.internal;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnup.common.security.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Complete canonical metadata snapshot, not a credential or account-lifecycle request. */
public record UpdateUserMetadataRequest(
        @NotNull UUID userId,
        @NotBlank @Email @Size(max = 100) String email,
        @NotNull UserRole role,
        @Size(max = 100) String fullName,
        UUID organizationId) {

    @JsonAnySetter
    public void rejectUnexpectedField(String field, Object value) {
        // Do not echo unknown names/values: an accidental credential must not enter diagnostics.
        throw new IllegalArgumentException("Unsupported metadata field");
    }
}
