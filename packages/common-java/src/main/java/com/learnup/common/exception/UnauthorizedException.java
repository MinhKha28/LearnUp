package com.learnup.common.exception;

import com.learnup.common.constant.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * Exception thrown when authentication credentials are missing, invalid, or expired (HTTP 401).
 */
public class UnauthorizedException extends BaseException {

    public UnauthorizedException(String message) {
        super(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
    }
}
