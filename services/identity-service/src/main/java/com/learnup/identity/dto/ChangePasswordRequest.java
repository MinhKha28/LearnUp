package com.learnup.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

public class ChangePasswordRequest {

    @NotBlank(message = "currentPassword is required")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, format = "password")
    private String currentPassword;

    @NotBlank(message = "newPassword is required")
    @Size(min = 6, message = "newPassword must be at least 6 characters")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, format = "password")
    private String newPassword;

    @NotBlank(message = "confirmPassword is required")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, format = "password")
    private String confirmPassword;

    public ChangePasswordRequest() {
    }

    public ChangePasswordRequest(String currentPassword, String newPassword, String confirmPassword) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
        this.confirmPassword = confirmPassword;
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
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
