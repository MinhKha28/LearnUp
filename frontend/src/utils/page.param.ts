import type { PageMeta } from "@/types/api.types";

/** Tham số `page` trên URL (D41): chỉ nhận số nguyên dương an toàn, không số 0 đứng đầu. */
export const parsePageParam = (raw: string | null): number | null => {
  if (raw === null || !/^[1-9][0-9]*$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : null;
};

/**
 * Sau khi tải trang: "empty" khi không có dòng nào (E1), số trang cuối khi trang vượt tổng,
 * null khi giữ nguyên.
 */
export const resolvePageRedirect = (meta: PageMeta, itemsLength: number): "empty" | number | null => {
  if (meta.total === 0) return "empty";
  if (itemsLength === 0 && meta.current > meta.pages) return meta.pages;
  return null;
};
