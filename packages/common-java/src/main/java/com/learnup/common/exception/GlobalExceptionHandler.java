package com.learnup.common.exception;

import com.learnup.common.api.ApiError;
import com.learnup.common.api.ApiResponse;
import com.learnup.common.constant.ErrorCode;
import com.learnup.common.constant.HeaderConstants;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;

/**
 * Platform Global Exception Handler transforming all exceptions into standard LearnUP {@link ApiResponse} format.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ApiResponse<Void>> handleBaseException(BaseException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        log.warn("Platform exception occurred [{}]: {} (Correlation: {})",
                ex.getErrorCode(), ex.getMessage(), correlationId);

        ApiError error = ApiError.builder()
                .code(ex.getErrorCode())
                .message(ex.getMessage())
                .details(ex.getDetails())
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(ex.getHttpStatus()).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        List<ApiError.ErrorDetail> details = new ArrayList<>();

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            details.add(ApiError.ErrorDetail.builder()
                    .field(fieldError.getField())
                    .issue(fieldError.getDefaultMessage())
                    .build());
        }

        ApiError error = ApiError.builder()
                .code(ErrorCode.INVALID_INPUT)
                .message("Request validation failed.")
                .details(details)
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        log.warn("Malformed JSON request received: {} (Correlation: {})", ex.getMessage(), correlationId);

        ApiError error = ApiError.builder()
                .code(ErrorCode.INVALID_INPUT)
                .message("Malformed JSON request payload.")
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParameter(MissingServletRequestParameterException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);

        ApiError.ErrorDetail detail = ApiError.ErrorDetail.builder()
                .field(ex.getParameterName())
                .issue(String.format("Required query parameter '%s' of type %s is missing.",
                        ex.getParameterName(), ex.getParameterType()))
                .build();

        ApiError error = ApiError.builder()
                .code(ErrorCode.INVALID_INPUT)
                .message("Required request parameter is missing.")
                .details(List.of(detail))
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);

        ApiError error = ApiError.builder()
                .code(ErrorCode.INVALID_INPUT)
                .message(String.format("HTTP method '%s' is not supported for this endpoint.", ex.getMethod()))
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);

        ApiError error = ApiError.builder()
                .code(ErrorCode.INVALID_INPUT)
                .message(String.format("Media type '%s' is not supported.", ex.getContentType()))
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(ApiResponse.failure(error));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnhandledException(Exception ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        log.error("Unhandled internal platform error occurred [Correlation: {}]: ", correlationId, ex);

        ApiError error = ApiError.builder()
                .code(ErrorCode.INTERNAL_ERROR)
                .message("An unexpected internal platform error occurred. Please contact support.")
                .correlationId(correlationId)
                .build();

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.failure(error));
    }

    private String resolveCorrelationId(HttpServletRequest request) {
        if (request != null) {
            String headerId = request.getHeader(HeaderConstants.X_CORRELATION_ID);
            if (headerId != null && !headerId.trim().isEmpty()) {
                return headerId.trim();
            }
        }
        String mdcId = MDC.get("correlationId");
        if (mdcId != null && !mdcId.trim().isEmpty()) {
            return mdcId.trim();
        }
        return null;
    }
}
