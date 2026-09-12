package com.learnup.common.exception;

import com.learnup.common.api.ApiResponse;
import com.learnup.common.constant.ErrorCode;
import com.learnup.common.constant.HeaderConstants;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        this.handler = new GlobalExceptionHandler();
        this.request = Mockito.mock(HttpServletRequest.class);
        when(this.request.getHeader(HeaderConstants.X_CORRELATION_ID)).thenReturn("corr-test-123");
    }

    @Test
    @DisplayName("Should handle ResourceNotFoundException and return 404 with structured error")
    void shouldHandleResourceNotFoundException() {
        ResourceNotFoundException ex = new ResourceNotFoundException("Course", "crs_999");
        ResponseEntity<ApiResponse<Void>> response = this.handler.handleBaseException(ex, this.request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isFalse();
        assertThat(response.getBody().getError().getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        assertThat(response.getBody().getError().getCorrelationId()).isEqualTo("corr-test-123");
    }

    @Test
    @DisplayName("Should handle ForbiddenException and return 403")
    void shouldHandleForbiddenException() {
        ForbiddenException ex = new ForbiddenException("Unauthorized action");
        ResponseEntity<ApiResponse<Void>> response = this.handler.handleBaseException(ex, this.request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getError().getCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("Should handle generic Exception and return 500 without leaking stack trace")
    void shouldHandleGenericException() {
        RuntimeException ex = new RuntimeException("Database timeout");
        ResponseEntity<ApiResponse<Void>> response = this.handler.handleUnhandledException(ex, this.request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getError().getCode()).isEqualTo(ErrorCode.INTERNAL_ERROR);
        assertThat(response.getBody().getError().getMessage()).doesNotContain("Database timeout");
    }
}
