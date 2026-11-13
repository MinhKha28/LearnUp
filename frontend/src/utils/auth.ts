import type { UserRole } from "@/types/identity.types";
import { clearVideoPositionSession } from "@/utils/video.position";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

const HOME_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/admin",
  ORGANIZER: "/organizer",
  INSTRUCTOR: "/instructor",
  LEARNER: "/learner",
};

export const homePathForRole = (role?: string | null): string =>
  (role && HOME_BY_ROLE[role as UserRole]) || "/";

export const safeRedirect = (target: string | null): string | null =>
  target && target.startsWith("/") && !target.startsWith("//") ? target : null;

export const saveTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

const SIGN_IN_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Hãy kiểm tra email và mật khẩu rồi thử lại.",
  ACCOUNT_NOT_FOUND: "Hãy kiểm tra email và mật khẩu rồi thử lại.",
  ACCOUNT_NOT_ACTIVE:
    "Tài khoản của bạn chưa được kích hoạt. Quản lý đào tạo: hãy hoàn tất thanh toán cho đăng ký. Thành viên được mời: hãy mở email mời để đặt mật khẩu.",
  ACCOUNT_DEACTIVATED:
    "Tài khoản của bạn đã bị vô hiệu hóa. Hãy liên hệ quản lý đào tạo của tổ chức.",
  ORGANIZATION_SUSPENDED:
    "Tổ chức của bạn đã bị LearnUP tạm khóa. Hãy liên hệ quản lý đào tạo.",
  ORGANIZATION_NOT_ACTIVE: "Tổ chức của bạn không ở trạng thái hoạt động.",
  SUBSCRIPTION_SUSPENDED:
    "Gói dịch vụ của tổ chức đang tạm ngưng. Hãy liên hệ quản lý đào tạo để gia hạn.",
  SUBSCRIPTION_ENDED: "Tổ chức của bạn không có gói dịch vụ đang hoạt động.",
  REFRESH_TOKEN_REUSED:
    "Phiên đăng nhập đã kết thúc vì lý do bảo mật. Vui lòng đăng nhập lại.",
  TOO_MANY_ATTEMPTS:
    "Bạn đã đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút hoặc đặt lại mật khẩu.",
  TENANT_UNAVAILABLE:
    "Tạm thời chưa đăng nhập được. Vui lòng thử lại sau ít phút.",
};

export const signInMessage = (code?: string | null): string =>
  (code && SIGN_IN_MESSAGES[code]) ||
  "Hãy kiểm tra email và mật khẩu rồi thử lại.";

export const isSignInReason = (code: string | null): code is string =>
  Boolean(code && SIGN_IN_MESSAGES[code]);

export const clearTokens = () => {
  clearVideoPositionSession();
  window.dispatchEvent(new Event("auth-cleared"));
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};
