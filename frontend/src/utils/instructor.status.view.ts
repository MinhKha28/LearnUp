// UC12.5 - thông báo theo mã lỗi của PATCH /api/v1/users/instructors/:id/status
export type StatusAction = "DEACTIVATE" | "REACTIVATE";

export const instructorStatusErrorMessage = (
  action: StatusAction,
  code: string | undefined,
): string => {
  switch (code) {
    case "ACCOUNT_NOT_ACTIVATED":
      return action === "DEACTIVATE"
        ? "This instructor has not activated the account yet, so it cannot be deactivated. Delete the account instead if it is no longer needed."
        : "This instructor never activated the account, so it cannot be reactivated. Delete the account instead if it is no longer needed.";
    case "ACCOUNT_NOT_DEACTIVATED":
      return "Only a deactivated account can be reactivated.";
    case "RECEIVER_REQUIRED":
      return "This instructor still manages courses. Choose an instructor to take them over.";
    case "INVALID_RECEIVER":
      return "The selected instructor can no longer take over these courses. Choose another instructor.";
    case "NO_VALID_RECEIVER":
      return "No other active instructor in your organization can take over these courses.";
    case "MANAGED_COURSES_REMAINING":
      return "This instructor has just been given more courses. Review the list and try again.";
    case "COURSE_SERVICE_UNAVAILABLE":
      return "Course information is temporarily unavailable. Please try again later.";
    case "INSTRUCTOR_NOT_FOUND":
      return "This instructor no longer exists in your organization.";
    case "CONCURRENT_UPDATE":
      return "This instructor was just updated. Please reload and try again.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is suspended. Account status cannot be changed.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Your Subscription is suspended. Account status cannot be changed until it is renewed.";
    default:
      return "Could not change the account status. Please try again later.";
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
