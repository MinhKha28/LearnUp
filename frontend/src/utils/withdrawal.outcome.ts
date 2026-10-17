import { ApiError } from "@/types/api.types";
import type { MyEnrollmentItem, WithdrawalResult } from "@/types/learning.types";

export const canWithdrawEnrollment = (item: Pick<MyEnrollmentItem, "enrollmentType" | "status">): boolean =>
  item.enrollmentType === "Optional" &&
  (item.status === "NotStarted" || item.status === "InProgress" || item.status === "Halted");

export const WITHDRAWAL_CONFIRMATION =
  "Nếu bạn chưa làm Quiz, chưa nộp bài và chưa chấm chéo, toàn bộ tiến độ của Course này sẽ bị xóa. Nếu đã có, tiến độ được giữ lại để bạn đăng ký lại sau.";

export const WITHDRAWAL_MESSAGES = {
  deleted: "Đã rút khỏi Course",
  withdrawn: "Đã rút khỏi Course. Tiến độ được giữ lại nếu bạn đăng ký lại",
  notFound: "Course này không còn trong danh sách của bạn",
  required: "Course được phân công không thể tự rút",
  completed: "Course đã hoàn thành không thể rút",
  unavailable: "Chưa kiểm tra được kết quả đánh giá, vui lòng thử lại",
  retry: "Chưa rút được khỏi Course, vui lòng thử lại",
} as const;

export type WithdrawalOutcome = {
  kind: keyof typeof WITHDRAWAL_MESSAGES;
  reload: boolean;
  retry: boolean;
};

export const resolveWithdrawalOutcome = (result: WithdrawalResult | ApiError): WithdrawalOutcome => {
  if (!(result instanceof ApiError)) {
    if (result.outcome === "DELETED") return { kind: "deleted", reload: true, retry: false };
    if (result.outcome === "WITHDRAWN") return { kind: "withdrawn", reload: true, retry: false };
  } else {
    if (result.status === 404 && result.code === "ENROLLMENT_NOT_FOUND") {
      return { kind: "notFound", reload: true, retry: false };
    }
    if (result.status === 409 && result.code === "ENROLLMENT_NOT_WITHDRAWABLE") {
      if (result.details.reason === "REQUIRED") return { kind: "required", reload: false, retry: false };
      if (result.details.reason === "COMPLETED") return { kind: "completed", reload: false, retry: false };
    }
    if (result.status === 503 && result.code === "ASSESSMENT_UNAVAILABLE") {
      return { kind: "unavailable", reload: false, retry: true };
    }
  }
  return { kind: "retry", reload: false, retry: true };
};
