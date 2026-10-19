package com.learnup.notification.controller;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Email bodies and SMTP exception messages may contain bearer-style recovery links. */
@RestControllerAdvice(assignableTypes = EmailDeliveryController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EmailDeliveryExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryExceptionHandler.class);

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class,
            ConstraintViolationException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiResponse<Void>> invalidRequest(Exception ignored) {
        log.warn("event=email_request_rejected reason=INVALID_REQUEST correlation_id={}", MDC.get("correlationId"));
        return ResponseEntity.badRequest().body(ApiResponse.error("BAD_REQUEST", "Invalid email request"));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> businessFailure(BusinessException failure) {
        log.warn("event=email_request_rejected reason={} correlation_id={}",
                failure.getErrorCode().name(), MDC.get("correlationId"));
        return ResponseEntity.status(failure.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(failure.getErrorCode().name(), "Email operation rejected"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> unexpectedFailure(Exception failure) {
        log.error("event=email_request_failed exception_type={} correlation_id={}",
                failure.getClass().getName(), MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "Email operation failed"));
    }
}
