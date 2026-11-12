// UC13.6 - thông báo theo mã lỗi của DELETE /api/v1/users/learners/:id
export const learnerDeleteErrorMessage = (code: string | undefined): string => {
  switch (code) {
    case "LEARNER_NOT_FOUND":
      return "Học viên này không còn thuộc tổ chức của bạn.";
    case "CONCURRENT_UPDATE":
      return "Thông tin Học viên vừa được cập nhật. Vui lòng thử lại.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức đang bị tạm ngưng. Không thể xóa tài khoản.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ đang bị tạm ngưng. Hãy gia hạn gói để xóa tài khoản.";
    default:
      return "Không thể xóa tài khoản. Vui lòng thử lại sau.";
  }
};

// Tài khoản không còn trong tổ chức -> rời trang chi tiết
export const learnerDeleteShouldLeavePage = (
  code: string | undefined,
): boolean => code === "LEARNER_NOT_FOUND";
