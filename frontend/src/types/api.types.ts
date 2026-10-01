export interface PageMeta {
  current: number;
  pageSize: number;
  pages: number;
  total: number;
}

export interface PageResponse<T> {
  meta: PageMeta;
  items: T[];
}

export interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

/**
 * Lỗi đã chuẩn hóa của lớp gọi API learner (D38). `status` 0 là lỗi mạng hoặc timeout.
 * Màn hình chọn thông báo theo `code`, không hiện nguyên văn `message` của server.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const RETRYABLE_STATUSES = new Set([0, 502, 503, 504]);

export const isRetryableError = (error: ApiError): boolean => RETRYABLE_STATUSES.has(error.status);
