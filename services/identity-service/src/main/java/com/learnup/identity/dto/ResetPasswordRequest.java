package com.learnup.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

public class ResetPasswordRequest {

    @NotBlank(message = "token is required")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, description = "Recovery token; no example value")
    private String token;

    @NotBlank(message = "newPassword is required")
    @Size(min = 6, message = "newPassword must be at least 6 characters")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, format = "password")
    private String newPassword;

    @NotBlank(message = "confirmPassword is required")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, format = "password")
    private String confirmPassword;

    public ResetPasswordRequest() {
    }

    public ResetPasswordRequest(String token, String newPassword, String confirmPassword) {
        this.token = token;
        this.newPassword = newPassword;
        this.confirmPassword = confirmPassword;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }
}
