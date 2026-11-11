package com.learnup.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** UC05.1: the Google ID token returned to the browser by Google Identity Services. */
public record GoogleLoginRequest(
        @Schema(description = "Google ID token (GIS credential); never logged or stored", accessMode = Schema.AccessMode.WRITE_ONLY)
        @NotBlank
        @Size(max = 4096)
        String credential) {

    @Override
    public String toString() {
        return "GoogleLoginRequest[credential=<redacted>]";
    }
}
