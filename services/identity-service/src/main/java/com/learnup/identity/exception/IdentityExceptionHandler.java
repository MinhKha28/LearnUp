package com.learnup.identity.exception;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.exception.GlobalExceptionHandler;
import com.learnup.common.response.ApiResponse;
import com.learnup.identity.security.AuthenticationDiagnostics;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

/** Overrides unsafe shared diagnostics only for Identity; specialized sign-in advice retains priority. */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class IdentityExceptionHandler extends GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(IdentityExceptionHandler.class);

    @ExceptionHandler(CredentialProvisioningConflictException.class)
    public ResponseEntity<ApiResponse<Void>> handleProvisioningConflict(CredentialProvisioningConflictException ex) {
        log.warn("event=credential_provisioning_rejected reason={} correlation_id={}",
                ex.getCode(), AuthenticationDiagnostics.correlationId());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ex.getCode(), ex.getMessage()));
    }

    @Override
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        log.warn("event=request_rejected reason={} correlation_id={}", ex.getErrorCode(), AuthenticationDiagnostics.correlationId());
        // Business messages/details in Identity are application-defined, not raw exception causes or request bodies.
        return ResponseEntity.status(ex.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(ex.getErrorCode().name(), ex.getMessage(), ex.getDetails()));
    }

    @Override
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        return validationFailure("Request validation failed", ex.getBindingResult().getFieldErrors());
    }

    @Override
    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiResponse<Void>> handleBindException(BindException ex) {
        return validationFailure("Request binding validation failed", ex.getBindingResult().getFieldErrors());
    }

    private ResponseEntity<ApiResponse<Void>> validationFailure(String message, List<FieldError> errors) {
        log.warn("event=request_rejected reason=VALIDATION_ERROR field_error_count={} correlation_id={}",
                errors.size(), AuthenticationDiagnostics.correlationId());
        List<String> details = errors.stream().map(error -> error.getField() + ": "
                + (error.isBindingFailure() ? "invalid value" : error.getDefaultMessage())).toList();
        return ResponseEntity.badRequest().body(ApiResponse.error("VALIDATION_ERROR", message, details));
    }

    @Override
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        log.warn("event=request_rejected reason=VALIDATION_ERROR correlation_id={}", AuthenticationDiagnostics.correlationId());
        return ResponseEntity.badRequest().body(ApiResponse.error("VALIDATION_ERROR", "Constraint validation failed"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableRequest(HttpMessageNotReadableException ex) {
        log.warn("event=request_rejected reason=UNREADABLE_REQUEST correlation_id={}", AuthenticationDiagnostics.correlationId());
        return ResponseEntity.badRequest().body(ApiResponse.error("BAD_REQUEST", "Request body is missing or invalid"));
    }

    @Override
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(RuntimeException ex) {
        log.warn("event=request_rejected reason=INVALID_REQUEST exception_type={} correlation_id={}",
                AuthenticationDiagnostics.exceptionType(ex), AuthenticationDiagnostics.correlationId());
        return ResponseEntity.badRequest().body(ApiResponse.error("BAD_REQUEST", "Invalid request"));
    }

    @Override
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException ex) {
        log.warn("event=request_rejected reason=RESOURCE_NOT_FOUND correlation_id={}", AuthenticationDiagnostics.correlationId());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("RESOURCE_NOT_FOUND", "The requested resource was not found"));
    }

    @Override
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        log.warn("event=request_rejected reason=METHOD_NOT_ALLOWED correlation_id={}", AuthenticationDiagnostics.correlationId());
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error("BAD_REQUEST", "HTTP method not supported"));
    }

    @Override
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        // Exception messages/causes may contain JSON bodies, DB row contents, keys or tokens.
        // Retain ERROR severity, type, source location and correlation without rendering the Throwable.
        log.error("event=request_failed reason=INTERNAL_ERROR exception_type={} cause_type={} location={} correlation_id={}",
                AuthenticationDiagnostics.exceptionType(ex), AuthenticationDiagnostics.exceptionType(ex.getCause()),
                AuthenticationDiagnostics.location(ex), AuthenticationDiagnostics.correlationId());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.error("INTERNAL_ERROR",
                "An unexpected internal error occurred. Please contact support."));
    }
}
