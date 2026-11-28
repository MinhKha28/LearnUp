package com.learnup.identity.exception;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.exception.ErrorCode;

/**
 * UC08: a password change the caller can correct. It stays a BAD_REQUEST business rejection,
 * but each reason is answered with its own error code.
 */
public final class PasswordChangeRejectedException extends BusinessException {
    private final String code;

    private PasswordChangeRejectedException(String code, String message) {
        super(ErrorCode.BAD_REQUEST, message);
        this.code = code;
    }

    public static PasswordChangeRejectedException confirmationMismatch() {
        return new PasswordChangeRejectedException("PASSWORD_CONFIRMATION_MISMATCH",
                "New password and confirmation password do not match");
    }

    public static PasswordChangeRejectedException sameAsCurrent() {
        return new PasswordChangeRejectedException("NEW_PASSWORD_SAME_AS_CURRENT",
                "New password cannot be the same as the current password");
    }

    public static PasswordChangeRejectedException currentIncorrect() {
        return new PasswordChangeRejectedException("CURRENT_PASSWORD_INCORRECT", "Current password is incorrect");
    }

    public String getCode() {
        return code;
    }
}
