import { PlatformRoleType } from '../constants/roles.constant';

/**
 * Standardized JWT claims payload structure in TypeScript.
 */
export interface JwtClaims {
  sub: string;
  role: PlatformRoleType;
  organizationId: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}
