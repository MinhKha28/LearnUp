package com.learnup.common.exception;

import com.learnup.common.api.ApiError;
import com.learnup.common.constant.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exception representing business rule violations or domain invariant failures.
 */
public class BusinessException extends BaseException {

    public BusinessException(String message) {
        super(ErrorCode.INVALID_INPUT, message, HttpStatus.BAD_REQUEST);
    }

    public BusinessException(String errorCode, String message) {
        super(errorCode, message, HttpStatus.BAD_REQUEST);
    }

    public BusinessException(String errorCode, String message, HttpStatus httpStatus) {
        super(errorCode, message, httpStatus);
    }

    public BusinessException(String errorCode, String message, HttpStatus httpStatus, List<ApiError.ErrorDetail> details) {
        super(errorCode, message, httpStatus, details);
    }
}
