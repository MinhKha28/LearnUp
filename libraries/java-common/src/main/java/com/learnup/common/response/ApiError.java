package com.learnup.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Standard error representation inside ApiResponse.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiError {

    private final String code;
    private final String message;
    private final List<String> details;

    public ApiError(String code, String message) {
        this(code, message, null);
    }

    public ApiError(String code, String message, List<String> details) {
        this.code = Objects.requireNonNull(code, "Error code must not be null");
        this.message = Objects.requireNonNull(message, "Error message must not be null");
        this.details = details != null && !details.isEmpty() ? List.copyOf(details) : null;
    }

    public static ApiError of(String code, String message) {
        return new ApiError(code, message);
    }

    public static ApiError of(String code, String message, List<String> details) {
        return new ApiError(code, message, details);
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public List<String> getDetails() {
        return details;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ApiError apiError = (ApiError) o;
        return Objects.equals(code, apiError.code) &&
               Objects.equals(message, apiError.message) &&
               Objects.equals(details, apiError.details);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code, message, details);
    }

    @Override
    public String toString() {
        return "ApiError{" +
               "code='" + code + '\'' +
               ", message='" + message + '\'' +
               ", details=" + details +
               '}';
    }
}
