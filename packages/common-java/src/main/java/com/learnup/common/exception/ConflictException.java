package com.learnup.common.exception;

import com.learnup.common.constant.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * Exception thrown when an operation conflicts with the current state of the resource (HTTP 409).
 */
public class ConflictException extends BaseException {

    public ConflictException(String message) {
        super(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT);
    }

    public ConflictException(String resourceName, String field, String value) {
        super(ErrorCode.CONFLICT,
                String.format("%s with %s '%s' already exists.", resourceName, field, value),
                HttpStatus.CONFLICT);
    }
}
