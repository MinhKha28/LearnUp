import { PlatformRoleType } from '../auth/roles.constant';
export interface RequestContext {
    userId?: string;
    organizationId?: string;
    role?: PlatformRoleType;
    correlationId?: string;
}
