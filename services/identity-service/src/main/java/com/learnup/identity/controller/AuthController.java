package com.learnup.identity.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.*;
import com.learnup.identity.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refresh(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/logout")
    public ApiResponse<java.util.Map<String, String>> logout(
            @RequestBody(required = false) LogoutRequest request,
            @RequestHeader(value = "X-User-ID", required = false) String headerUserId) {
        java.util.UUID userId = com.learnup.common.context.CurrentUser.getUserIdAsUuid();
        if (userId == null && headerUserId != null && !headerUserId.isBlank()) {
            try {
                userId = java.util.UUID.fromString(headerUserId.trim());
            } catch (IllegalArgumentException ignored) {
            }
        }
        authService.logout(request, userId);
        return ApiResponse.success(java.util.Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/change-password")
    public ApiResponse<java.util.Map<String, String>> changePassword(
            @RequestHeader(value = "X-User-ID", required = false) String headerUserId,
            @Valid @RequestBody ChangePasswordRequest request) {
        java.util.UUID userId = com.learnup.common.context.CurrentUser.getUserIdAsUuid();
        if (userId == null && headerUserId != null && !headerUserId.isBlank()) {
            try {
                userId = java.util.UUID.fromString(headerUserId.trim());
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (userId == null) {
            throw com.learnup.common.exception.BusinessException.unauthorized("Authentication required to change password");
        }
        authService.changePassword(userId, request);
        return ApiResponse.success(java.util.Map.of("message", "Password changed successfully"));
    }

    @PostMapping("/forgot-password")
    public ApiResponse<java.util.Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ApiResponse.success(java.util.Map.of("message", "If the email is registered, password reset instructions have been sent"));
    }

    @PostMapping("/reset-password")
    public ApiResponse<java.util.Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.success(java.util.Map.of("message", "Password has been successfully reset"));
    }

    @GetMapping("/me")
    public ApiResponse<com.learnup.identity.dto.UserResponse> getCurrentUser(
            @RequestHeader(value = "X-User-ID", required = false) String headerUserId) {
        java.util.UUID userId = com.learnup.common.context.CurrentUser.getUserIdAsUuid();
        if (userId == null && headerUserId != null && !headerUserId.isBlank()) {
            try {
                userId = java.util.UUID.fromString(headerUserId.trim());
            } catch (IllegalArgumentException ignored) {
                // Invalid UUID
            }
        }
        if (userId == null) {
            throw com.learnup.common.exception.BusinessException.unauthorized("Authentication required");
        }
        return ApiResponse.success(authService.getCurrentUser(userId));
    }
}
