import type { AdminSubscriptionStatus } from "@/types/organization.types";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/utils/learner.labels";
import { subscriptionStatusViewVi } from "@/utils/organization.detail.view";

export const materialTypeText = (type: string): string =>
  Object.hasOwn(MATERIAL_TYPE_LABELS, type)
    ? MATERIAL_TYPE_LABELS[type as MaterialType]
    : "Chưa xác định";

const fileStatusLabels: Record<string, string> = {
  Pending: "Chờ xử lý",
  Ready: "Sẵn sàng",
};

export const materialFileStatusText = (status: string): string =>
  Object.hasOwn(fileStatusLabels, status) ? fileStatusLabels[status] : "Chưa xác định";

export const uploadSubscriptionStatusText = (status: string | null): string => {
  const { label } = subscriptionStatusViewVi(status as AdminSubscriptionStatus | null);
  return !status || label === "Không xác định" ? "Chưa xác định" : label;
};
