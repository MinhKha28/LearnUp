/**
 * Standardized HTTP headers used across the LearnUP platform.
 */
export const HeaderConstants = {
  /**
   * Subject/User identifier derived from trusted JWT claims by API Gateway.
   */
  X_USER_ID: 'x-user-id',

  /**
   * Standardized tenant organization identifier derived from trusted JWT claims by API Gateway.
   */
  X_ORGANIZATION_ID: 'x-organization-id',

  /**
   * Request correlation identifier propagated across HTTP requests and Kafka events.
   */
  X_CORRELATION_ID: 'x-correlation-id',

  /**
   * User role header injected by API Gateway.
   */
  X_USER_ROLE: 'x-user-role',

  /**
   * Standard Authorization header.
   */
  AUTHORIZATION: 'authorization',

  /**
   * Bearer token prefix.
   */
  BEARER_PREFIX: 'Bearer ',
} as const;
