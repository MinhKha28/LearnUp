import { PlatformRoleType } from './roles.constant';
export interface CurrentUserProps {
    userId: string;
    organizationId: string;
    role: PlatformRoleType;
    correlationId?: string;
}
export declare class CurrentUser {
    readonly userId: string;
    readonly organizationId: string;
    readonly role: PlatformRoleType;
    readonly correlationId?: string;
    constructor(props: CurrentUserProps);
    hasRole(targetRole: string): boolean;
    isAdmin(): boolean;
    isOrganizer(): boolean;
    isInstructor(): boolean;
    isLearner(): boolean;
    belongsToOrganization(targetOrgId: string): boolean;
}
