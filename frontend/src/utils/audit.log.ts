import type { IAuditLog, IAuditLogFilter } from "@/types/audit.types";

/** The times of the product are Vietnam times (UTC+7, no daylight saving). */
const VIETNAM_OFFSET = "+07:00";
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;
export const AUDIT_PAGE_SIZE = 20;
export const AUDIT_TARGET_ID_MAX_LENGTH = 255;

/** BR-336 lists what is recorded; these are the action types the services write today. Any other code is shown as it is. */
const ACTION_LABELS: Record<string, string> = {
  INSTRUCTOR_DEACTIVATED: "Ngừng hoạt động tài khoản giảng viên",
  INSTRUCTOR_REACTIVATED: "Kích hoạt lại tài khoản giảng viên",
};

const TARGET_LABELS: Record<string, string> = {
  User: "Tài khoản",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên nền tảng",
  ORGANIZER: "Quản trị viên tổ chức",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
};

/** Suggestions for the "target type" field (the field also takes any other value). */
export const TARGET_TYPE_OPTIONS = Object.entries(TARGET_LABELS).map(([value, label]) => ({
  value,
  label: `${label} (${value})`,
}));

export const actionLabel = (code: string) => ACTION_LABELS[code] ?? code;

export const targetTypeLabel = (code: string | null) => (code ? (TARGET_LABELS[code] ?? code) : "—");

export const actorRoleLabel = (role: string | null) => (role ? (ROLE_LABELS[role] ?? role) : "Hệ thống");

/** The first and the last characters of an id are enough to tell two people apart on a list; the full id is in the tooltip. */
export const shortId = (id: string | null) => (id ? `…${id.slice(-8)}` : "—");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `details` is a JSON text; a bad or missing one is not an error of the screen. */
export const parseAuditDetails = (details: string | null): { reason?: string; occurredAt?: string } => {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    if (!isRecord(parsed)) return {};
    const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : undefined;
    const occurredAt =
      typeof parsed.occurredAt === "string" && !Number.isNaN(Date.parse(parsed.occurredAt)) ? parsed.occurredAt : undefined;
    return { reason, occurredAt };
  } catch {
    return {};
  }
};

/** The time of the action when the service said it, else the time audit-service received the entry. */
export const auditTime = (log: Pick<IAuditLog, "details" | "createdAt">) =>
  parseAuditDetails(log.details).occurredAt ?? log.createdAt;

export const formatAuditTime = (value: string) => {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(time);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
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
