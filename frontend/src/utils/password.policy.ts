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
  CURRENT_PASSWORD_INCORRECT: "Mật khẩu hiện tại không đúng.",
  NEW_PASSWORD_SAME_AS_CURRENT: "Hãy chọn mật khẩu mới khác mật khẩu hiện tại.",
  PASSWORD_CONFIRMATION_MISMATCH: "Mật khẩu nhập lại không khớp.",
  TOO_MANY_ATTEMPTS:
    "Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần. Hãy thử lại sau 15 phút, hoặc đăng xuất rồi đặt lại mật khẩu.",
};

/**
 * The English messages an Identity build from before the per-reason codes returns with BAD_REQUEST.
 * Kept so a newer frontend still shows the right message while Identity is older (staggered
 * deploy, rollback, or a frontend pulled without rebuilding Identity).
 */
const LEGACY_CHANGE_PASSWORD_MESSAGES: Record<string, string> = {
  "Current password is incorrect": CHANGE_PASSWORD_MESSAGES.CURRENT_PASSWORD_INCORRECT,
  "New password cannot be the same as the current password":
    CHANGE_PASSWORD_MESSAGES.NEW_PASSWORD_SAME_AS_CURRENT,
  "New password and confirmation password do not match":
    CHANGE_PASSWORD_MESSAGES.PASSWORD_CONFIRMATION_MISMATCH,
};

const lookup = (messages: Record<string, string>, key?: string): string | undefined =>
  key !== undefined && Object.hasOwn(messages, key) ? messages[key] : undefined;

/**
 * UC08: maps an Identity error envelope to the message shown on the change-password pages.
 * A known error code decides the message. Only when the code is not one of them is the English
 * message of an older Identity matched, and anything else gets the generic message.
 */
export const changePasswordErrorMessage = (error?: {
  code?: string;
  message?: string;
}): string =>
  lookup(CHANGE_PASSWORD_MESSAGES, error?.code) ??
  lookup(LEGACY_CHANGE_PASSWORD_MESSAGES, error?.message) ??
  "Chưa đổi được mật khẩu. Vui lòng thử lại.";
