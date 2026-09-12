/**
 * Standard offset/page-based pagination metadata matching LearnUP platform contract.
 */
export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Creates standard PageMeta object.
 */
export function createPageMeta(
  page: number,
  size: number,
  totalElements: number,
): PageMeta {
  const safePage = page < 0 ? 0 : page;
  const safeSize = size <= 0 ? 20 : size;
  const safeTotal = totalElements < 0 ? 0 : totalElements;
  const totalPages = safeSize === 0 ? 1 : Math.ceil(safeTotal / safeSize);

  return {
    page: safePage,
    size: safeSize,
    totalElements: safeTotal,
    totalPages,
    hasNext: safePage + 1 < totalPages,
    hasPrevious: safePage > 0 && totalPages > 0,
  };
}
