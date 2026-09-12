package com.learnup.common.exception;

import com.learnup.common.constant.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * Exception thrown when the user lacks required permissions or role (HTTP 403).
 */
public class ForbiddenException extends BaseException {

    public ForbiddenException(String message) {
        super(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
    }

    public ForbiddenException(String message, String requiredRole) {
        super(ErrorCode.FORBIDDEN,
                String.format("%s (Required role: %s)", message, requiredRole),
                HttpStatus.FORBIDDEN);
    }
}
