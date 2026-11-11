package com.learnup.identity.dto;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

/**
 * A password that will be stored. Identity stores the trimmed value, so both limits apply to it:
 * the existing minimum of 6 characters and BCrypt's 72-byte input limit, beyond which BCrypt would
 * silently ignore the rest of the password. Blank values are left to {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = NewPassword.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface NewPassword {

    int MIN_CHARACTERS = 6;
    int MAX_BYTES = 72;

    String message() default "must be at least 6 characters and at most 72 bytes, ignoring leading and trailing spaces";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    final class Validator implements ConstraintValidator<NewPassword, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null || value.isBlank()) {
                return true;
            }
            String stored = value.trim();
            return stored.length() >= MIN_CHARACTERS
                    && stored.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
        }
    }
}
