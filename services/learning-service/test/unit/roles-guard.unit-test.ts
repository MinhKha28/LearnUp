import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../../src/common/decorator/roles.decorator';
import { RolesGuard } from '../../src/common/guards/roles.guard';

class DemoController {
  @Roles('LEARNER')
  learnerOnly(this: void): void {}

  open(this: void): void {}
}

function contextFor(
  handler: () => void,
  user: CurrentUser | undefined,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => DemoController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const user = (role: CurrentUser['role']): CurrentUser => ({
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: '0199a000-0000-7000-8000-0a0000000001',
  role,
  isAuthenticated: true,
});

const guard = new RolesGuard(new Reflector());
const controller = DemoController.prototype;

void describe('RolesGuard', () => {
  void test('đúng role → cho qua', () => {
    assert.equal(
      guard.canActivate(contextFor(controller.learnerOnly, user('LEARNER'))),
      true,
    );
  });

  void test('sai role → 403 FORBIDDEN', () => {
    assert.throws(
      () =>
        guard.canActivate(
          contextFor(controller.learnerOnly, user('INSTRUCTOR')),
        ),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.getStatus(), 403);
        assert.deepEqual(
          (error.getResponse() as { code: string }).code,
          'FORBIDDEN',
        );
        return true;
      },
    );
  });

  void test('thiếu request.user → không lọt qua (403)', () => {
    assert.throws(
      () => guard.canActivate(contextFor(controller.learnerOnly, undefined)),
      ForbiddenException,
    );
  });

  void test('handler không có @Roles → không kiểm role', () => {
    assert.equal(
      guard.canActivate(contextFor(controller.open, user('INSTRUCTOR'))),
      true,
    );
  });
});
