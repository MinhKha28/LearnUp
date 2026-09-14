package com.learnup.common.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BusinessExceptionTest {

    @Test
    @DisplayName("Should populate error code, message, and details correctly")
    void shouldPopulateFieldsCorrectly() {
        List<String> details = List.of("Learner ID is inactive", "Quota exceeded");
        BusinessException ex = new BusinessException(ErrorCode.CONFLICT, "Cannot assign course", details);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONFLICT);
        assertThat(ex.getMessage()).isEqualTo("Cannot assign course");
        assertThat(ex.getDetails()).containsExactlyElementsOf(details);
    }

    @Test
    @DisplayName("Should use default error message when custom message is omitted")
    void shouldUseDefaultMessage() {
        BusinessException ex = new BusinessException(ErrorCode.RESOURCE_NOT_FOUND);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        assertThat(ex.getMessage()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getDefaultMessage());
        assertThat(ex.getDetails()).isNull();
    }

    @Test
    @DisplayName("Should provide static convenience factories")
    void shouldProvideConvenienceFactories() {
        BusinessException notFound = BusinessException.notFound("Course not found");
        assertThat(notFound.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        assertThat(notFound.getMessage()).isEqualTo("Course not found");

        BusinessException forbidden = BusinessException.forbidden("Access denied");
        assertThat(forbidden.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);

        BusinessException unauthorized = BusinessException.unauthorized("Token expired");
        assertThat(unauthorized.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);

        BusinessException badRequest = BusinessException.badRequest("Invalid input");
        assertThat(badRequest.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST);

        BusinessException conflict = BusinessException.conflict("Duplicate email");
        assertThat(conflict.getErrorCode()).isEqualTo(ErrorCode.CONFLICT);

        BusinessException validation = BusinessException.validation("Payload invalid", List.of("email is invalid"));
        assertThat(validation.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThat(validation.getDetails()).containsExactly("email is invalid");
    }
}
