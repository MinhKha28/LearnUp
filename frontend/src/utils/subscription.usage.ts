import type { IUsageItem } from "@/types/subscription.types";

type Usage = Pick<IUsageItem, "used" | "warning"> & { limit?: number | null };

export const subscriptionUsage = ({ used, limit, warning }: Usage) => {
  const full = used != null && limit != null && used >= limit && (limit > 0 || used > 0);
  const level = full ? "full" : warning ? "warning" : "ok";

  if (used == null || limit == null) {
    return { label: null, barWidth: 0, level };
  }
  if (limit <= 0) {
    return full ? { label: "100%", barWidth: 100, level } : { label: null, barWidth: 0, level };
  }

  const percent = (used / limit) * 100;
  const rounded = Math.round(percent);
  const label = percent > 0 && percent < 1
    ? "Dưới 1%"
    : used < limit && rounded === 100
      ? "Trên 99%"
      : `${rounded.toLocaleString("vi-VN")}%`;
  return { label, barWidth: Math.min(percent, 100), level };
};
