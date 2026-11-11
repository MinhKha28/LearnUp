package com.learnup.identity.exception;

public class TooManyAttemptsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyAttemptsException(long retryAfterSeconds) {
        this("Too many failed sign-in attempts. Try again in " + retryAfterSeconds + " seconds", retryAfterSeconds);
    }

    private TooManyAttemptsException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /** UC08: the same 429 contract, worded for repeated incorrect current-password checks. */
    public static TooManyAttemptsException passwordChange(long retryAfterSeconds) {
        return new TooManyAttemptsException(
                "Too many incorrect current-password attempts. Try again in " + retryAfterSeconds + " seconds",
                retryAfterSeconds);
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
