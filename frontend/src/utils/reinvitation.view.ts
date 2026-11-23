export type InvitedRole = "Instructor" | "Learner";

const ROLE_WORD: Record<InvitedRole, string> = {
  Instructor: "Giảng viên",
  Learner: "Học viên",
};

export const reinvitationErrorMessage = (
  role: InvitedRole,
  code: string | undefined,
): string => {
  switch (code) {
    case "ACCOUNT_NOT_PENDING":
      return `${ROLE_WORD[role]} này không còn chờ kích hoạt nên lời mời không được gửi.`;
    case "INSTRUCTOR_NOT_FOUND":
    case "LEARNER_NOT_FOUND":
      return `${ROLE_WORD[role]} này không còn trong tổ chức của bạn.`;
    case "CONCURRENT_UPDATE":
      return `${ROLE_WORD[role]} này vừa được cập nhật. Hãy tải lại trang rồi thử lại.`;
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức của bạn đang bị tạm khóa nên không gửi được lời mời.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ đang tạm ngưng nên không gửi được lời mời cho tới khi gia hạn.";
    default:
      return "Chưa gửi lại được lời mời. Vui lòng thử lại sau.";
  }
};

export const reinvitationShouldReload = (code: string | undefined): boolean =>
  code === "ACCOUNT_NOT_PENDING" || code === "CONCURRENT_UPDATE";
