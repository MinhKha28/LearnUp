package com.learnup.notification.enrollment;

/**
 * Another service did not answer (not reachable, too slow, a server error). It may answer later, so the event is
 * tried again. {@code code} is a fixed identifier, for example TENANT_UNAVAILABLE.
 */
public class DependencyUnavailableException extends RuntimeException {

    private final String code;

    public DependencyUnavailableException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
