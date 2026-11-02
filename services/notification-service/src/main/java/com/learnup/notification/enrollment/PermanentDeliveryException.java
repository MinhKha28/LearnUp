package com.learnup.notification.enrollment;

/**
 * A delivery that trying again cannot fix (another service refused the request, for example). The event is
 * recorded as FAILED and not retried. {@code code} is a fixed identifier, for example TENANT_REJECTED.
 */
public class PermanentDeliveryException extends RuntimeException {

    private final String code;

    public PermanentDeliveryException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
