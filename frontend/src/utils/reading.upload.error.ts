import { isAxiosError } from "axios";

export const READING_PARSE_BUSY = "READING_PARSE_BUSY";

export interface ReadingUploadFailure {
  status?: number;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.length > 0);

/**
 * Đọc lỗi upload học liệu từ body lỗi mà courseAxios trả về như response,
 * hoặc từ lỗi Axios bị reject. Trả undefined nếu không phải lỗi HTTP.
 */
export const readReadingUploadFailure = (
  failure: unknown,
): ReadingUploadFailure | undefined => {
  const response = isAxiosError<unknown>(failure) ? failure.response : undefined;

  if (isAxiosError(failure) && !response) return undefined;

  const envelope = asRecord(response?.data ?? failure);
  const details = asRecord(envelope?.error) ?? envelope;
  const status = Number(response?.status ?? envelope?.statusCode);
  const code = firstString(details?.code, envelope?.code);

  if (!(Number.isInteger(status) && status >= 400) && !code) return undefined;

  const retryAfter = Number(
    details?.retryAfterSeconds ?? envelope?.retryAfterSeconds,
  );

  return {
    status: Number.isInteger(status) ? status : undefined,
    code,
    message: firstString(details?.message, envelope?.message),
    retryAfterSeconds:
      Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  };
};

/** Thông báo khi course-service tạm quá tải xử lý tài liệu đọc (HTTP 503). */
export const getReadingParseBusyMessage = (failure: unknown): string | undefined => {
  const parsed = readReadingUploadFailure(failure);

  if (parsed?.code !== READING_PARSE_BUSY) return undefined;

  return parsed.retryAfterSeconds
    ? `Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau ${parsed.retryAfterSeconds} giây.`
    : "Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau ít phút.";
};
