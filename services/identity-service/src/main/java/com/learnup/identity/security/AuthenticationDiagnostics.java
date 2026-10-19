package com.learnup.identity.security;

import com.learnup.common.context.CorrelationContext;

import java.util.UUID;

/** Only allowlisted diagnostic metadata, never request values or exception messages. */
public final class AuthenticationDiagnostics {
    private AuthenticationDiagnostics() {}

    public static String correlationId() {
        String candidate = CorrelationContext.getCorrelationId();
        return isCorrelationId(candidate) ? candidate : "unavailable";
    }

    public static boolean isCorrelationId(String candidate) {
        if (candidate == null || candidate.length() != 36) {
            return false;
        }
        try {
            return UUID.fromString(candidate).toString().equalsIgnoreCase(candidate);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public static String exceptionType(Throwable failure) {
        return failure == null ? "none" : failure.getClass().getName();
    }

    public static String location(Throwable failure) {
        if (failure == null || failure.getStackTrace().length == 0) {
            return "unavailable";
        }
        StackTraceElement frame = failure.getStackTrace()[0];
        return frame.getClassName() + "." + frame.getMethodName() + ":" + frame.getLineNumber();
    }
}
