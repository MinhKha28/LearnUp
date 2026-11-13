import { signInMessage } from "@/utils/auth";

// UC05.1 error codes returned by Identity (POST /api/v1/auth/google).
const GOOGLE_MESSAGES: Record<string, string> = {
  GOOGLE_ACCOUNT_NOT_LINKED: "Email Google này chưa được liên kết với tài khoản LearnUP.",
  GOOGLE_SIGN_IN_NOT_ALLOWED:
    "Tài khoản này chưa thể đăng nhập bằng Google. Vui lòng đăng nhập bằng email và mật khẩu.",
  GOOGLE_CREDENTIAL_INVALID: "Không xác minh được đăng nhập bằng Google. Vui lòng thử lại.",
  GOOGLE_SIGN_IN_UNAVAILABLE:
    "Tính năng đăng nhập bằng Google đang gián đoạn. Vui lòng đăng nhập bằng email và mật khẩu.",
};

export const GOOGLE_UNAVAILABLE_MESSAGE = GOOGLE_MESSAGES.GOOGLE_SIGN_IN_UNAVAILABLE;

/** Google-specific codes first; account/Organization/Subscription denials reuse the UC05 wording. */
export const googleSignInMessage = (code?: string | null): string =>
  typeof code === "string" && Object.hasOwn(GOOGLE_MESSAGES, code)
    ? GOOGLE_MESSAGES[code]
    : signInMessage(code);
