// UC13.6 - thông báo theo mã lỗi của DELETE /api/v1/users/learners/:id
export const learnerDeleteErrorMessage = (code: string | undefined): string => {
  switch (code) {
    case "LEARNER_NOT_FOUND":
      return "This learner no longer exists in your organization.";
    case "CONCURRENT_UPDATE":
      return "This learner was just updated. Please try again.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is suspended. Accounts cannot be deleted.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Your Subscription is suspended. Accounts cannot be deleted until it is renewed.";
    default:
      return "Could not delete the account. Please try again later.";
  }
};

// Tài khoản không còn trong tổ chức -> rời trang chi tiết
export const learnerDeleteShouldLeavePage = (
  code: string | undefined,
): boolean => code === "LEARNER_NOT_FOUND";
