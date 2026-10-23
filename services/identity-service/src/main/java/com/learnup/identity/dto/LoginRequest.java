package com.learnup.identity.dto;

import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

public class LoginRequest {

    @NotBlank(message = "Username or email is required")
    @Schema(description = "Registered email; the legacy username wire field and username lookup remain supported")
    private String username;

    @NotBlank(message = "Password is required")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY, format = "password", description = "Current password; no example value")
    private String password;

    public LoginRequest() {
    }

    public LoginRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
