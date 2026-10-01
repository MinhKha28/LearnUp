package com.learnup.identity.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.AuthResponse;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.RefreshTokenRequest;
import com.learnup.identity.dto.RegisterRequest;
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
