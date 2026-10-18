package com.learnup.identity.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.*;
import com.learnup.identity.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
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
            @AuthenticationPrincipal UUID userId) {
        authService.logout(request, userId);
        return ApiResponse.success(java.util.Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/change-password")
    public ApiResponse<java.util.Map<String, String>> changePassword(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ChangePasswordRequest request) {
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
            @AuthenticationPrincipal UUID userId) {
        return ApiResponse.success(authService.getCurrentUser(userId));
    }
}
