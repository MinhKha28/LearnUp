package com.learnup.identity.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.UserResponse;
import com.learnup.identity.service.AuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/users", "/api/users"})
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> getCurrentUser(
            @AuthenticationPrincipal UUID userId) {
        UserResponse userResponse = authService.getCurrentUser(userId);
        return ApiResponse.success(userResponse);
    }
}
