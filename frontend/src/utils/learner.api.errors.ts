export const LEARNER_API_ERROR_FALLBACK = "Không thực hiện được thao tác. Vui lòng thử lại.";

const platformMessages = new Map<string, string>([
  ["UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
  ["FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."],
  ["RESOURCE_NOT_FOUND", "Không tìm thấy dữ liệu."],
  ["VALIDATION_ERROR", "Thông tin gửi lên không hợp lệ."],
  ["VALIDATION_FAILED", "Thông tin gửi lên không hợp lệ."],
  ["CONFLICT", "Dữ liệu đã thay đổi. Vui lòng thử lại."],
  ["BAD_REQUEST", "Yêu cầu không hợp lệ."],
  ["INTERNAL_ERROR", "Máy chủ gặp lỗi. Vui lòng thử lại."],
]);

export const learnerPlatformErrorText = (code?: string): string | undefined =>
  code ? platformMessages.get(code) : undefined;
