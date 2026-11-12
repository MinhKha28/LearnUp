import type { IAuditLogFilter } from "@/types/audit.types";

/**
 * The times of the product are Vietnam times (UTC+7, no daylight saving), and so is the day of the range filter: the screen shows Vietnam
 * time (formatDateTimeVN), so a day typed in the filter must be the day the list shows, whatever the time zone of the viewer.
 */
const VIETNAM_OFFSET = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;
export const AUDIT_PAGE_SIZE = 20;
export const AUDIT_TARGET_ID_MAX_LENGTH = 255;

/**
 * BR-336 lists what is recorded. The first three are written by tenant today; the others are the codes proposed for the actions of the list
 * (ENTITY_PAST_TENSE, like the first two) so that the screen has words ready when a service starts to write them.
 * Not in the table on purpose: the actions on an Enrollment (BR-146, BR-149, BR-170), until the word for Enrollment is chosen.
 */
const ACTION_LABELS: Record<string, string> = {
  INSTRUCTOR_DEACTIVATED: "Ngừng hoạt động tài khoản giảng viên",
  INSTRUCTOR_REACTIVATED: "Kích hoạt lại tài khoản giảng viên",
  INSTRUCTOR_DELETED: "Xóa tài khoản giảng viên",
  LEARNER_DEACTIVATED: "Ngừng hoạt động tài khoản học viên",
  LEARNER_REACTIVATED: "Kích hoạt lại tài khoản học viên",
  MEMBER_IMPORTED: "Nhập danh sách thành viên",
  LEARNER_DELETED: "Xóa tài khoản học viên",
  ACCOUNT_DELETED: "Xóa tài khoản",
  PLAN_UPDATED: "Chỉnh sửa gói dịch vụ",
  PLAN_DISCONTINUED: "Ngừng cung cấp gói dịch vụ",
  ORGANIZATION_SUSPENDED: "Tạm khóa tổ chức",
  ORGANIZATION_SUSPENSION_LIFTED: "Gỡ tạm khóa tổ chức",
  ORGANIZER_REPLACED: "Thay quản lý đào tạo",
  COURSE_APPROVED: "Phê duyệt khóa học",
  COURSE_REJECTED: "Từ chối khóa học",
  COURSE_TYPE_CHANGED: "Đổi loại khóa học",
  COURSE_OWNERSHIP_TRANSFERRED: "Chuyển quyền phụ trách khóa học",
  COURSE_DELETED: "Xóa khóa học",
  COURSE_RESTORED: "Khôi phục khóa học",
  COURSE_PURGED: "Xóa vĩnh viễn khóa học",
  MATERIAL_FILE_REPLACED: "Thay tệp học liệu",
  ARCHIVED_MATERIAL_RELEASED: "Giải phóng học liệu của phiên bản đã lưu trữ",
  CONTENT_DISABLED: "Vô hiệu hóa nội dung",
  CONTENT_REACTIVATED: "Kích hoạt lại nội dung",
  REPORT_DECIDED: "Quyết định về báo cáo",
  SCORE_FINALIZED: "Chốt điểm",
  SCORE_ADJUSTED: "Điều chỉnh điểm tổng hợp",
};

const TARGET_LABELS: Record<string, string> = {
  User: "Tài khoản",
  Organization: "Tổ chức",
  Plan: "Gói dịch vụ",
  Course: "Khóa học",
  Material: "Học liệu",
  Report: "Báo cáo",
  Submission: "Bài nộp",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên nền tảng",
  ORGANIZER: "Quản lý đào tạo",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
};

/** The action types the screen has words for (the table above). */
export const AUDIT_ACTION_CODES = Object.keys(ACTION_LABELS);

/** Suggestions for the "target type" field (the field also takes any other value). */
export const TARGET_TYPE_OPTIONS = Object.entries(TARGET_LABELS).map(([value, label]) => ({
  value,
  label: `${value === "User" ? "Tài khoản người dùng" : label} (${value})`,
}));

export const isKnownAction = (code: string) => Object.hasOwn(ACTION_LABELS, code);
export const isKnownTargetType = (code: string) => Object.hasOwn(TARGET_LABELS, code);

export const actionLabel = (code?: string | null) =>
  code ? (isKnownAction(code) ? ACTION_LABELS[code] : "Không xác định") : "—";

export const targetTypeLabel = (code: string | null) =>
  code ? (isKnownTargetType(code) ? TARGET_LABELS[code] : "Không xác định") : "—";

export const actorRoleLabel = (role: string | null) => (role ? (Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role] : "Không xác định") : "Hệ thống");

/** The first and the last characters of an id are enough to tell two people apart on a list; the full id is in the tooltip. */
export const shortId = (id: string | null) => (id ? `…${id.slice(-8)}` : "—");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `details` is a JSON text; a bad or missing one is not an error of the screen. */
export const parseAuditDetails = (details: string | null): { reason?: string } => {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    if (!isRecord(parsed)) return {};
    const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : undefined;
    return { reason };
  } catch {
    return {};
  }
};

/** A real calendar day written yyyy-MM-dd, else undefined. */
export const validDay = (value: string | null | undefined): string | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00${VIETNAM_OFFSET}`);
  if (Number.isNaN(time)) return undefined;
  return new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) === value ? value : undefined;
};

/** The instant a Vietnam day starts. */
export const dayStartInstant = (day: string) => new Date(Date.parse(`${day}T00:00:00${VIETNAM_OFFSET}`)).toISOString();

/** The server excludes `to`, so the last day included ends where the next day starts. */
export const dayEndExclusiveInstant = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00${VIETNAM_OFFSET}`) + DAY_MS).toISOString();

/** The filter as the URL carries it, made safe: bad dates and blank text are dropped. */
export const readAuditFilter = (params: URLSearchParams): IAuditLogFilter => {
  const clean = (name: string) => params.get(name)?.trim().slice(0, AUDIT_TARGET_ID_MAX_LENGTH) || undefined;
  return {
    targetResourceType: clean("type"),
    targetResourceId: clean("target"),
    from: validDay(params.get("from")),
    to: validDay(params.get("to")),
  };
};

/** True when the two days are in the wrong order (the screen does not ask the server then). */
export const rangeIsReversed = ({ from, to }: IAuditLogFilter) => Boolean(from && to && from > to);

export const hasAuditFilter = (filter: IAuditLogFilter) =>
  Boolean(filter.targetResourceType || filter.targetResourceId || filter.from || filter.to);
