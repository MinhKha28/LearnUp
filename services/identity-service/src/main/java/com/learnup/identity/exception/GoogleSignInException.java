package com.learnup.identity.exception;

import org.springframework.http.HttpStatus;

/** UC05.1 sign-in failures with a stable error code; messages never contain token or email values. */
public class GoogleSignInException extends RuntimeException {

    public static final String UNAVAILABLE = "GOOGLE_SIGN_IN_UNAVAILABLE";
    public static final String CREDENTIAL_INVALID = "GOOGLE_CREDENTIAL_INVALID";
    public static final String ACCOUNT_NOT_LINKED = "GOOGLE_ACCOUNT_NOT_LINKED";
    public static final String NOT_ALLOWED = "GOOGLE_SIGN_IN_NOT_ALLOWED";

    private final String code;
    private final HttpStatus status;

    private GoogleSignInException(String code, HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.status = status;
    }

    public static GoogleSignInException unavailable(Throwable cause) {
        return new GoogleSignInException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE,
                "Google sign-in is currently unavailable", cause);
    }

    public static GoogleSignInException invalidCredential(Throwable cause) {
        return new GoogleSignInException(CREDENTIAL_INVALID, HttpStatus.UNAUTHORIZED,
                "Google sign-in could not be verified", cause);
    }

    /** BR-37: Google sign-in never creates an account. */
    public static GoogleSignInException accountNotLinked() {
        return new GoogleSignInException(ACCOUNT_NOT_LINKED, HttpStatus.UNAUTHORIZED,
                "This Google account is not linked to an existing LearnUP account", null);
    }

    /** BR-36: Google sign-in does not apply to the platform Admin. */
    public static GoogleSignInException notAllowed() {
        return new GoogleSignInException(NOT_ALLOWED, HttpStatus.FORBIDDEN,
                "Google sign-in is not available for this account; sign in with email and password", null);
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
