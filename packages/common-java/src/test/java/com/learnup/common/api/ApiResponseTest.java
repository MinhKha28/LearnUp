package com.learnup.common.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {

    @Test
    @DisplayName("Should create successful ApiResponse with data")
    void shouldCreateSuccessResponse() {
        Map<String, String> data = Map.of("key", "value");
        ApiResponse<Map<String, String>> response = ApiResponse.ok(data);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getData()).isEqualTo(data);
        assertThat(response.getMeta()).isNull();
        assertThat(response.getError()).isNull();
        assertThat(response.getTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("Should create successful ApiResponse with data and pagination metadata")
    void shouldCreateSuccessResponseWithMeta() {
        String data = "test-item";
        PageMeta meta = PageMeta.of(0, 20, 100);
        ApiResponse<String> response = ApiResponse.ok(data, meta);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getData()).isEqualTo("test-item");
        assertThat(response.getMeta()).isNotNull();
        assertThat(response.getMeta().getTotalPages()).isEqualTo(5);
        assertThat(response.getMeta().isHasNext()).isTrue();
        assertThat(response.getMeta().isHasPrevious()).isFalse();
        assertThat(response.getError()).isNull();
    }

    @Test
    @DisplayName("Should create failure ApiResponse with structured ApiError")
    void shouldCreateFailureResponse() {
        ApiError error = ApiError.of("RESOURCE_NOT_FOUND", "Item not found", "corr-123");
        ApiResponse<Void> response = ApiResponse.failure(error);

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getData()).isNull();
        assertThat(response.getError()).isNotNull();
        assertThat(response.getError().getCode()).isEqualTo("RESOURCE_NOT_FOUND");
        assertThat(response.getError().getMessage()).isEqualTo("Item not found");
        assertThat(response.getError().getCorrelationId()).isEqualTo("corr-123");
        assertThat(response.getTimestamp()).isNotNull();
    }
}
