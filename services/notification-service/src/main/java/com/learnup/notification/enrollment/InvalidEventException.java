package com.learnup.notification.enrollment;

/**
 * The message cannot be an event this service understands (bad JSON, a missing field, an unsupported version).
 * Trying again cannot help, so it goes to the dead-letter topic. The message is a fixed code: text from the
 * payload is never copied into an exception, a log or a stored error.
 */
public class InvalidEventException extends RuntimeException {

    private final String code;

    public InvalidEventException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
