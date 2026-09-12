import { PlatformRoleType } from '../constants/roles.constant';
export interface RequestContext {
    userId?: string;
    organizationId?: string;
    role?: PlatformRoleType;
    correlationId?: string;
}
