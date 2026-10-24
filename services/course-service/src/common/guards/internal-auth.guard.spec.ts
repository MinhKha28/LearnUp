import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InternalAuthGuard } from './internal-auth.guard';
import { IS_SERVICE_CALL_KEY } from '../decorator/customize';

describe('ServiceCall authentication', () => {
  const key = 'isolated-course-guard-test-key';
  const org = '0199a000-0000-7000-8000-0a0000000001';
  const guard = new InternalAuthGuard(
    new Reflector(),
    new ConfigService({ INTERNAL_SERVICE_KEY: key }),
  );
  function invoke(headers: Record<string, unknown>, serviceCall = true) {
    const handler = () => undefined;
    Reflect.defineMetadata(IS_SERVICE_CALL_KEY, serviceCall, handler);
    const req = { headers };
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  }

  it.each([undefined, '', 'wrong', 'x'.repeat(key.length), `${key}longer`])(
    'rejects missing or incorrect key %s without a length exception',
    (candidate) => {
      try {
        invoke({ 'x-internal-key': candidate, 'x-organization-id': org });
        throw new Error('Expected authentication rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(401);
        expect((error as HttpException).getResponse()).toMatchObject({
          code: 'INVALID_INTERNAL_KEY',
        });
      }
    },
  );
  it.each([undefined, '', 'invalid', [org]])(
    'rejects invalid organization %s',
    (candidate) => {
      expect(() =>
        invoke({ 'x-internal-key': key, 'x-organization-id': candidate }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ORGANIZATION_REQUIRED' }),
          status: 400,
        }),
      );
    },
  );
  it('accepts service headers alone', () => {
    expect(invoke({ 'x-internal-key': key, 'x-organization-id': org })).toBe(
      true,
    );
  });
  it('ignores user headers and service name for authentication', () => {
    expect(
      invoke({
        'x-internal-key': key,
        'x-organization-id': org,
        'x-user-id': 'invalid',
        'x-user-role': 'invalid',
        'x-service-name': 'untrusted',
      }),
    ).toBe(true);
    expect(() =>
      invoke({
        'x-organization-id': org,
        'x-service-name': 'achievement-reporting-service',
      }),
    ).toThrow(HttpException);
  });
  it('still requires user context on unmarked endpoints', () => {
    expect(() =>
      invoke({ 'x-internal-key': key, 'x-organization-id': org }, false),
    ).toThrow(expect.objectContaining({ status: 401 }));
  });
  it('keeps existing user authentication on unmarked endpoints', () => {
    expect(
      invoke(
        {
          'x-internal-key': key,
          'x-organization-id': org,
          'x-user-id': org,
          'x-user-role': 'LEARNER',
        },
        false,
      ),
    ).toBe(true);
  });
});
