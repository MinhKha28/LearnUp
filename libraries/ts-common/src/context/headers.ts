/**
 * Canonical HTTP header names used across the LearnUP platform for trusted context propagation.
 */
export const HEADER_NAMES = {
  USER_ID: 'X-User-ID',
  ORGANIZATION_ID: 'X-Organization-ID',
  USER_ROLE: 'X-User-Role',
  CORRELATION_ID: 'X-Correlation-ID',
} as const;

export type HeaderName = (typeof HEADER_NAMES)[keyof typeof HEADER_NAMES];
