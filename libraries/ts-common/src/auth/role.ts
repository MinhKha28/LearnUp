/**
 * Canonical user roles recognized across the LearnUP platform.
 * Exactly four roles: ADMIN, ORGANIZER, INSTRUCTOR, LEARNER.
 */
export type UserRole = "ADMIN" | "ORGANIZER" | "INSTRUCTOR" | "LEARNER";

export const USER_ROLES: readonly UserRole[] = [
  "ADMIN",
  "ORGANIZER",
  "INSTRUCTOR",
  "LEARNER",
] as const;

/**
 * Type guard checking if an arbitrary value is a valid UserRole.
 */
export function isValidUserRole(value: unknown): value is UserRole {
  if (typeof value !== "string") {
    return false;
  }
  return (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Safely parse a role string from an HTTP header or token claim.
 * Returns the matching UserRole, or null if input is null/empty/invalid.
 */
export function parseUserRole(
  roleStr: string | null | undefined,
): UserRole | null {
  if (!roleStr || typeof roleStr !== "string") {
    return null;
  }
  const normalized = roleStr.trim().toUpperCase();
  if (isValidUserRole(normalized)) {
    return normalized as UserRole;
  }
  return null;
}

/**
 * Parse a role string, throwing an Error if the role is invalid (non-empty but unrecognized).
 */
export function requireUserRole(roleStr: string): UserRole {
  const role = parseUserRole(roleStr);
  if (!role) {
    throw new Error(
      `Invalid user role: '${roleStr}'. Allowed roles: ${USER_ROLES.join(", ")}`,
    );
  }
  return role;
}
