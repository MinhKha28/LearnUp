// UC12.6 - thông báo theo mã lỗi của DELETE /api/v1/users/instructors/:id
import {
  instructorStatusErrorMessage,
  instructorStatusShouldReloadPreview,
} from "@/utils/instructor.status.view";

export const instructorDeleteErrorMessage = (
  code: string | undefined,
): string => {
  switch (code) {
    case "INSTRUCTOR_NOT_FOUND":
      return "Giảng viên này không còn thuộc tổ chức của bạn.";
    case "CONCURRENT_UPDATE":
      return "Thông tin giảng viên vừa được cập nhật. Vui lòng kiểm tra và thử lại.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức đang bị tạm ngưng. Không thể xóa tài khoản.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ đang bị tạm ngưng. Hãy gia hạn gói để xóa tài khoản.";
    // Mã chuyển quyền BR-51 dùng chung câu với UC12.5.
    case "RECEIVER_REQUIRED":
    case "INVALID_RECEIVER":
    case "NO_VALID_RECEIVER":
    case "MANAGED_COURSES_REMAINING":
    case "COURSE_SERVICE_UNAVAILABLE":
      return instructorStatusErrorMessage("DEACTIVATE", code);
    default:
      return "Không thể xóa tài khoản. Vui lòng thử lại sau.";
  }
};

// Danh sách Course / người tiếp nhận trong dialog đã cũ -> tải lại dữ liệu dialog
export const instructorDeleteShouldReloadPreview = (
  code: string | undefined,
): boolean =>
  instructorStatusShouldReloadPreview(code) || code === "CONCURRENT_UPDATE";

// Tài khoản không còn trong tổ chức -> rời trang chi tiết
export const instructorDeleteShouldLeavePage = (
  code: string | undefined,
): boolean => code === "INSTRUCTOR_NOT_FOUND";
