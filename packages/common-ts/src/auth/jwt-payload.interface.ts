import { PlatformRoleType } from './roles.constant';

/**
 * Standardized JWT claims payload structure matching LearnUP platform contract.
 */
export interface JwtPayload {
  /**
   * Subject identifier representing the unique User ID.
   */
  sub: string;

  /**
   * The user's canonical platform role governing RBAC privileges.
   */
  role: PlatformRoleType;

  /**
   * The standardized tenant organization identifier.
   */
  organizationId: string;

  /**
   * Issued at timestamp (seconds since Unix epoch).
   */
  iat: number;

  /**
   * Expiration timestamp (seconds since Unix epoch).
   */
  exp: number;

  /**
   * Issuer identity string.
   */
  iss?: string;

  /**
   * Audience target string.
   */
  aud?: string;
}
