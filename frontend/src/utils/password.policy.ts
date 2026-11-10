/**
 * Client-side checks for a password that LearnUP will store. Identity stores the trimmed value and
 * BCrypt only reads its first 72 bytes, so both limits are measured on the trimmed UTF-8 bytes.
 */
export const PASSWORD_MAX_BYTES = 72;

export const storedPassword = (value: string): string => value.trim();

export const passwordByteLength = (value: string): number =>
  new TextEncoder().encode(storedPassword(value)).length;

export const isWithinPasswordByteLimit = (value: string): boolean =>
  passwordByteLength(value) <= PASSWORD_MAX_BYTES;

export const hasMinimumPasswordLength = (value: string, min: number): boolean =>
  storedPassword(value).length >= min;

/** Two inputs that would be stored as the same password. */
export const isSameStoredPassword = (a?: string, b?: string): boolean =>
  a !== undefined && b !== undefined && storedPassword(a) === storedPassword(b);

const CHANGE_PASSWORD_MESSAGES: Record<string, string> = {
  "Current password is incorrect": "Current password is incorrect.",
  "New password cannot be the same as the current password":
    "Choose a new password that is different from the current one.",
  "New password and confirmation password do not match":
    "Passwords do not match.",
};

/** UC08: maps an Identity error envelope to the message shown on the change-password pages. */
export const changePasswordErrorMessage = (error?: {
  code?: string;
  message?: string;
}): string => {
  if (error?.code === "TOO_MANY_ATTEMPTS") {
    return "Too many incorrect current-password attempts. Try again in 15 minutes, or sign out and reset your password.";
  }
  return (
    CHANGE_PASSWORD_MESSAGES[error?.message ?? ""] ??
    "The password could not be changed. Please try again."
  );
};
