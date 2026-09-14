package com.learnup.common.exception;

import com.learnup.common.response.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("Should translate BusinessException to ResponseEntity with matching HTTP status and code")
    void shouldHandleBusinessException() {
        BusinessException ex = new BusinessException(
                ErrorCode.RESOURCE_NOT_FOUND,
                "Learner not found",
                List.of("Learner ID does not exist in the organization")
        );

        ResponseEntity<ApiResponse<Void>> responseEntity = handler.handleBusinessException(ex);

        assertThat(responseEntity.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        ApiResponse<Void> body = responseEntity.getBody();
        assertThat(body).isNotNull();
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getError().getCode()).isEqualTo("RESOURCE_NOT_FOUND");
        assertThat(body.getError().getMessage()).isEqualTo("Learner not found");
        assertThat(body.getError().getDetails()).containsExactly("Learner ID does not exist in the organization");
    }

    @Test
    @DisplayName("Should translate IllegalArgumentException to HTTP 400 Bad Request")
    void shouldHandleIllegalArgumentException() {
        IllegalArgumentException ex = new IllegalArgumentException("Invalid page index parameter");

        ResponseEntity<ApiResponse<Void>> responseEntity = handler.handleIllegalArgument(ex);

        assertThat(responseEntity.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ApiResponse<Void> body = responseEntity.getBody();
        assertThat(body).isNotNull();
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getError().getCode()).isEqualTo("BAD_REQUEST");
        assertThat(body.getError().getMessage()).isEqualTo("Invalid page index parameter");
    }

    @Test
    @DisplayName("Should translate generic unhandled exception to HTTP 500 Internal Server Error")
    void shouldHandleGenericException() {
        RuntimeException ex = new RuntimeException("Database timeout error");

        ResponseEntity<ApiResponse<Void>> responseEntity = handler.handleGenericException(ex);

        assertThat(responseEntity.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        ApiResponse<Void> body = responseEntity.getBody();
        assertThat(body).isNotNull();
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getError().getCode()).isEqualTo("INTERNAL_ERROR");
        assertThat(body.getError().getMessage()).contains("unexpected internal error");
    }
}
