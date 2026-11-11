import type { IUpgradeOption } from "@/types/subscription.types";
import { formatStorage, formatVnd } from "@/utils/helper";

export const formatCount = (value: number) => value.toLocaleString("vi-VN");

const LIMIT_LABELS: Record<string, string> = {
  learners: "Số học viên",
  instructors: "Số giảng viên",
  courses: "Số khóa học",
  storageBytes: "Dung lượng lưu trữ",
};

export const planLimitsLine = (
  plan: Pick<
    IUpgradeOption,
    "maxLearners" | "maxInstructors" | "maxCourseChains" | "maxStorageBytes"
  >,
) =>
  `${formatCount(plan.maxLearners)} học viên · ${formatCount(plan.maxInstructors)} giảng viên · ${formatCount(plan.maxCourseChains)} khóa học · ${formatStorage(plan.maxStorageBytes)}`;

export const planPriceLine = (plan: IUpgradeOption) =>
  `${formatVnd(plan.price)} / ${formatCount(plan.durationDays)} ngày`;

export const upgradeFormulaLine = (
  plan: IUpgradeOption,
  held: { price: number; durationDays: number },
  remainingDays: number,
) => {
  const daily = (price: number, days: number) =>
    `${formatVnd(price)} ÷ ${formatCount(days)} ngày`;
  return `(${daily(plan.price, plan.durationDays)} − ${daily(held.price, held.durationDays)}) × ${formatCount(remainingDays)} ngày còn lại, làm tròn lên = ${formatVnd(plan.amount)}`;
};

export const blockedLimitLines = (blockedBy: IUpgradeOption["blockedBy"]) =>
  blockedBy.map(({ limit, newLimit, required }) => {
    const label = LIMIT_LABELS[limit] ?? limit;
    return limit === "storageBytes"
      ? `${label}: ${formatStorage(newLimit)} thấp hơn mức cần ${formatStorage(required)}`
      : `${label}: ${formatCount(newLimit)} thấp hơn mức cần ${formatCount(required)}`;
  });

export const upgradeBlockedMessage = (reason: string | null) => {
  switch (reason) {
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Chỉ nâng cấp được khi gói dịch vụ đang hoạt động. Hãy gia hạn trước.";
    case "RENEWAL_ALREADY_SCHEDULED":
      return "Đã có một kỳ gia hạn được thanh toán và đang chờ bắt đầu. Bạn có thể nâng cấp sau khi kỳ đó bắt đầu.";
    default:
      return null;
  }
};

export const UPGRADE_NOT_APPLIED = "UPGRADE_NOT_APPLIED";

export const upgradeErrorMessage = (code: string | undefined) => {
  switch (code) {
    case UPGRADE_NOT_APPLIED:
      return "Thanh toán của bạn đã được ghi nhận nhưng chưa nâng cấp được. Đừng thanh toán lần nữa, hãy liên hệ bộ phận hỗ trợ.";
    case "UPGRADE_LIMITS_TOO_LOW":
      return "Giới hạn của gói này thấp hơn mức bạn đang dùng hoặc đang có.";
    case "PLAN_NOT_AVAILABLE":
      return "Gói này không còn được cung cấp. Hãy chọn gói khác.";
    case "USAGE_UNAVAILABLE":
      return "Chưa kiểm tra được số khóa học và dung lượng đang dùng. Vui lòng thử lại sau.";
    case "RENEWAL_IN_PROGRESS":
      return "Một thay đổi khác của gói dịch vụ đang được xử lý. Vui lòng thử lại.";
    case "SUBSCRIPTION_NOT_ACTIVE":
    case "RENEWAL_ALREADY_SCHEDULED":
      return upgradeBlockedMessage(code) as string;
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức của bạn không ở trạng thái hoạt động nên không nâng cấp được gói dịch vụ.";
    default:
      return "Chưa xử lý được yêu cầu nâng cấp. Vui lòng thử lại sau.";
  }
};
