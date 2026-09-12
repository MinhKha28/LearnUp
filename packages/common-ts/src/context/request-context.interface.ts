import { PlatformRoleType } from '../auth/roles.constant';

/**
 * Encapsulates the execution context of the active request.
 */
export interface RequestContext {
  userId?: string;
  organizationId?: string;
  role?: PlatformRoleType;
  correlationId?: string;
}
