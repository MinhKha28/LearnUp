import { ApiError } from './api-error.interface';
import { PageMeta } from './page-meta.interface';

/**
 * Universal JSON API Response envelope for LearnUP.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T | null;
  meta?: PageMeta | null;
  error?: ApiError | null;
  timestamp: string;
}

export function createSuccessResponse<T>(data: T, meta?: PageMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: meta ?? null,
    error: null,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(error: ApiError): ApiResponse<null> {
  return {
    success: false,
    data: null,
    meta: null,
    error,
    timestamp: new Date().toISOString(),
  };
}
