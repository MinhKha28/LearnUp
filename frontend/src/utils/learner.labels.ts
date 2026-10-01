/** Giá trị PascalCase đúng như API learning-service trả về (D39). */
export type EnrollmentType = "Required" | "Optional";

export type EnrollmentStatus =
  | "NotStarted"
  | "InProgress"
  | "Completed"
  | "Overdue"
  | "Exempted"
  | "Halted"
  | "Withdrawn";

export type MaterialType = "Video" | "Reading";

export type StatusTone = "neutral" | "success" | "warning" | "error" | "info";

export const ENROLLMENT_TYPE_LABELS: Record<EnrollmentType, string> = {
  Required: "Bắt buộc",
  Optional: "Tự chọn",
};

/** Withdrawn không hiện ở màn hình learner (D3), chỉ khai báo để không vỡ khi gặp. */
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, { label: string; tone: StatusTone }> = {
  NotStarted: { label: "Chưa bắt đầu", tone: "neutral" },
  InProgress: { label: "Đang học", tone: "info" },
  Completed: { label: "Đã hoàn thành", tone: "success" },
  Overdue: { label: "Quá hạn", tone: "error" },
  Exempted: { label: "Được miễn", tone: "neutral" },
  Halted: { label: "Tạm dừng", tone: "warning" },
  Withdrawn: { label: "Đã rút", tone: "neutral" },
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  Video: "Video",
  Reading: "Bài đọc",
};

const EMPTY = "—";

const isValidAmount = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

const formatWholeMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} phút`;
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
};

/** Thời lượng video: dưới 60 giây hiện theo giây, còn lại làm tròn xuống theo phút. */
export const formatDuration = (seconds: number | null): string => {
  if (!isValidAmount(seconds)) return EMPTY;
  if (seconds < 60) return `${Math.floor(seconds)} giây`;
  return formatWholeMinutes(Math.floor(seconds / 60));
};

/** Thời lượng ước tính theo phút, null là chưa có (D12). */
export const formatMinutes = (minutes: number | null): string => {
  if (!isValidAmount(minutes)) return EMPTY;
  return formatWholeMinutes(Math.floor(minutes));
};
