package com.learnup.identity.controller;

import com.learnup.common.context.CurrentUser;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.UserResponse;
import com.learnup.identity.service.AuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> getCurrentUser(
            @RequestHeader(value = "X-User-ID", required = false) String headerUserId) {
        UUID userId = CurrentUser.getUserIdAsUuid();
        if (userId == null && headerUserId != null && !headerUserId.isBlank()) {
            try {
                userId = UUID.fromString(headerUserId.trim());
            } catch (IllegalArgumentException ignored) {
                // Invalid UUID format
            }
        }

        if (userId == null) {
            throw BusinessException.unauthorized("Authentication required to access current user profile");
        }

        UserResponse userResponse = authService.getCurrentUser(userId);
        return ApiResponse.success(userResponse);
    }
}
