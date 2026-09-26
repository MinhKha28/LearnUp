import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '@learnup/ts-common';
import { API_BASE_URL } from '@/config/env';
import { authStorage } from '@/auth/authStorage';
import { i18n } from '@/i18n';
import errorsVi from '@/locales/vi/errors.json';

/**
 * Centralized Axios HTTP client communicating exclusively with the Spring Cloud API Gateway.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

type TranslatedErrorCode = Exclude<keyof typeof errorsVi, 'generic'>;

/** Error codes are UPPER_SNAKE_CASE, so they never collide with camelCase keys such as 'generic'. */
const isTranslatedErrorCode = (code: unknown): code is TranslatedErrorCode =>
  typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code) && i18n.exists(code, { ns: 'errors' });

/**
 * Resolves a user-facing message for a failed request, in order of preference:
 * 1. the translation of the ApiResponse `error.code` (errors:<CODE>), when one exists;
 * 2. the server-provided `error.message`;
 * 3. `fallback`, or errors:generic when no fallback is given.
 */
export const getApiErrorMessage = (err: unknown, fallback?: string): string => {
  if (axios.isAxiosError<ApiResponse<unknown>>(err)) {
    const apiError = err.response?.data?.error;

    if (apiError && isTranslatedErrorCode(apiError.code)) {
      return i18n.t(`errors:${apiError.code}`);
    }

    const message = apiError?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback ?? i18n.t('errors:generic');
};

/**
 * Returns the payload of a successful ApiResponse envelope.
 * Otherwise throws an AxiosError carrying the response, so that its message is the ApiResponse
 * `error.message` and getApiErrorMessage can read it like any other server error.
 */
export const unwrap = <T>(
  response: AxiosResponse<ApiResponse<T>>,
  fallbackMessage = 'Unexpected API response'
): T => {
  const body = response.data;
  if (body?.success && body.data !== undefined && body.data !== null) {
    return body.data;
  }
  throw new AxiosError(
    body?.error?.message || fallbackMessage,
    AxiosError.ERR_BAD_RESPONSE,
    response.config,
    response.request,
    response
  );
};

// Request Interceptor: Attach Bearer JWT token if present
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = authStorage.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Security Rule: The frontend must NEVER construct or send X-User-ID, X-Organization-ID, X-User-Role
    return config;
  },
  (error) => Promise.reject(error)
);

// Mutex / flag to prevent concurrent refresh retry loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Seamless token refresh on 401 without infinite loops
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on auth endpoints (login, register, refresh)
    const isAuthEndpoint =
      originalRequest.url?.includes('/api/auth/login') ||
      originalRequest.url?.includes('/api/auth/refresh') ||
      originalRequest.url?.includes('/api/auth/register');

    if (isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) {
      authStorage.clearTokens();
      window.dispatchEvent(new CustomEvent('learnup:auth-expired'));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Direct axios call to avoid interceptor loop
      const refreshResponse = await axios.post(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const responseData = refreshResponse.data?.data;
      if (responseData?.accessToken && responseData?.refreshToken) {
        authStorage.setTokens(responseData.accessToken, responseData.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${responseData.accessToken}`;
        processQueue(null, responseData.accessToken);
        return apiClient(originalRequest);
      } else {
        throw new Error('Malformed refresh token response');
      }
    } catch (refreshErr) {
      processQueue(refreshErr as Error, null);
      authStorage.clearTokens();
      window.dispatchEvent(new CustomEvent('learnup:auth-expired'));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
