/** A number with the Vietnamese decimal comma: 75.5 -> "75,5"; minimumFractionDigits keeps "4,0" for a rating. */
export const formatNumberVN = (value: number, maximumFractionDigits = 2, minimumFractionDigits = 0): string =>
  value.toLocaleString("vi-VN", { maximumFractionDigits, minimumFractionDigits });

export const formatPercentageVN = (value: number): string => `${formatNumberVN(value)}%`;
