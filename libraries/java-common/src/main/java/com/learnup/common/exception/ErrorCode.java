package com.learnup.common.exception;

/**
 * Standard platform-wide error codes and their corresponding default HTTP status codes.
 */
public enum ErrorCode {

    UNAUTHORIZED(401, "Authentication required or token expired"),
    FORBIDDEN(403, "Access denied for this resource"),
    RESOURCE_NOT_FOUND(404, "Requested resource not found"),
    VALIDATION_ERROR(400, "Validation failed on request payload"),
    CONFLICT(409, "Resource state conflict"),
    BAD_REQUEST(400, "Bad request payload or invalid parameters"),
    INTERNAL_ERROR(500, "An internal server error occurred");

    private final int httpStatus;
    private final String defaultMessage;

    ErrorCode(int httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
