import { JwtPayload } from './jwt-payload.interface';
import { CurrentUser } from './current-user';
import { isValidRole } from './roles.constant';

/**
 * Technology-neutral JWT decoding and claims extraction helper for TypeScript / Node.js.
 */
export class JwtHelper {
  /**
   * Decodes a JWT payload without verifying cryptographic signature.
   * Useful in internal microservices receiving verified tokens or headers from the Gateway.
   */
  static decodePayload(token: string): JwtPayload | null {
    if (!token || typeof token !== 'string') {
      return null;
    }
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      return null;
    }
    try {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Validates whether a decoded JWT payload satisfies platform contract requirements.
   */
  static isValidPayload(payload: unknown): payload is JwtPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }
    const p = payload as Record<string, unknown>;
    const hasSub = typeof p.sub === 'string' && p.sub.trim().length > 0;
    const hasOrgId = typeof p.organizationId === 'string' && p.organizationId.trim().length > 0;
    const hasRole = typeof p.role === 'string' && isValidRole(p.role);
    const hasExp = typeof p.exp === 'number';

    return hasSub && hasOrgId && hasRole && hasExp;
  }

  /**
   * Converts a JWT payload into a CurrentUser abstraction.
   */
  static toCurrentUser(payload: JwtPayload, correlationId?: string): CurrentUser {
    return new CurrentUser({
      userId: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      correlationId,
    });
  }
}
