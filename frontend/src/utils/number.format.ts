export const formatNumberVN = (value: number, maximumFractionDigits = 2): string =>
  value.toLocaleString("vi-VN", { maximumFractionDigits });
