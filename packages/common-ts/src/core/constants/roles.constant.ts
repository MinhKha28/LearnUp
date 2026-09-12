/**
 * Standardized canonical platform roles for LearnUP.
 */
export const PlatformRole = {
  ADMIN: 'ADMIN',
  ORGANIZER: 'ORGANIZER',
  INSTRUCTOR: 'INSTRUCTOR',
  LEARNER: 'LEARNER',
} as const;

export type PlatformRoleType = (typeof PlatformRole)[keyof typeof PlatformRole];

export const ALLOWED_ROLES: readonly PlatformRoleType[] = [
  PlatformRole.ADMIN,
  PlatformRole.ORGANIZER,
  PlatformRole.INSTRUCTOR,
  PlatformRole.LEARNER,
];

export function isValidRole(role: string): role is PlatformRoleType {
  return (ALLOWED_ROLES as readonly string[]).includes(role?.toUpperCase());
}
