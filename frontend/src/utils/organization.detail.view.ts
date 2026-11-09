import type { IAdminOrganizationDetail, IAdminUsageItem } from "@/types/organization.types";
import { formatFileSize, formatStorage } from "@/utils/helper";

type Tone = "neutral" | "success" | "warning" | "error" | "info";
type Organizer = NonNullable<IAdminOrganizationDetail["organizer"]>;

// UC44.1 - BR-50: Organizer Pending là Organizer đang chờ nhận lời mời (hoặc chờ thanh toán lúc đăng ký)
export const organizerStatusView = (organizer: Organizer): { label: string; tone: Tone } => {
  if (organizer.status === "Active") return { label: "Active", tone: "success" };
  if (organizer.invitation?.expired) return { label: "Invitation expired", tone: "error" };
  if (organizer.invitation) return { label: "Invitation pending", tone: "warning" };
  return { label: "Pending activation", tone: "warning" };
};

/** Byte dễ đọc: từ 1 GB dùng GB như trang gói, nhỏ hơn dùng MB / KB. */
export const formatBytes = (bytes: number) =>
  bytes === 0 || bytes >= 1024 ** 3 ? formatStorage(bytes) : formatFileSize(bytes);

/** Thanh mức dùng: tối đa 100% bề rộng, kể cả khi vượt giới hạn. */
export const usageWidth = (item: IAdminUsageItem) => `${Math.min(100, item.percent ?? 0)}%`;

/** "84 / 200" hoặc "Unavailable" khi course-service không trả lời. */
export const usageLabel = (item: IAdminUsageItem, format: (value: number) => string = String) =>
  item.used === null ? "Unavailable" : `${format(item.used)} / ${format(item.limit)}`;
