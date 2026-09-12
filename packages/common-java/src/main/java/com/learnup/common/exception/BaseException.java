package com.learnup.common.exception;

import com.learnup.common.api.ApiError;
import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Base abstract exception class for all LearnUP platform domain and runtime exceptions.
 */
@Getter
public abstract class BaseException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus httpStatus;
    private final List<ApiError.ErrorDetail> details;

    protected BaseException(String errorCode, String message, HttpStatus httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.details = null;
    }

    protected BaseException(String errorCode, String message, HttpStatus httpStatus, List<ApiError.ErrorDetail> details) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.details = details;
    }

    protected BaseException(String errorCode, String message, HttpStatus httpStatus, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.details = null;
    }
}
