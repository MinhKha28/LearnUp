import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../src/auth/roles.guard';
import { PlatformRole } from '../../src/auth/roles.constant';
import { CurrentUser } from '../../src/auth/current-user';
import { CURRENT_USER_KEY } from '../../src/auth/current-user.decorator';
import { ForbiddenException } from '../../src/exception/forbidden.exception';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: CurrentUser, headerRole?: string): ExecutionContext {
    const req = {
      [CURRENT_USER_KEY]: user,
      headers: {
        'x-user-role': headerRole,
      },
    };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no roles are required on route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if CurrentUser has one of the required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PlatformRole.ORGANIZER, PlatformRole.ADMIN]);

    const user = new CurrentUser({
      userId: 'usr_1',
      organizationId: 'org_1',
      role: PlatformRole.ORGANIZER,
    });
    const context = createMockContext(user);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if CurrentUser lacks required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PlatformRole.ADMIN]);

    const user = new CurrentUser({
      userId: 'usr_1',
      organizationId: 'org_1',
      role: PlatformRole.LEARNER,
    });
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
