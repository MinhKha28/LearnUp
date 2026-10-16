package com.learnup.identity.exception;

public class RefreshTokenReusedException extends RuntimeException {

    public RefreshTokenReusedException() {
        super("Refresh token reuse detected. Every session of this sign-in has been revoked");
    }
}
