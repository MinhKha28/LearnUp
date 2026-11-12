// UC13.5 - thông báo theo mã lỗi của PATCH /api/v1/users/learners/:id/status
export type LearnerStatusAction = "DEACTIVATE" | "REACTIVATE";

export const learnerStatusErrorMessage = (
  action: LearnerStatusAction,
  code: string | undefined,
): string => {
  switch (code) {
    case "ACCOUNT_NOT_ACTIVATED":
      return action === "DEACTIVATE"
        ? "Học viên này chưa kích hoạt tài khoản nên chưa thể vô hiệu hóa. Bạn có thể xóa tài khoản nếu không còn cần đến."
        : "Học viên này chưa từng kích hoạt tài khoản nên chưa thể kích hoạt lại. Bạn có thể xóa tài khoản nếu không còn cần đến.";
    case "ACCOUNT_NOT_DEACTIVATED":
      return "Chỉ có thể kích hoạt lại tài khoản đã bị vô hiệu hóa.";
    case "LEARNER_NOT_FOUND":
      return "Học viên này không còn thuộc tổ chức của bạn.";
    case "CONCURRENT_UPDATE":
      return "Thông tin học viên vừa được cập nhật. Vui lòng tải lại và thử lại.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức đang bị tạm ngưng. Không thể đổi trạng thái tài khoản.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ đang bị tạm ngưng. Hãy gia hạn gói để đổi trạng thái tài khoản.";
    default:
      return "Không thể đổi trạng thái tài khoản. Vui lòng thử lại sau.";
  }
};

// Mã lỗi mà trạng thái tài khoản trên trang đã cũ -> tải lại trang chi tiết
export const learnerStatusShouldReloadPage = (
  code: string | undefined,
): boolean =>
  code === "ACCOUNT_NOT_ACTIVATED" ||
  code === "ACCOUNT_NOT_DEACTIVATED" ||
  code === "LEARNER_NOT_FOUND" ||
  code === "CONCURRENT_UPDATE";
