export const getWithdrawErrorCode = (response: unknown): string | null => {
  if (!response || typeof response !== "object") {
    return null;
  }

  const value = response as Record<string, unknown>;

  if (typeof value.code === "string") {
    return value.code;
  }

  if (value.error && typeof value.error === "object") {
    const error = value.error as Record<string, unknown>;

    if (typeof error.code === "string") {
      return error.code;
    }
  }

  if (value.response && typeof value.response === "object") {
    const nested = value.response as Record<string, unknown>;
    return getWithdrawErrorCode(nested.data ?? nested);
  }

  return null;
};

const errorMessages: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền thu hồi khóa học này.",
  COURSE_NOT_FOUND: "Không tìm thấy khóa học.",
  INVALID_COURSE_STATUS:
    "Chỉ có thể thu hồi khóa học đang chờ phê duyệt.",
  COURSE_CHANGED: "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang và thử lại.",
};

export const getWithdrawErrorMessage = (response: unknown): string => {
  const code = getWithdrawErrorCode(response);

  return (
    (code && errorMessages[code]) ||
    "Không thể thu hồi khóa học. Vui lòng thử lại."
  );
};
