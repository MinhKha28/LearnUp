package com.learnup.identity.exception;

public class SignInDeniedException extends RuntimeException {

    private final String reason;

    public SignInDeniedException(String reason) {
        super(messageFor(reason));
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }

    private static String messageFor(String reason) {
        return switch (reason) {
            case "ACCOUNT_NOT_FOUND" -> "Account no longer exists";
            case "ACCOUNT_NOT_ACTIVE" -> "Account has not been activated yet";
            case "ACCOUNT_DEACTIVATED" -> "Account has been deactivated";
            case "ORGANIZATION_SUSPENDED" -> "Organization has been suspended by the platform";
            case "ORGANIZATION_NOT_ACTIVE" -> "Organization is not active";
            case "SUBSCRIPTION_SUSPENDED" -> "Organization subscription is suspended";
            case "SUBSCRIPTION_ENDED" -> "Organization has no active subscription";
            default -> "Sign-in is not allowed";
        };
    }
}
