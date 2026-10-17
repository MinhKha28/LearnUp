import { ApiError } from "@/types/api.types";
import type { CreatedEnrollment } from "@/types/learning.types";

/**
 * Kết quả UC25.3 sau khi gọi POST /enrollments (D21). `refreshLinks` báo màn hình gọi lại
 * course-ids: 409 thiếu enrollmentId thì lấy nút "Vào học" từ đó.
 */
export type EnrollOutcome =
  | { kind: "enrolled"; enrollmentId: string }
  | { kind: "restored"; enrollmentId: string }
  | { kind: "notRestorable" }
  | { kind: "alreadyEnrolled"; enrollmentId: string }
  | { kind: "inGrace" }
  | { kind: "forbidden" }
  | { kind: "unavailable" }
  | { kind: "rateLimited"; retryAfterSeconds: number | null }
  | { kind: "retry"; refreshLinks: boolean };

export const ENROLL_OUTCOME_MESSAGES: Record<EnrollOutcome["kind"], string> = {
  enrolled: "Đăng ký thành công",
  restored: "Đăng ký thành công, tiến độ cũ đã được khôi phục",
  notRestorable: "Không thể đăng ký lại Course này",
  alreadyEnrolled: "Bạn đã đăng ký Course này",
  inGrace: "Tổ chức của bạn đang trong thời gian ân hạn, chưa thể đăng ký Course mới",
  forbidden: "Tổ chức của bạn hiện chưa thể đăng ký Course mới. Vui lòng liên hệ quản trị viên tổ chức.",
  unavailable: "Course không còn trong danh mục",
  rateLimited: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút",
  retry: "Chưa đăng ký được. Vui lòng thử lại.",
};

export const resolveEnrollOutcome = (result: CreatedEnrollment | ApiError): EnrollOutcome => {
  if (!(result instanceof ApiError)) {
    return { kind: result.restored ? "restored" : "enrolled", enrollmentId: result.id };
  }
  if (result.status === 409 && result.code === "ENROLLMENT_NOT_RESTORABLE") {
    return { kind: "notRestorable" };
  }
  if (result.status === 409 && result.code === "ALREADY_ENROLLED") {
    const { enrollmentId } = result.details;
    return typeof enrollmentId === "string" && enrollmentId !== ""
      ? { kind: "alreadyEnrolled", enrollmentId }
      : { kind: "retry", refreshLinks: true };
  }
  if (result.status === 403) {
    return result.code === "ORGANIZATION_IN_GRACE" ? { kind: "inGrace" } : { kind: "forbidden" };
  }
  if (result.status === 404 && result.code === "COURSE_NOT_AVAILABLE") {
    return { kind: "unavailable" };
  }
  if (result.status === 429 && result.code === "RATE_LIMITED") {
    const { retryAfterSeconds } = result.details;
    return {
      kind: "rateLimited",
      retryAfterSeconds:
        typeof retryAfterSeconds === "number" && Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : null,
    };
  }
  // Timeout có thể đã tạo Enrollment ở server; bấm lại sẽ nhận 409 và tự chuyển "Vào học"
  return { kind: "retry", refreshLinks: false };
};

export const getEnrollOutcomeMessage = (outcome: EnrollOutcome): string =>
  outcome.kind === "rateLimited" && outcome.retryAfterSeconds !== null
    ? `Bạn thao tác quá nhanh, vui lòng thử lại sau ${outcome.retryAfterSeconds} giây`
    : ENROLL_OUTCOME_MESSAGES[outcome.kind];
