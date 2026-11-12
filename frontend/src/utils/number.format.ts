export const formatNumberVN = (value: number, maximumFractionDigits = 2): string =>
  value.toLocaleString("vi-VN", { maximumFractionDigits });

export const formatPercentageVN = (value: number): string => `${formatNumberVN(value)}%`;
