import { PageResponse, createPageResponse } from './page-response.interface';
import { PageMeta, createPageMeta } from './page-meta.interface';

export class PaginationUtils {
  static readonly DEFAULT_PAGE = 0;
  static readonly DEFAULT_SIZE = 20;
  static readonly MAX_SIZE = 100;

  /**
   * Clamps the page index ensuring it is >= 0.
   */
  static clampPage(page?: number | string | null): number {
    if (page === undefined || page === null) {
      return this.DEFAULT_PAGE;
    }
    const num = typeof page === 'string' ? parseInt(page, 10) : page;
    return isNaN(num) || num < 0 ? this.DEFAULT_PAGE : num;
  }

  /**
   * Clamps the page size within [1, maxSize].
   */
  static clampSize(
    size?: number | string | null,
    defaultSize = this.DEFAULT_SIZE,
    maxSize = this.MAX_SIZE,
  ): number {
    if (size === undefined || size === null) {
      return defaultSize;
    }
    const num = typeof size === 'string' ? parseInt(size, 10) : size;
    if (isNaN(num) || num <= 0) {
      return defaultSize;
    }
    return Math.min(num, maxSize);
  }

  /**
   * Calculates database / query offset for SQL / query builders.
   */
  static calculateOffset(page?: number | null, size?: number | null): number {
    const safePage = this.clampPage(page);
    const safeSize = this.clampSize(size);
    return safePage * safeSize;
  }

  /**
   * Creates PageMeta metadata.
   */
  static createMeta(page: number, size: number, totalElements: number): PageMeta {
    return createPageMeta(this.clampPage(page), this.clampSize(size), totalElements);
  }

  /**
   * Paginates an in-memory array and returns PageResponse.
   */
  static paginateArray<T>(
    items: T[],
    page?: number | null,
    size?: number | null,
  ): PageResponse<T> {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return createPageResponse([], this.clampPage(page), this.clampSize(size), 0);
    }

    const safePage = this.clampPage(page);
    const safeSize = this.clampSize(size);
    const totalElements = items.length;

    const fromIndex = safePage * safeSize;
    if (fromIndex >= totalElements) {
      return createPageResponse([], safePage, safeSize, totalElements);
    }

    const toIndex = Math.min(fromIndex + safeSize, totalElements);
    const paginatedItems = items.slice(fromIndex, toIndex);

    return createPageResponse(paginatedItems, safePage, safeSize, totalElements);
  }
}
