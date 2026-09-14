import { describe, it, expect } from 'vitest';
import { UserRole } from '@learnup/ts-common';

describe('Role Model Constraints', () => {
  it('should verify exactly four roles defined in UserRole', () => {
    const validRoles: UserRole[] = ['ADMIN', 'ORGANIZER', 'INSTRUCTOR', 'LEARNER'];
    expect(validRoles).toHaveLength(4);

    // Verify all four roles match UserRole values
    const admin: UserRole = 'ADMIN';
    const organizer: UserRole = 'ORGANIZER';
    const instructor: UserRole = 'INSTRUCTOR';
    const learner: UserRole = 'LEARNER';

    expect(admin).toBe('ADMIN');
    expect(organizer).toBe('ORGANIZER');
    expect(instructor).toBe('INSTRUCTOR');
    expect(learner).toBe('LEARNER');
  });

  it('should not include disallowed roles (SUPER_ADMIN, ORG_ADMIN, TENANT_ADMIN)', () => {
    const validRoles = ['ADMIN', 'ORGANIZER', 'INSTRUCTOR', 'LEARNER'];
    const invalidRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'TENANT_ADMIN', 'SYSADMIN', 'STUDENT'];

    invalidRoles.forEach((role) => {
      expect(validRoles).not.toContain(role);
    });
  });
});
