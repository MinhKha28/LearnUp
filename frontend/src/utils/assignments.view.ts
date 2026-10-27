import type {
  Assignment,
  AssignmentStatus,
  InvalidLearner,
  AssignmentResult,
  AssignmentDetail,
} from "@/types/assignment.types";
import { formatDueAt } from "@/utils/due.format";

export const assignmentStatus: Record<
  AssignmentStatus,
  { label: string; tone: "neutral" | "info" | "success" | "error" | "warning" }
> = {
  NotStarted: { label: "Chưa bắt đầu", tone: "neutral" },
  InProgress: { label: "Đang học", tone: "info" },
  Overdue: { label: "Quá hạn", tone: "error" },
  Completed: { label: "Đã hoàn thành", tone: "success" },
  Exempted: { label: "Miễn", tone: "warning" },
  Halted: { label: "Tạm dừng", tone: "warning" },
  Withdrawn: { label: "Đã rút", tone: "neutral" },
};
export const assignmentDue = (value: string | null, timezone: string | null) =>
  value ? formatDueAt(value, timezone).text : "—";
export const assignmentProgress = (
  item: Pick<Assignment, "requiredTotal" | "requiredCompleted">,
) =>
  item.requiredTotal > 0
    ? `${item.requiredCompleted}/${item.requiredTotal} học liệu bắt buộc`
    : null;
export const assignmentDate = (
  value: string | null,
  timezone: string | null,
) => {
  if (!value) return "—";
  return (
    new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone ?? undefined,
    }).format(new Date(value)) + (timezone ? "" : " (giờ trên máy bạn)")
  );
};
export const extensionDays = (seconds: number) => seconds / 86400;

export const canExemptAssignment = (
  item: Pick<AssignmentDetail, "status" | "firstActivityAt">,
) =>
  ["InProgress", "Overdue"].includes(item.status) &&
  item.firstActivityAt !== null;
export const canExtendAssignment = (status: AssignmentStatus) =>
  !["Completed", "Withdrawn"].includes(status);

export const assignmentCalendarDay = (date: Date, timezone: string | null) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone ?? undefined,
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const addDays = (day: string, count: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
export const assignmentExtensionRange = (
  dueAt: string | null,
  timezone: string | null,
  now = new Date(),
) => {
  const today = assignmentCalendarDay(now, timezone);
  const afterCurrent = dueAt
    ? addDays(
        assignmentCalendarDay(
          new Date(new Date(dueAt).getTime() - 1),
          timezone,
        ),
        1,
      )
    : today;
  return {
    min: afterCurrent > today ? afterCurrent : today,
  };
};
export const extensionDateError = (
  day: string,
  dueAt: string | null,
  timezone: string | null,
  now = new Date(),
) => {
  if (
    dueAt &&
    day <=
      assignmentCalendarDay(new Date(new Date(dueAt).getTime() - 1), timezone)
  )
    return "DUE_DATE_NOT_LATER";
  const today = assignmentCalendarDay(now, timezone);
  if (day < today) return "DUE_DATE_IN_PAST";
  return null;
};
const messages: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  SUBSCRIPTION_NOT_ACTIVE: "Gói đăng ký của tổ chức chưa hoạt động.",
  ASSIGNMENT_NOT_FOUND: "Không tìm thấy phân công. Vui lòng quay về danh sách.",
  COURSE_NOT_ASSIGNABLE:
    "Khóa học không còn ở trạng thái có thể phân công. Vui lòng chọn lại.",
  ASSIGNMENT_INVALID_LEARNERS:
    "Không ai được phân công vì danh sách Học viên có lỗi. Hãy kiểm tra bên dưới.",
  CONCURRENT_CHANGE: "Dữ liệu vừa thay đổi. Vui lòng thử gửi lại.",
  NOT_IN_ORGANIZATION: "Học viên không thuộc tổ chức.",
  NOT_A_LEARNER: "Tài khoản không có vai trò Học viên.",
  ACCOUNT_DELETED: "Tài khoản đã bị xóa.",
  ACCOUNT_DEACTIVATED: "Tài khoản đã bị vô hiệu hóa.",
  ALREADY_ASSIGNED: "Học viên đã được phân công Khóa học này.",
  DUE_DATE_NOT_LATER: "Hạn mới phải sau hạn hiện tại.",
  DUE_DATE_IN_PAST: "Ngày hết hạn không được trước hôm nay.",
  ENROLLMENT_NOT_EXTENDABLE:
    "Trạng thái phân công đã thay đổi; không thể kéo dài hạn. Đang tải lại chi tiết.",
  ENROLLMENT_NOT_EXEMPTIBLE:
    "Trạng thái phân công đã thay đổi, có thể người khác vừa thao tác; không thể đánh dấu Miễn. Đang tải lại chi tiết.",
  VALIDATION_ERROR:
    "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.",
  VALIDATION_FAILED:
    "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.",
  NETWORK: "Không thể kết nối máy chủ. Vui lòng thử lại.",
  TIMEOUT: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
  SERVICE_UNAVAILABLE: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.",
  INTERNAL_ERROR: "Máy chủ gặp lỗi. Vui lòng thử lại.",
};
export const assignmentErrorMessage = (code: string) =>
  messages[code] ?? "Đã có lỗi xảy ra. Vui lòng thử lại.";

export const invalidAssignmentLearners = (
  details: Record<string, unknown>,
): InvalidLearner[] => {
  const errors = details.errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (value): value is InvalidLearner =>
      typeof value === "object" &&
      value !== null &&
      typeof value.learnerId === "string" &&
      [
        "NOT_IN_ORGANIZATION",
        "NOT_A_LEARNER",
        "ACCOUNT_DELETED",
        "ACCOUNT_DEACTIVATED",
        "ALREADY_ASSIGNED",
      ].includes(value.reason),
  );
};
export const assignmentResultMessage = (result: AssignmentResult) =>
  `Phân công thành công: ${result.created} tạo mới, ${result.converted} chuyển từ tự chọn, ${result.completedOnAssign} đã hoàn thành trước đó, ${result.restored} khôi phục.`;
