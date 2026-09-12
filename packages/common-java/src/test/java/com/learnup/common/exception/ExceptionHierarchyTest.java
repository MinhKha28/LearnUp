package com.learnup.common.exception;

import com.learnup.common.constant.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class ExceptionHierarchyTest {

    @Test
    @DisplayName("Should verify BusinessException properties")
    void shouldVerifyBusinessException() {
        BusinessException ex = new BusinessException("Business constraint violated");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
        assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ex.getMessage()).isEqualTo("Business constraint violated");
    }

    @Test
    @DisplayName("Should verify ResourceNotFoundException properties")
    void shouldVerifyResourceNotFoundException() {
        ResourceNotFoundException ex = new ResourceNotFoundException("Course", "crs_123");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ex.getMessage()).contains("crs_123");
    }

    @Test
    @DisplayName("Should verify ForbiddenException properties")
    void shouldVerifyForbiddenException() {
        ForbiddenException ex = new ForbiddenException("Access denied", "ORGANIZER");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.getMessage()).contains("ORGANIZER");
    }

    @Test
    @DisplayName("Should verify ConflictException properties")
    void shouldVerifyConflictException() {
        ConflictException ex = new ConflictException("User", "email", "test@domain.com");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONFLICT);
        assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(ex.getMessage()).contains("test@domain.com");
    }

    @Test
    @DisplayName("Should verify UnauthorizedException properties")
    void shouldVerifyUnauthorizedException() {
        UnauthorizedException ex = new UnauthorizedException("Invalid credentials");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);
        assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
