type SubmitErrorBody = {
  code?: string;
  message?: string | string[];
};

export const getSubmitErrorCode = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;

  const value = response as Record<string, unknown>;
  if (typeof value.code === "string") return value.code;

  if (value.error && typeof value.error === "object") {
    const error = value.error as SubmitErrorBody;
    if (typeof error.code === "string") return error.code;
  }

  if (value.response && typeof value.response === "object") {
    const nested = value.response as Record<string, unknown>;
    return getSubmitErrorCode(nested.data ?? nested);
  }

  return null;
};

const submitErrorMessages: Record<string, string> = {
  INCOMPLETE_COURSE:
    "Vui lòng hoàn thiện thông tin khóa học bắt buộc trước khi gửi phê duyệt.",
  QUIZ_WITHOUT_QUESTIONS:
    "Một hoặc nhiều bài trắc nghiệm chưa có câu hỏi. Vui lòng kiểm tra trước khi gửi phê duyệt.",
  COURSE_CHANGED:
    "Khóa học đã có thay đổi. Vui lòng tải lại trang và thử lại.",
  ASSESSMENT_UNAVAILABLE:
    "Không thể xác minh bài trắc nghiệm của khóa học. Vui lòng thử lại sau.",
  INVALID_ASSESSMENT_RESPONSE:
    "Không thể xác minh bài trắc nghiệm của khóa học. Vui lòng thử lại sau.",
  INVALID_COURSE_STATUS:
    "Chỉ có thể gửi phê duyệt khóa học ở trạng thái bản nháp hoặc bị từ chối.",
  FORBIDDEN:
    "Bạn không có quyền gửi phê duyệt khóa học này.",
};

export const getSubmitErrorMessage = (response: unknown): string => {
  const code = getSubmitErrorCode(response);
  return (code && submitErrorMessages[code]) ||
    "Không thể gửi khóa học phê duyệt. Vui lòng thử lại.";
};

