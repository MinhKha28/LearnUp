const IANA_NAME = /^(?:UTC|[A-Z][A-Za-z_+-]*(?:\/[A-Z0-9][A-Za-z0-9_+-]*)+)$/;

/**
 * TN3 (BR-55): chỉ nhận tên múi giờ IANA dạng Khu_vực/Thành_phố (hoặc UTC) mà Intl nhận được.
 * Loại các dạng Intl vẫn chấp nhận nhưng không phải tên IANA: "+07:00", "EST", "asia/tokyo".
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
