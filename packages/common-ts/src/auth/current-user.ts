import { PlatformRole, PlatformRoleType } from './roles.constant';

export interface CurrentUserProps {
  userId: string;
  organizationId: string;
  role: PlatformRoleType;
  correlationId?: string;
}

/**
 * Immutable abstraction representing the authenticated user in the active request context.
 */
export class CurrentUser {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: PlatformRoleType;
  readonly correlationId?: string;

  constructor(props: CurrentUserProps) {
    this.userId = props.userId;
    this.organizationId = props.organizationId;
    this.role = props.role;
    this.correlationId = props.correlationId;
  }

  /**
   * Checks if the user possesses the specified role.
   */
  hasRole(targetRole: string): boolean {
    if (!this.role || !targetRole) {
      return false;
    }
    return this.role.toUpperCase() === targetRole.trim().toUpperCase();
  }

  /**
   * Checks if the user is a platform administrator.
   */
  isAdmin(): boolean {
    return this.hasRole(PlatformRole.ADMIN);
  }

  /**
   * Checks if the user is an organization administrator.
   */
  isOrganizer(): boolean {
    return this.hasRole(PlatformRole.ORGANIZER);
  }

  /**
   * Checks if the user is an instructor.
   */
  isInstructor(): boolean {
    return this.hasRole(PlatformRole.INSTRUCTOR);
  }

  /**
   * Checks if the user is a learner.
   */
  isLearner(): boolean {
    return this.hasRole(PlatformRole.LEARNER);
  }

  /**
   * Checks if the user belongs to a specific organization.
   */
  belongsToOrganization(targetOrgId: string): boolean {
    if (!this.organizationId || !targetOrgId) {
      return false;
    }
    return this.organizationId === targetOrgId;
  }
}
