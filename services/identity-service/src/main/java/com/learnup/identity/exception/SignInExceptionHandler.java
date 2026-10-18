package com.learnup.identity.exception;

import com.learnup.common.response.ApiResponse;
import com.learnup.identity.security.AuthenticationDiagnostics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SignInExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(SignInExceptionHandler.class);

    @ExceptionHandler(SignInDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleSignInDenied(SignInDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getReason(), ex.getMessage()));
    }

    @ExceptionHandler(RefreshTokenReusedException.class)
    public ResponseEntity<ApiResponse<Void>> handleRefreshTokenReused(RefreshTokenReusedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("REFRESH_TOKEN_REUSED", ex.getMessage()));
    }

    @ExceptionHandler(TooManyAttemptsException.class)
    public ResponseEntity<ApiResponse<Void>> handleTooManyAttempts(TooManyAttemptsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
                .body(ApiResponse.error("TOO_MANY_ATTEMPTS", ex.getMessage()));
    }

    @ExceptionHandler(TenantUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleTenantUnavailable(TenantUnavailableException ex) {
        log.error("event=tenant_access_check_failed reason=TENANT_UNAVAILABLE exception_type={} location={} correlation_id={}",
                AuthenticationDiagnostics.exceptionType(ex.getCause()), AuthenticationDiagnostics.location(ex.getCause()),
                AuthenticationDiagnostics.correlationId());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.error("TENANT_UNAVAILABLE", ex.getMessage()));
    }
}
