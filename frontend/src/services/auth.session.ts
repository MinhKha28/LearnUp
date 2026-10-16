import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ILogin } from "@/types/identity.types";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearTokens,
  saveTokens,
} from "@/utils/auth";

// Client riêng, KHÔNG gắn interceptor: nếu chính /refresh trả 401 thì không bị gọi refresh lồng vào nhau
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  timeout: 10000,
});

// Các API đăng nhập tự xử lý 401 của mình (sai mật khẩu, refresh token hỏng) -> không làm mới token
const AUTH_ENDPOINT = /\/auth\/(login|refresh|logout)$/;
const PROTECTED_PREFIXES = ["/admin", "/organizer", "/learner", "/instructor"];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let pendingRefresh: Promise<string | null> | null = null;

const requestNewTokens = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const response = await refreshClient.post<
      unknown,
      { data: { data?: ILogin } }
    >("/api/v1/auth/refresh", { refreshToken });
    const tokens = response.data.data;
    if (!tokens?.accessToken || !tokens.refreshToken) return null;
    saveTokens(tokens.accessToken, tokens.refreshToken); // identity xoay vòng: luôn lưu cặp mới
    return tokens.accessToken;
  } catch {
    return null;
  }
};

/** UC05: đổi refresh token lấy cặp token mới. Nhiều request cùng 401 chỉ gọi /refresh một lần. */
export const refreshAccessToken = (): Promise<string | null> => {
  pendingRefresh ??= requestNewTokens().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
};

/** Phiên hết hẳn: xóa token, đang ở khu làm việc thì về màn đăng nhập rồi quay lại đúng trang. */
const endSession = () => {
  clearTokens();
  const { pathname, search } = window.location;
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    window.location.assign(
      `/login?redirect=${encodeURIComponent(pathname + search)}`,
    );
  }
};

/**
 * Gọi trong interceptor lỗi: nếu lỗi là 401 do access token hết hạn thì làm mới rồi gửi lại request.
 * Trả null khi lỗi không thuộc trường hợp này (nơi gọi xử lý lỗi như bình thường).
 */
export const retryWithFreshToken = async (
  instance: AxiosInstance,
  error: unknown,
): Promise<unknown> => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return null;
  const config = error.config as RetriableConfig | undefined;
  if (
    !config ||
    config._retried ||
    AUTH_ENDPOINT.test(config.url ?? "") ||
    !localStorage.getItem(ACCESS_TOKEN_KEY)
  ) {
    return null;
  }
  config._retried = true; // mỗi request chỉ thử lại 1 lần, tránh vòng lặp vô hạn
  const token = await refreshAccessToken();
  if (!token) {
    endSession();
    return null;
  }
  return instance.request(config); // interceptor request tự gắn access token mới
};
