package com.learnup.template.exception;

import com.learnup.common.api.ApiError;
import com.learnup.common.api.ApiResponse;
import com.learnup.common.constant.HeaderConstants;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Global Exception Handler transforming all exceptions into standard LearnUP ApiResponse/ApiError format.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationExceptions(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String correlationId = request.getHeader(HeaderConstants.X_CORRELATION_ID);

        List<ApiError.ErrorDetail> details = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> ApiError.ErrorDetail.builder()
                        .field(error.getField())
                        .issue(error.getDefaultMessage())
                        .build())
                .collect(Collectors.toList());

        ApiError error = ApiError.builder()
                .code("INVALID_INPUT")
                .message("Request payload validation failed.")
                .details(details)
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex, HttpServletRequest request) {
        String correlationId = request.getHeader(HeaderConstants.X_CORRELATION_ID);
        log.error("Unhandled exception occurred [correlationId: {}]: ", correlationId, ex);

        ApiError error = ApiError.builder()
                .code("INTERNAL_ERROR")
                .message("An unexpected internal platform error occurred.")
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.failure(error));
    }
}
