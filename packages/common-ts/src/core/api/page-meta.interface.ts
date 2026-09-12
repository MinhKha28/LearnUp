/**
 * Standard offset/page-based pagination metadata.
 */
export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function createPageMeta(page: number, size: number, totalElements: number): PageMeta {
  const totalPages = size === 0 ? 1 : Math.ceil(totalElements / size);
  return {
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0 && totalPages > 0,
  };
}
