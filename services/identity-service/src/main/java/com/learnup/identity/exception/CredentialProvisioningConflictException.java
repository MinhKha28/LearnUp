package com.learnup.identity.exception;

/** Application-defined diagnostics only; never retain SQL, row contents or another owner's ID. */
public final class CredentialProvisioningConflictException extends RuntimeException {
    private final String code;

    private CredentialProvisioningConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public static CredentialProvisioningConflictException emailInUse() {
        return new CredentialProvisioningConflictException("EMAIL_IN_USE", "Email is already in use");
    }

    public static CredentialProvisioningConflictException concurrentClaim() {
        return new CredentialProvisioningConflictException("CREDENTIAL_CONFLICT",
                "Credentials conflict with another operation; retry with the same canonical user ID");
    }

    public String getCode() {
        return code;
    }
}
