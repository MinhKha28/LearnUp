const IANA_NAME = /^(?:UTC|[A-Z][A-Z_+-]*(?:\/[A-Z0-9][A-Z0-9_+-]*)+)$/i;

/**
 * TN3 (BR-55): dạng tên múi giờ IANA Khu_vực/Thành_phố (hoặc UTC), Intl nhận được; không phân biệt hoa thường.
 * Loại các dạng Intl vẫn chấp nhận nhưng không phải tên IANA: "+07:00", "EST".
 * Tên chuẩn để lưu lấy từ pg_timezone_names, không lấy từ Intl: Intl đổi Asia/Ho_Chi_Minh thành tên cũ Asia/Saigon.
 */
export function isIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !IANA_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
