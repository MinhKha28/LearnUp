package com.learnup.common.exception;

import com.learnup.common.api.ApiError;
import com.learnup.common.constant.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exception thrown when input validation fails (HTTP 400).
 */
public class InvalidInputException extends BaseException {

    public InvalidInputException(String message) {
        super(ErrorCode.INVALID_INPUT, message, HttpStatus.BAD_REQUEST);
    }

    public InvalidInputException(String message, List<ApiError.ErrorDetail> details) {
        super(ErrorCode.INVALID_INPUT, message, HttpStatus.BAD_REQUEST, details);
    }
}
