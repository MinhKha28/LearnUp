import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ILogin } from "@/types/identity.types";
import { createRefreshCoordinator } from "@/services/auth.refresh";
import { accessClaims, sameTokenOwner } from "@/utils/auth.claims";
import { ownsProgress, type ProgressOwner } from "@/utils/video.progress.queue";
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

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean; progressOwner?: ProgressOwner };

let deniedReason: string | null = null;

const requestNewTokens = async (refreshToken: string) => {
  deniedReason = null;
  try {
    const response = await refreshClient.post<
      unknown,
      { data: { data?: ILogin } }
    >("/api/v1/auth/refresh", { refreshToken });
    const tokens = response.data.data;
    if (!tokens?.accessToken || !tokens.refreshToken) throw new Error("Invalid refresh response");
    return tokens;
  } catch (error) {
    const code = axios.isAxiosError(error)
      ? (error.response?.data as { error?: { code?: string } } | undefined)
          ?.error?.code
      : undefined;
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    deniedReason =
      code && (status === 403 || code === "REFRESH_TOKEN_REUSED") ? code : null;
    throw error;
  }
};

const coordinateRefresh = createRefreshCoordinator({
  read: () => ({ accessToken: localStorage.getItem(ACCESS_TOKEN_KEY), refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) }),
  request: requestNewTokens,
  save: tokens => saveTokens(tokens.accessToken, tokens.refreshToken),
  locks: () => typeof navigator !== "undefined" ? navigator.locks : undefined,
  isDenied: error => axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0),
});

/** UC05: share refresh coordination between proactive checks and HTTP401 retries. */
export const refreshAccessToken = async (): Promise<string | null> =>
  (await coordinateRefresh()).token;

export const refreshExpiringAccessToken = async () => {
  if (typeof navigator === "undefined" || !navigator.locks) return true;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const claims = accessClaims(token);
  if (claims && claims.exp * 1000 - Date.now() < 30_000)
    return !!(await coordinateRefresh(token, true)).token;
  return true;
};

/** Phiên hết hẳn: xóa token, đang ở khu làm việc thì về màn đăng nhập rồi quay lại đúng trang. */
const endSession = () => {
  clearTokens();
  const { pathname, search } = window.location;
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const reason = deniedReason
      ? `&reason=${encodeURIComponent(deniedReason)}`
      : "";
    window.location.assign(
      `/login?redirect=${encodeURIComponent(pathname + search)}${reason}`,
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
  const expected = String(config.headers.Authorization ?? "").replace(/^Bearer /, "");
  const current = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (config.progressOwner && !ownsProgress(config.progressOwner, current)) return null;
  if (accessClaims(expected) && !sameTokenOwner(expected, current)) return null;
  const result = await coordinateRefresh(expected);
  if (!result.token) {
    if (result.ended) endSession();
    return null;
  }
  if (config.progressOwner && !ownsProgress(config.progressOwner, localStorage.getItem(ACCESS_TOKEN_KEY))) return null;
  if (accessClaims(expected) && !sameTokenOwner(expected, localStorage.getItem(ACCESS_TOKEN_KEY))) return null;
  return instance.request(config); // interceptor request tự gắn access token mới
};
