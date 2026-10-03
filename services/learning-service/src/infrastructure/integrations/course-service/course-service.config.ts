export interface CourseServiceConfig {
  baseUrl: string;
  internalKey: string;
  timeoutMs: number;
}

/**
 * Đọc cấu hình gọi course-service; thiếu hoặc sai thì ném lỗi để service từ chối khởi động.
 * Thông báo lỗi không chứa giá trị của khóa nội bộ.
 */
export function readCourseServiceConfig(
  get: (key: string) => string | undefined,
): CourseServiceConfig {
  const baseUrl = get('COURSE_SERVICE_URL')?.trim();
  const internalKey = get('INTERNAL_SERVICE_KEY')?.trim();
  const rawTimeout = get('COURSE_SERVICE_TIMEOUT_MS')?.trim();

  const missing = [
    ['COURSE_SERVICE_URL', baseUrl],
    ['INTERNAL_SERVICE_KEY', internalKey],
    ['COURSE_SERVICE_TIMEOUT_MS', rawTimeout],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Thiếu biến môi trường để gọi course-service: ${missing.join(', ')}.`,
    );
  }

  let url: URL;
  try {
    url = new URL(baseUrl!);
  } catch {
    throw new Error(
      `COURSE_SERVICE_URL không phải URL hợp lệ: "${baseUrl}". Ví dụ: http://localhost:8083`,
    );
  }

  const timeoutMs = Number(rawTimeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      `COURSE_SERVICE_TIMEOUT_MS phải là số nguyên dương (mili giây), nhận được "${rawTimeout}".`,
    );
  }

  return {
    baseUrl: url.origin + url.pathname.replace(/\/+$/, ''),
    internalKey: internalKey!,
    timeoutMs,
  };
}
