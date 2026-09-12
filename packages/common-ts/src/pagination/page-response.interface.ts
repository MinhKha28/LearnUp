import { PageMeta, createPageMeta } from './page-meta.interface';

/**
 * Standard paginated collection wrapper.
 */
export interface PageResponse<T> {
  items: T[];
  meta: PageMeta;
}

/**
 * Creates standard PageResponse object.
 */
export function createPageResponse<T>(
  items: T[],
  page: number,
  size: number,
  totalElements: number,
): PageResponse<T> {
  return {
    items: Array.isArray(items) ? items : [],
    meta: createPageMeta(page, size, totalElements),
  };
}
