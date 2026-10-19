package com.learnup.identity.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.*;
import com.learnup.identity.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import com.learnup.identity.config.OpenApiConfig;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/v1/auth", "/api/auth"})
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "Sign in with existing credentials", tags = "Authentication",
            description = "Validates credentials and Tenant access before issuing the existing token response contract.")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate a refresh token", tags = "Sessions",
            description = "Validates refresh state and Tenant access. Reusing a rotated token revokes its family.")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refresh(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "End a session or all own sessions", tags = "Sessions",
            description = "Requires an unexpired access JWT through Gateway; logoutAll targets only its verified subject.")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    public ApiResponse<java.util.Map<String, String>> logout(
            @RequestBody(required = false) LogoutRequest request,
            @AuthenticationPrincipal UUID userId) {
        authService.logout(request, userId);
        return ApiResponse.success(java.util.Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change own password", tags = "Passwords", description = "Verifies the current password first.")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    public ApiResponse<java.util.Map<String, String>> changePassword(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(userId, request);
        return ApiResponse.success(java.util.Map.of("message", "Password changed successfully"));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password recovery", tags = "Passwords",
            description = "Returns a neutral response. Eligible recovery delivery is queued only after token commit; never returns a recovery token.")
    public ApiResponse<java.util.Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ApiResponse.success(java.util.Map.of("message", "If the email is registered, password reset instructions have been sent"));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password using a recovery token", tags = "Passwords")
    public ApiResponse<java.util.Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.success(java.util.Map.of("message", "Password has been successfully reset"));
    }

    @GetMapping("/me")
    @Operation(summary = "Read own credential profile", tags = "Authentication",
            description = "Identity projection, not the canonical Tenant-managed profile.")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    public ApiResponse<com.learnup.identity.dto.UserResponse> getCurrentUser(
            @AuthenticationPrincipal UUID userId) {
        return ApiResponse.success(authService.getCurrentUser(userId));
    }
}
