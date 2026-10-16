package com.learnup.identity.exception;

public class TenantUnavailableException extends RuntimeException {

    public TenantUnavailableException(Throwable cause) {
        super("Account status service is temporarily unavailable", cause);
    }
}
