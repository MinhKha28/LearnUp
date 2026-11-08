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
      return "This instructor no longer exists in your organization.";
    case "CONCURRENT_UPDATE":
      return "This instructor was just updated. Please review and try again.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is suspended. Accounts cannot be deleted.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Your Subscription is suspended. Accounts cannot be deleted until it is renewed.";
    // Mã chuyển quyền BR-41 dùng chung câu với UC12.5.
    case "RECEIVER_REQUIRED":
    case "INVALID_RECEIVER":
    case "NO_VALID_RECEIVER":
    case "MANAGED_COURSES_REMAINING":
    case "COURSE_SERVICE_UNAVAILABLE":
      return instructorStatusErrorMessage("DEACTIVATE", code);
    default:
      return "Could not delete the account. Please try again later.";
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
