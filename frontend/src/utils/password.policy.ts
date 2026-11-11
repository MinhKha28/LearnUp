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
  "Current password is incorrect": "Mật khẩu hiện tại không đúng.",
  "New password cannot be the same as the current password":
    "Hãy chọn mật khẩu mới khác mật khẩu hiện tại.",
  "New password and confirmation password do not match":
    "Mật khẩu nhập lại không khớp.",
};

/** UC08: maps an Identity error envelope to the message shown on the change-password pages. */
export const changePasswordErrorMessage = (error?: {
  code?: string;
  message?: string;
}): string => {
  if (error?.code === "TOO_MANY_ATTEMPTS") {
    return "Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần. Hãy thử lại sau 15 phút, hoặc đăng xuất rồi đặt lại mật khẩu.";
  }
  return (
    CHANGE_PASSWORD_MESSAGES[error?.message ?? ""] ??
    "Chưa đổi được mật khẩu. Vui lòng thử lại."
  );
};
