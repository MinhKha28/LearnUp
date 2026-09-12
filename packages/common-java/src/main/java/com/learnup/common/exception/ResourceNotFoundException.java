package com.learnup.common.exception;

import com.learnup.common.constant.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a requested resource is not found (HTTP 404).
 */
public class ResourceNotFoundException extends BaseException {

    public ResourceNotFoundException(String message) {
        super(ErrorCode.RESOURCE_NOT_FOUND, message, HttpStatus.NOT_FOUND);
    }

    public ResourceNotFoundException(String resourceName, String identifier) {
        super(ErrorCode.RESOURCE_NOT_FOUND,
                String.format("%s with identifier '%s' was not found.", resourceName, identifier),
                HttpStatus.NOT_FOUND);
    }
}
