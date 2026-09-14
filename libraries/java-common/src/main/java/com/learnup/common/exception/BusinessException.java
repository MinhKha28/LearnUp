package com.learnup.common.exception;

import java.util.List;
import java.util.Objects;

/**
 * Standard business exception for domain rule violations and controlled failure conditions.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final List<String> details;

    public BusinessException(ErrorCode errorCode) {
        super(Objects.requireNonNull(errorCode, "ErrorCode must not be null").getDefaultMessage());
        this.errorCode = errorCode;
        this.details = null;
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message != null ? message : errorCode.getDefaultMessage());
        this.errorCode = Objects.requireNonNull(errorCode, "ErrorCode must not be null");
        this.details = null;
    }

    public BusinessException(ErrorCode errorCode, String message, List<String> details) {
        super(message != null ? message : errorCode.getDefaultMessage());
        this.errorCode = Objects.requireNonNull(errorCode, "ErrorCode must not be null");
        this.details = details != null && !details.isEmpty() ? List.copyOf(details) : null;
    }

    public BusinessException(ErrorCode errorCode, String message, Throwable cause) {
        super(message != null ? message : errorCode.getDefaultMessage(), cause);
        this.errorCode = Objects.requireNonNull(errorCode, "ErrorCode must not be null");
        this.details = null;
    }

    public static BusinessException unauthorized(String message) {
        return new BusinessException(ErrorCode.UNAUTHORIZED, message);
    }

    public static BusinessException forbidden(String message) {
        return new BusinessException(ErrorCode.FORBIDDEN, message);
    }

    public static BusinessException notFound(String message) {
        return new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, message);
    }

    public static BusinessException validation(String message, List<String> details) {
        return new BusinessException(ErrorCode.VALIDATION_ERROR, message, details);
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(ErrorCode.CONFLICT, message);
    }

    public static BusinessException badRequest(String message) {
        return new BusinessException(ErrorCode.BAD_REQUEST, message);
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public List<String> getDetails() {
        return details;
    }
}
