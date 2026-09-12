import { JwtHelper } from '../../src/auth/jwt.helper';
import { PlatformRole } from '../../src/auth/roles.constant';
import { JwtPayload } from '../../src/auth/jwt-payload.interface';

describe('JwtHelper', () => {
  function createTestJwt(payload: object): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = 'test_signature';
    return `${header}.${body}.${signature}`;
  }

  it('should decode JWT payload accurately', () => {
    const rawPayload: JwtPayload = {
      sub: 'usr_100',
      role: PlatformRole.INSTRUCTOR,
      organizationId: 'org_200',
      iat: 1726113600,
      exp: 1726117200,
    };
    const token = createTestJwt(rawPayload);

    const decoded = JwtHelper.decodePayload(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('usr_100');
    expect(decoded?.role).toBe(PlatformRole.INSTRUCTOR);
    expect(decoded?.organizationId).toBe('org_200');
  });

  it('should validate valid payload structure', () => {
    const validPayload = {
      sub: 'usr_100',
      role: PlatformRole.LEARNER,
      organizationId: 'org_200',
      iat: 1726113600,
      exp: 1726117200,
    };
    expect(JwtHelper.isValidPayload(validPayload)).toBe(true);

    const invalidPayload = {
      sub: 'usr_100',
      role: 'SUPER_USER', // Invalid role
      organizationId: 'org_200',
      exp: 1726117200,
    };
    expect(JwtHelper.isValidPayload(invalidPayload)).toBe(false);
  });

  it('should convert JwtPayload to CurrentUser', () => {
    const payload: JwtPayload = {
      sub: 'usr_100',
      role: PlatformRole.ORGANIZER,
      organizationId: 'org_200',
      iat: 1726113600,
      exp: 1726117200,
    };
    const user = JwtHelper.toCurrentUser(payload, 'corr_999');

    expect(user.userId).toBe('usr_100');
    expect(user.organizationId).toBe('org_200');
    expect(user.role).toBe(PlatformRole.ORGANIZER);
    expect(user.correlationId).toBe('corr_999');
    expect(user.isOrganizer()).toBe(true);
  });
});
