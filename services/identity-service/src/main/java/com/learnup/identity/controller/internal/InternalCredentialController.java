package com.learnup.identity.controller.internal;

import com.learnup.common.context.HeaderConstants;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.ApiResponse;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.service.AuthService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/credentials")
public class InternalCredentialController {

    private static final Logger log = LoggerFactory.getLogger(InternalCredentialController.class);

    private final AuthService authService;
    private final String expectedInternalKey;

    public InternalCredentialController(AuthService authService,
                                        @Value("${security.internal-key:learnup-internal-secret}") String expectedInternalKey) {
        this.authService = authService;
        this.expectedInternalKey = expectedInternalKey;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<java.util.Map<String, String>> setCredentials(
            @RequestHeader(value = HeaderConstants.X_INTERNAL_KEY, required = false) String internalKey,
            @Valid @RequestBody SetCredentialsRequest request) {

        if (internalKey == null || internalKey.isBlank() || !internalKey.trim().equals(expectedInternalKey.trim())) {
            log.warn("Unauthorized attempt to access /api/internal/credentials with key: '{}'", internalKey);
            throw BusinessException.forbidden("Invalid or missing internal key");
        }

        authService.setCredentials(request);
        return ApiResponse.success(java.util.Map.of("message", "Credentials successfully set"));
    }
}
