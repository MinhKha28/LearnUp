import { PlatformRoleType } from '../constants/roles.constant';

/**
 * Framework-neutral request execution context.
 */
export interface RequestContext {
  userId?: string;
  organizationId?: string;
  role?: PlatformRoleType;
  correlationId?: string;
}
