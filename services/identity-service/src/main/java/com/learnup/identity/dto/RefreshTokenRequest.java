package com.learnup.identity.dto;

import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

public class RefreshTokenRequest {

    @NotBlank(message = "Refresh token is required")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, description = "Refresh token from a previous successful sign-in/rotation")
    private String refreshToken;

    public RefreshTokenRequest() {
    }

    public RefreshTokenRequest(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }
}
