// UC12.5 - thông báo theo mã lỗi của PATCH /api/v1/users/instructors/:id/status
export type StatusAction = "DEACTIVATE" | "REACTIVATE";

export const instructorStatusErrorMessage = (
  action: StatusAction,
  code: string | undefined,
): string => {
  switch (code) {
    case "ACCOUNT_NOT_ACTIVATED":
      return action === "DEACTIVATE"
        ? "Giảng viên này chưa kích hoạt tài khoản nên chưa thể vô hiệu hóa. Bạn có thể xóa tài khoản nếu không còn cần đến."
        : "Giảng viên này chưa từng kích hoạt tài khoản nên chưa thể kích hoạt lại. Bạn có thể xóa tài khoản nếu không còn cần đến.";
    case "ACCOUNT_NOT_DEACTIVATED":
      return "Chỉ có thể kích hoạt lại tài khoản đã bị vô hiệu hóa.";
    case "RECEIVER_REQUIRED":
      return "Giảng viên này vẫn phụ trách khóa học. Hãy chọn giảng viên tiếp nhận.";
    case "INVALID_RECEIVER":
      return "Giảng viên đã chọn không còn có thể tiếp nhận các khóa học này. Hãy chọn giảng viên khác.";
    case "NO_VALID_RECEIVER":
      return "Không có giảng viên đang hoạt động nào khác trong tổ chức có thể tiếp nhận các khóa học này.";
    case "MANAGED_COURSES_REMAINING":
      return "Giảng viên này vừa được giao thêm khóa học. Hãy kiểm tra lại danh sách và thử lại.";
    case "COURSE_SERVICE_UNAVAILABLE":
      return "Tạm thời không xem được thông tin khóa học. Vui lòng thử lại sau.";
    case "INSTRUCTOR_NOT_FOUND":
      return "Giảng viên này không còn thuộc tổ chức của bạn.";
    case "CONCURRENT_UPDATE":
      return "Thông tin giảng viên vừa được cập nhật. Vui lòng tải lại và thử lại.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức đang bị tạm ngưng. Không thể đổi trạng thái tài khoản.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ đang bị tạm ngưng. Hãy gia hạn gói để đổi trạng thái tài khoản.";
    default:
      return "Không thể đổi trạng thái tài khoản. Vui lòng thử lại sau.";
  }
};

// Mã lỗi mà danh sách Course / người tiếp nhận trong modal đã cũ -> tải lại dữ liệu modal
export const instructorStatusShouldReloadPreview = (
  code: string | undefined,
): boolean =>
  code === "RECEIVER_REQUIRED" ||
  code === "INVALID_RECEIVER" ||
  code === "NO_VALID_RECEIVER" ||
  code === "MANAGED_COURSES_REMAINING";

// Mã lỗi mà trạng thái tài khoản trên trang đã cũ -> tải lại trang chi tiết
export const instructorStatusShouldReloadPage = (
  code: string | undefined,
): boolean =>
  code === "ACCOUNT_NOT_ACTIVATED" ||
  code === "ACCOUNT_NOT_DEACTIVATED" ||
  code === "INSTRUCTOR_NOT_FOUND" ||
  code === "CONCURRENT_UPDATE";
