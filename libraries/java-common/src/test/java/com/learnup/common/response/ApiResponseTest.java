package com.learnup.common.response;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Should create successful ApiResponse with payload and serialize properly")
    void shouldCreateSuccessResponse() throws JsonProcessingException {
        Map<String, String> payload = Map.of("courseId", "c-101", "name", "Java Microservices");
        ApiResponse<Map<String, String>> response = ApiResponse.success(payload);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getData()).isEqualTo(payload);
        assertThat(response.getError()).isNull();

        String json = objectMapper.writeValueAsString(response);
        assertThat(json).contains("\"success\":true");
        assertThat(json).contains("\"courseId\":\"c-101\"");
        assertThat(json).doesNotContain("\"error\"");
    }

    @Test
    @DisplayName("Should create void success response")
    void shouldCreateVoidSuccessResponse() throws JsonProcessingException {
        ApiResponse<Void> response = ApiResponse.success();

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getData()).isNull();
        assertThat(response.getError()).isNull();

        String json = objectMapper.writeValueAsString(response);
        assertThat(json).contains("\"success\":true");
        assertThat(json).doesNotContain("\"data\"");
        assertThat(json).doesNotContain("\"error\"");
    }

    @Test
    @DisplayName("Should create error response with code, message, and details")
    void shouldCreateErrorResponse() throws JsonProcessingException {
        List<String> details = List.of("Field 'title' is required", "Field 'price' must be >= 0");
        ApiResponse<Void> response = ApiResponse.error("VALIDATION_ERROR", "Validation failed", details);

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getData()).isNull();
        assertThat(response.getError()).isNotNull();
        assertThat(response.getError().getCode()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.getError().getMessage()).isEqualTo("Validation failed");
        assertThat(response.getError().getDetails()).containsExactlyElementsOf(details);

        String json = objectMapper.writeValueAsString(response);
        assertThat(json).contains("\"success\":false");
        assertThat(json).contains("\"code\":\"VALIDATION_ERROR\"");
        assertThat(json).contains("\"message\":\"Validation failed\"");
        assertThat(json).contains("Field 'title' is required");
        assertThat(json).doesNotContain("\"data\"");
    }
}
