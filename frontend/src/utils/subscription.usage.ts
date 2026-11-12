export const subscriptionUsage = (
  used: number | null,
  limit: number | null | undefined,
  warningThreshold: number,
) => {
  if (used == null || limit == null || limit <= 0) {
    return { label: null, barWidth: 0, level: "ok" };
  }

  const percent = (used / limit) * 100;
  return {
    label: percent > 0 && percent < 1 ? "Dưới 1%" : `${Math.round(percent).toLocaleString("vi-VN")}%`,
    barWidth: Math.min(percent, 100),
    level: percent >= 100 ? "full" : percent >= warningThreshold ? "warning" : "ok",
  };
};
