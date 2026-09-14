package com.learnup.common.response;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Objects;

/**
 * Standard top-level response envelope for all LearnUP REST endpoints.
 *
 * @param <T> Type of data payload
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final ApiError error;

    @JsonCreator
    public ApiResponse(
            @JsonProperty("success") boolean success,
            @JsonProperty("data") T data,
            @JsonProperty("error") ApiError error) {
        this.success = success;
        this.data = data;
        this.error = error;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static ApiResponse<Void> success() {
        return new ApiResponse<>(true, null, null);
    }

    public static <T> ApiResponse<T> error(ApiError error) {
        return new ApiResponse<>(false, null, error);
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, null, ApiError.of(code, message));
    }

    public static <T> ApiResponse<T> error(String code, String message, List<String> details) {
        return new ApiResponse<>(false, null, ApiError.of(code, message, details));
    }

    public boolean isSuccess() {
        return success;
    }

    public T getData() {
        return data;
    }

    public ApiError getError() {
        return error;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ApiResponse<?> that = (ApiResponse<?>) o;
        return success == that.success &&
               Objects.equals(data, that.data) &&
               Objects.equals(error, that.error);
    }

    @Override
    public int hashCode() {
        return Objects.hash(success, data, error);
    }

    @Override
    public String toString() {
        return "ApiResponse{" +
               "success=" + success +
               ", data=" + data +
               ", error=" + error +
               '}';
    }
}
