import type {
  AdminOrganizationStatus,
  AdminSubscriptionStatus,
  IAdminOrganizationDetail,
  IAdminUsageItem,
} from "@/types/organization.types";
import { formatFileSize, formatStorage } from "@/utils/helper";

type Tone = "neutral" | "success" | "warning" | "error" | "info";
const statusFallback = (value?: string | null): { label: string; tone: Tone } => ({
  label: value ? "Không xác định" : "—",
  tone: "neutral",
});

type Organizer = NonNullable<IAdminOrganizationDetail["organizer"]>;

// UC44.1 - trạng thái Organization (BR-8, BR-56) và Subscription (BR-22, BR-23, BR-60) trên trang chi tiết.
// Dùng chung cho danh sách và chi tiết tổ chức.
const organizationStatuses: Record<AdminOrganizationStatus, { label: string; tone: Tone }> = {
  PendingPayment: { label: "Chờ thanh toán", tone: "warning" },
  Active: { label: "Đang hoạt động", tone: "success" },
  Suspended: { label: "Tạm khóa", tone: "error" },
  Cancelled: { label: "Đã hủy", tone: "neutral" },
};

const subscriptionStatuses: Record<AdminSubscriptionStatus, { label: string; tone: Tone }> = {
  Active: { label: "Đang hoạt động", tone: "info" },
  Grace: { label: "Trong thời gian ân hạn", tone: "warning" },
  Suspended: { label: "Tạm ngưng", tone: "error" },
};

export const organizationStatusViewVi = (status?: AdminOrganizationStatus | null) =>
  status && Object.hasOwn(organizationStatuses, status) ? organizationStatuses[status] : statusFallback(status);

export const subscriptionStatusViewVi = (status?: AdminSubscriptionStatus | null) =>
  status && Object.hasOwn(subscriptionStatuses, status) ? subscriptionStatuses[status] : statusFallback(status);

// UC44.1 - BR-50: Organizer Pending là Organizer đang chờ nhận lời mời (hoặc chờ thanh toán lúc đăng ký)
export const organizerStatusView = (organizer: Organizer): { label: string; tone: Tone } => {
  if (organizer.status === "Active") return { label: "Đang hoạt động", tone: "success" };
  if (organizer.invitation?.expired) return { label: "Lời mời đã hết hạn", tone: "error" };
  if (organizer.invitation) return { label: "Đang chờ nhận lời mời", tone: "warning" };
  return { label: "Chờ kích hoạt", tone: "warning" };
};

/** Byte dễ đọc: từ 1 GB dùng GB như trang gói, nhỏ hơn dùng MB / KB. */
export const formatBytes = (bytes: number) =>
  bytes === 0 || bytes >= 1024 ** 3 ? formatStorage(bytes) : formatFileSize(bytes);

/** Thanh mức dùng: tối đa 100% bề rộng, kể cả khi vượt giới hạn. */
export const usageWidth = (item: IAdminUsageItem) => `${Math.min(100, item.percent ?? 0)}%`;

/** "84 / 200" hoặc "Chưa có số liệu" khi course-service không trả lời. */
export const usageLabel = (item: IAdminUsageItem, format: (value: number) => string = (value) => value.toLocaleString("vi-VN")) =>
  item.used === null ? "Chưa có số liệu" : `${format(item.used)} / ${format(item.limit)}`;
