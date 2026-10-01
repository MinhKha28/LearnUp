import dayjs from "dayjs";
import type { ISubscriptionPlan } from "@/types/organization.types";

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
  description: `${plan.durationDays} days of access`,
  price: formatVnd(plan.price),
  priceNote: `for ${plan.durationDays} days`,
  limits: [
    ["Learner seats", String(plan.maxLearners)],
    ["Instructor seats", String(plan.maxInstructors)],
    ["Courses", String(plan.maxCourseChains)],
    ["Storage", formatStorage(plan.maxStorageBytes)],
  ] as Array<[string, string]>,
  footer: "The price is locked in when you register.",
});
