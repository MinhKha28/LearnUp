export declare const PlatformRole: {
    readonly ADMIN: 'ADMIN';
    readonly ORGANIZER: 'ORGANIZER';
    readonly INSTRUCTOR: 'INSTRUCTOR';
    readonly LEARNER: 'LEARNER';
};
export type PlatformRoleType = (typeof PlatformRole)[keyof typeof PlatformRole];
export declare const ALLOWED_ROLES: readonly PlatformRoleType[];
export declare function isValidRole(role: string): role is PlatformRoleType;
