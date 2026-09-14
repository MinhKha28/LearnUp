/**
 * Standard platform error codes recognized across LearnUP microservices.
 */
export const STANDARD_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type StandardErrorCode = (typeof STANDARD_ERROR_CODES)[keyof typeof STANDARD_ERROR_CODES];

/**
 * Standard error structure inside ApiResponse.
 */
export interface ApiError {
  code: StandardErrorCode | string;
  message: string;
  details?: string[];
}

/**
 * Factory creating an ApiError instance.
 */
export function createApiError(
  code: StandardErrorCode | string,
  message: string,
  details?: string[]
): ApiError {
  return {
    code,
    message,
    ...(details && details.length > 0 ? { details } : {}),
  };
}
