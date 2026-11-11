import type { IRubricRow } from "@/types/assessment.types";
import dayjs from "dayjs";
import type {
  ISeatUsage,
  ISubscriptionPlan,
} from "@/types/organization.types";

export const FORMATE_DATE_DEFAULT = "YYYY-MM-DD";
export const FORMATE_DATE_VN = "DD-MM-YYYY";
export const MAX_UPLOAD_IMAGE_SIZE = 2;

type DateRangeValue = [string | number | Date, string | number | Date];

export const dateRangeValidate = (dateRange?: DateRangeValue | null) => {
  if (!dateRange) return undefined;
  const startDate = dayjs(dateRange[0], FORMATE_DATE_DEFAULT).toDate();
  const endDate = dayjs(dateRange[1], FORMATE_DATE_DEFAULT).toDate();
  return [startDate, endDate];
};

// Định dạng tiền VND: 12000000 -> "12.000.000 ₫"
export const formatVnd = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount,
  );

// Đổi byte sang GB cho dễ đọc: 53687091200 -> "50 GB"
export const formatStorage = (bytes: number) => {
  const gb = bytes / 1024 ** 3;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
};

// UC01: chuyển dữ liệu gói từ API sang dạng PlanCard hiển thị (dùng ở trang chủ và trang đăng ký)
export const toPlanDetails = (plan: ISubscriptionPlan) => ({
  name: plan.name,
  description: `Sử dụng ${plan.durationDays} ngày`,
  price: formatVnd(plan.price),
  priceNote: `cho ${plan.durationDays} ngày`,
  limits: [
    ["Số học viên", String(plan.maxLearners)],
    ["Số giảng viên", String(plan.maxInstructors)],
    ["Số khóa học", String(plan.maxCourseChains)],
    ["Dung lượng lưu trữ", formatStorage(plan.maxStorageBytes)],
  ] as Array<[string, string]>,
  footer: "Giá được giữ nguyên từ lúc bạn đăng ký.",
});

export const ROLE_LABELS: Record<string, string> = {
  Admin: "Quản trị viên",
  Organizer: "Quản lý đào tạo",
  Instructor: "Giảng viên",
  Learner: "Học viên",
};

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

export const newRubricRow = (
  description = "",
  maxPoints: number | null = null,
): IRubricRow => ({
  key: crypto.randomUUID(),
  description,
  maxPoints,
});
// Ngày theo giờ Việt Nam, dạng dd/MM/yyyy: "2026-09-24T17:30:00Z" -> "25/09/2026"
export const formatDateVN = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

// Ngày giờ theo giờ Việt Nam, ngày trước giờ sau, giống formatDateVN: "2026-11-07T07:03:00Z" -> "07/11/2026 14:03".
// Không có giá trị hoặc giá trị không phải ngày giờ thì trả "-". Dùng hàm này thay cho toLocaleString("vi-VN"), vốn
// ra "14:03:18 7/11/2026" theo múi giờ của trình duyệt.
export const formatDateTimeVN = (value?: string | null) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
};


// UC12.2 (sau này UC13.2): lý do không tạo được tài khoản, theo thứ tự kiểm của backend.
// null = tạo được. seats null = chưa tải được số chỗ.
export const seatBlockReason = (
  seats: ISeatUsage | null,
  roleLabel: string,
): string | null => {
  if (!seats) return "Seat information could not be loaded.";
  if (seats.canCreate) return null;
  if (seats.subscriptionStatus === "Grace")
    return "Your Subscription is in its grace period. New accounts cannot be created until it is renewed.";
  if (seats.subscriptionStatus === "Suspended")
    return "Your Subscription is suspended. New accounts cannot be created.";
  if (seats.subscriptionStatus === null)
    return "Your Organization has no active Subscription.";
  if (seats.remaining <= 0)
    return `All ${roleLabel} seats are in use (${seats.used} / ${seats.max}).`;
  return "Your Organization is suspended. New accounts cannot be created.";
};

// UC12.2, UC12.3: chuẩn hóa giống backend (CreateAccountDto / UpdateAccountDto): NFC, trim,
// gộp khoảng trắng; email chữ thường.
export const normalizeText = (value = "") =>
  value.normalize("NFC").trim().replace(/\s+/g, " ");
export const normalizeEmail = (value = "") =>
  value.normalize("NFC").trim().toLowerCase();
const CONTROL_CHARS = /\p{Cc}/u;
// Giống backend: email gửi đi bị coi là HTML nếu có cả < và >
const ANGLE_BRACKETS = /[<>]/;

// Validator antd Form: kiểm độ dài SAU khi chuẩn hóa, giống backend
export const textRule =
  (label: string, max: number) =>
  (_: unknown, value?: string) => {
    const normalized = normalizeText(value);
    if (normalized.length > max)
      return Promise.reject(new Error(`${label} must be at most ${max} characters.`));
    if (CONTROL_CHARS.test(normalized))
      return Promise.reject(new Error(`${label} contains invalid characters.`));
    if (ANGLE_BRACKETS.test(normalized))
      return Promise.reject(new Error(`${label} cannot contain < or >.`));
    return Promise.resolve();
  };

/** 1.5 MB / 320 KB style size for file lists. */
export const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** BR-174: stored in minutes, shown converted to hours once it reaches an hour. */
export const formatMinutes = (minutes: number | null) => {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};
