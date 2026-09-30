import dayjs from "dayjs";

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
