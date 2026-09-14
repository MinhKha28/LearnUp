import { ApiError, createApiError, StandardErrorCode } from './errors.js';

/**
 * Successful API response envelope.
 */
export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  error?: never;
}

/**
 * Error API response envelope.
 */
export interface ApiResponseError {
  success: false;
  data?: never;
  error: ApiError;
}

/**
 * Discriminated union response envelope for all LearnUP REST endpoints.
 */
export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

/**
 * Standard simple pagination result.
 */
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/**
 * Create a successful ApiResponse envelope wrapping data payload.
 */
export function createSuccessResponse<T>(data: T): ApiResponseSuccess<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create an empty successful ApiResponse envelope.
 */
export function createEmptySuccessResponse(): ApiResponseSuccess<void> {
  return {
    success: true,
    data: undefined as void,
  };
}

/**
 * Create an error ApiResponse envelope.
 */
export function createErrorResponse(
  errorOrCode: ApiError | StandardErrorCode | string,
  message?: string,
  details?: string[]
): ApiResponseError {
  if (typeof errorOrCode === 'object' && errorOrCode !== null) {
    return {
      success: false,
      error: errorOrCode,
    };
  }

  return {
    success: false,
    error: createApiError(errorOrCode, message || 'An error occurred', details),
  };
}

/**
 * Create a PageResponse calculating totalPages, first, and last flags.
 */
export function createPageResponse<T>(
  items: T[],
  page: number,
  size: number,
  totalElements: number
): PageResponse<T> {
  const effectiveSize = size > 0 ? size : 20;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / effectiveSize);
  const first = page <= 0;
  const last = totalPages === 0 || page >= totalPages - 1;

  return {
    items: [...items],
    page,
    size: effectiveSize,
    totalElements,
    totalPages,
    first,
    last,
  };
}

/**
 * Create an empty PageResponse.
 */
export function createEmptyPageResponse<T>(page = 0, size = 20): PageResponse<T> {
  return createPageResponse<T>([], page, size, 0);
}
