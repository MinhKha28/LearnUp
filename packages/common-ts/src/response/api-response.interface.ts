import { ApiError } from '../exception/api-error.interface';
import { PageMeta } from '../pagination/page-meta.interface';

/**
 * Universal JSON API Response envelope matching LearnUP platform contract.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T | null;
  meta?: PageMeta | null;
  error?: ApiError | null;
  timestamp: string;
}

/**
 * Creates a standard successful ApiResponse envelope.
 */
export function createSuccessResponse<T>(data?: T, meta?: PageMeta | null): ApiResponse<T> {
  return {
    success: true,
    data: data !== undefined ? data : null,
    meta: meta ?? null,
    error: null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a standard failure ApiResponse envelope wrapping an ApiError.
 */
export function createErrorResponse(error: ApiError): ApiResponse<null> {
  return {
    success: false,
    data: null,
    meta: null,
    error,
    timestamp: new Date().toISOString(),
  };
}
