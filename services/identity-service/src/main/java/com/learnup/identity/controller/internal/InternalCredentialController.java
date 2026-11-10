package com.learnup.identity.controller.internal;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.dto.internal.UpdateUserMetadataRequest;
import com.learnup.identity.service.AuthService;
import com.learnup.identity.service.UserMetadataService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Hidden;

@RestController
@Hidden
@RequestMapping("/api/internal/credentials")
public class InternalCredentialController {

    private final AuthService authService;
    private final UserMetadataService userMetadataService;

    public InternalCredentialController(AuthService authService, UserMetadataService userMetadataService) {
        this.authService = authService;
        this.userMetadataService = userMetadataService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<java.util.Map<String, String>> setCredentials(
            @Valid @RequestBody SetCredentialsRequest request) {
        // Authenticated as INTERNAL_SERVICE by Identity's security chain before controller dispatch.
        authService.setCredentials(request);
        return ApiResponse.success(java.util.Map.of("message", "Credentials successfully set"));
    }

    @PutMapping("/metadata")
    public ApiResponse<java.util.Map<String, String>> updateMetadata(
            @Valid @RequestBody UpdateUserMetadataRequest request) {
        userMetadataService.update(request);
        return ApiResponse.success(java.util.Map.of("message", "Identity metadata successfully updated"));
    }
}
