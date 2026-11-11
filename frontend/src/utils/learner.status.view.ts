// UC13.5 - thông báo theo mã lỗi của PATCH /api/v1/users/learners/:id/status
export type LearnerStatusAction = "DEACTIVATE" | "REACTIVATE";

export const learnerStatusErrorMessage = (
  action: LearnerStatusAction,
  code: string | undefined,
): string => {
  switch (code) {
    case "ACCOUNT_NOT_ACTIVATED":
      return action === "DEACTIVATE"
        ? "This learner has not activated the account yet, so it cannot be deactivated. Delete the account instead if it is no longer needed."
        : "This learner never activated the account, so it cannot be reactivated. Delete the account instead if it is no longer needed.";
    case "ACCOUNT_NOT_DEACTIVATED":
      return "Only a deactivated account can be reactivated.";
    case "LEARNER_NOT_FOUND":
      return "This learner no longer exists in your organization.";
    case "CONCURRENT_UPDATE":
      return "This learner was just updated. Please reload and try again.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is suspended. Account status cannot be changed.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Your Subscription is suspended. Account status cannot be changed until it is renewed.";
    default:
      return "Could not change the account status. Please try again later.";
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
