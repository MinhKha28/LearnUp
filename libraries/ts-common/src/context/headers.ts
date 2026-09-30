/**
 * Canonical HTTP header names used across the LearnUP platform for trusted context propagation.
 */
export const HEADER_NAMES = {
  INTERNAL_KEY: "x-internal-key",
  USER_ID: "x-user-id",
  ORGANIZATION_ID: "x-organization-id",
  USER_ROLE: "x-user-role",
  CORRELATION_ID: "x-correlation-id",
} as const;

export type HeaderName = (typeof HEADER_NAMES)[keyof typeof HEADER_NAMES];
