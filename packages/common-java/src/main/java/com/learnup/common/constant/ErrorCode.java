package com.learnup.common.constant;

/**
 * Standard platform error codes.
 */
public final class ErrorCode {

    private ErrorCode() {
        // Prevent instantiation
    }

    public static final String INVALID_INPUT = "INVALID_INPUT";
    public static final String UNAUTHORIZED = "UNAUTHORIZED";
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND";
    public static final String CONFLICT = "CONFLICT";
    public static final String RATE_LIMITED = "RATE_LIMITED";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";
    public static final String SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE";
}
