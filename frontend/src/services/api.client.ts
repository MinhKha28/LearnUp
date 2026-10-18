import axios from "axios";
import { retryWithFreshToken } from "@/services/auth.session";

import { ApiError, type ApiEnvelope } from "@/types/api.types";

const API_PREFIX = "/api/v1";

/** Đường dẫn 7 endpoint của 6 UC learner; khi gateway đổi tiền tố chỉ sửa ở đây. */
export const API_PATHS = {
  catalog: `${API_PREFIX}/courses/catalog`,
  courseIntroduction: (courseId: string) =>
    `${API_PREFIX}/courses/${encodeURIComponent(courseId)}/introduction`,
  myCourseIds: `${API_PREFIX}/enrollments/me/course-ids`,
  enroll: `${API_PREFIX}/enrollments`,
  withdrawal: (enrollmentId: string) =>
    `${API_PREFIX}/enrollments/${encodeURIComponent(enrollmentId)}/withdrawal`,
  myEnrollments: `${API_PREFIX}/enrollments/me`,
  curriculum: (enrollmentId: string) =>
    `${API_PREFIX}/enrollments/${encodeURIComponent(enrollmentId)}/curriculum`,
  lesson: (enrollmentId: string, lessonId: string) =>
    `${API_PREFIX}/enrollments/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}`,
} as const;

// Proxy danh tính dev (D37): đi qua dev server; bản build luôn dùng VITE_BACKEND_URL
const baseURL =
  import.meta.env.DEV && import.meta.env.VITE_DEV_IDENTITY_PROXY === "1"
    ? ""
    : import.meta.env.VITE_BACKEND_URL;

const client = axios.create({ baseURL, timeout: 10000 });
export const apiRequestUrl = (path: string) =>
  `${baseURL?.replace(/\/+$/, "") ?? ""}${path}`;

// Kiểu phản hồi thô; src/types/axios.d.ts biến AxiosResponse thành thenable nên không dùng trực tiếp được
type RawResponse<T> = { data: ApiEnvelope<T> };

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// UC05: 401 do access token hết hạn -> làm mới rồi gửi lại; lỗi khác vẫn ném ra như cũ
client.interceptors.response.use(undefined, async (error: unknown) => {
  const retried = await retryWithFreshToken(client, error);
  return retried ?? Promise.reject(error);
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const firstString = (...values: unknown[]): string | undefined =>
  values.find(
    (value): value is string =>
      typeof value === "string" && value.trim() !== "",
  );

const toMessageList = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;

/**
 * Chuyển mọi lỗi của axios về ApiError. Request bị hủy được ném lại nguyên vẹn
 * để nơi gọi bỏ qua, không hiện thành lỗi.
 */
export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }
  if (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
  ) {
    throw error;
  }

  const response = axios.isAxiosError(error) ? error.response : undefined;
  if (!response) {
    const code = axios.isAxiosError(error) ? error.code : undefined;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      return new ApiError(0, "TIMEOUT", "Request timed out");
    }
    return new ApiError(0, "NETWORK", "Network error");
  }

  const { status } = response;
  const body: Record<string, unknown> = isRecord(response.data)
    ? response.data
    : {};
  const bodyError = isRecord(body.error) ? body.error : undefined;

  if (bodyError && typeof bodyError.code === "string") {
    const { code, message, ...details } = bodyError;
    return new ApiError(status, code, firstString(message) ?? "", details);
  }

  // Nest mặc định để mảng ở body.message; HttpExceptionFilter của service bọc nó trong body.error
  const validationMessages =
    toMessageList(body.message) ?? toMessageList(bodyError?.message);
  if (status === 400 && validationMessages) {
    return new ApiError(
      status,
      "VALIDATION_FAILED",
      validationMessages.join("; "),
    );
  }

  const message =
    firstString(
      bodyError?.message,
      body.message,
      body.error,
      axios.isAxiosError(error) ? error.message : undefined,
    ) ?? `HTTP ${status}`;
  return new ApiError(status, `HTTP_${status}`, message);
};

export const apiGet = async <T>(
  path: string,
  options: { params?: Record<string, unknown>; signal?: AbortSignal } = {},
): Promise<T> => {
  try {
    const response = await client.get<ApiEnvelope<T>, RawResponse<T>>(
      path,
      options,
    );
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
};

export const apiPost = async <T>(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> => {
  try {
    const response = await client.post<ApiEnvelope<T>, RawResponse<T>>(
      path,
      body,
      options,
    );
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
};

export const apiPatch = async <T>(path: string, body: unknown): Promise<T> => {
  try {
    const response = await client.patch<ApiEnvelope<T>, RawResponse<T>>(
      path,
      body,
    );
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
};
