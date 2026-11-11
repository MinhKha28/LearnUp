package com.learnup.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** UC06: end the session of this device; possession of its refresh token authorizes the revocation. */
public class RevokeSessionRequest {

    @NotBlank(message = "Refresh token is required")
    @Size(max = 512, message = "Refresh token is too long")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, description = "Refresh token of the session to end; never logged")
    private String refreshToken;

    public RevokeSessionRequest() {
    }

    public RevokeSessionRequest(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    @Override
    public String toString() {
        return "RevokeSessionRequest[refreshToken=<redacted>]";
    }
}
