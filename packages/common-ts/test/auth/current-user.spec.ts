import { CurrentUser } from '../../src/auth/current-user';
import { PlatformRole } from '../../src/auth/roles.constant';

describe('CurrentUser', () => {
  it('should create CurrentUser with correct properties and role helpers', () => {
    const user = new CurrentUser({
      userId: 'usr_123',
      organizationId: 'org_456',
      role: PlatformRole.ORGANIZER,
      correlationId: 'corr_789',
    });

    expect(user.userId).toBe('usr_123');
    expect(user.organizationId).toBe('org_456');
    expect(user.role).toBe(PlatformRole.ORGANIZER);
    expect(user.correlationId).toBe('corr_789');

    expect(user.isOrganizer()).toBe(true);
    expect(user.isAdmin()).toBe(false);
    expect(user.isInstructor()).toBe(false);
    expect(user.isLearner()).toBe(false);
    expect(user.hasRole('ORGANIZER')).toBe(true);
    expect(user.hasRole('organizer')).toBe(true);
    expect(user.hasRole('ADMIN')).toBe(false);
  });

  it('should verify organization membership correctly', () => {
    const user = new CurrentUser({
      userId: 'usr_1',
      organizationId: 'org_main',
      role: PlatformRole.LEARNER,
    });

    expect(user.belongsToOrganization('org_main')).toBe(true);
    expect(user.belongsToOrganization('org_other')).toBe(false);
  });
});
