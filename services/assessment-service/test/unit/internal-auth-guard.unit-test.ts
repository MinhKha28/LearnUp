/**
 * The guard of every route: the internal key and the identity of the user. A route marked as a service call (the
 * completion snapshot, asked by learning-service) needs the key and the Organization only; no other route may lose
 * the check of the user because of it.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  SERVICE_CALL_KEY,
} from '../../src/common/decorator/customize';
import { InternalAuthGuard } from '../../src/common/guards/internal-auth.guard';

const KEY = 'unit-test-key';
const ORG = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-0000000000c1';

type Mark = 'normal' | 'public' | 'service';

const run = (mark: Mark, headers: Record<string, string>) => {
  const reflector = {
    getAllAndOverride: (key: string) =>
      (key === IS_PUBLIC_KEY && mark === 'public') ||
      (key === SERVICE_CALL_KEY && mark === 'service'),
  } as unknown as Reflector;
  const config = { getOrThrow: () => KEY } as unknown as ConfigService;
  const request: Record<string, any> = { headers };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const result = new InternalAuthGuard(reflector, config).canActivate(
    context as never,
  );
  return { result, request };
};
const rejected = (mark: Mark, headers: Record<string, string>) =>
  assert.throws(() => run(mark, headers), UnauthorizedException);

const key = { 'x-internal-key': KEY };
const org = { 'x-organization-id': ORG };
const user = { 'x-user-id': USER, 'x-user-role': 'LEARNER' };

describe('InternalAuthGuard', () => {
  describe('a normal route', () => {
    test('with the key and the whole identity: allowed, and the user is set', () => {
      const { result, request } = run('normal', { ...key, ...org, ...user });
      assert.equal(result, true);
      assert.deepEqual(request.user, {
        userId: USER,
        organizationId: ORG,
        role: 'LEARNER',
        isAuthenticated: true,
      });
    });

    test('with the key and the Organization but no user: refused (a service call must not open it)', () => {
      rejected('normal', { ...key, ...org });
    });

    test('without the user id, or without the role: refused', () => {
      rejected('normal', { ...key, ...org, 'x-user-role': 'LEARNER' });
      rejected('normal', { ...key, ...org, 'x-user-id': USER });
    });

    test('with an unknown role: refused', () => {
      rejected('normal', {
        ...key,
        ...org,
        'x-user-id': USER,
        'x-user-role': 'ROOT',
      });
    });

    test('without the key or with a wrong key: refused, whatever else is sent', () => {
      rejected('normal', { ...org, ...user });
      rejected('normal', { 'x-internal-key': 'wrong', ...org, ...user });
    });
  });

  describe('a service call', () => {
    test('with the key and the Organization: allowed, with no user', () => {
      const { result, request } = run('service', { ...key, ...org });
      assert.equal(result, true);
      assert.equal(request.serviceOrganizationId, ORG);
      assert.equal(request.user, undefined);
    });

    test('the Organization comes from the header, not from anything the caller says about a user', () => {
      const other = '00000000-0000-4000-8000-0000000000bb';
      const { request } = run('service', {
        ...key,
        'x-organization-id': ORG,
        'x-user-id': other,
      });
      assert.equal(request.serviceOrganizationId, ORG);
      assert.equal(request.user, undefined);
    });

    test('without the key or with a wrong key: refused', () => {
      rejected('service', { ...org });
      rejected('service', { 'x-internal-key': 'wrong', ...org });
    });

    test('without the Organization, or with one that is not a UUID: refused', () => {
      rejected('service', { ...key });
      rejected('service', { ...key, 'x-organization-id': 'abc' });
      rejected('service', { ...key, 'x-organization-id': '' });
    });
  });

  test('a public route needs nothing', () => {
    assert.equal(run('public', {}).result, true);
  });
});

describe('InternalAuthGuard of a service started without a key', () => {
  const U = { 'x-user-id': USER, 'x-user-role': 'LEARNER' };
  const call = (configured: string, headers: Record<string, string>) =>
    new InternalAuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { getOrThrow: () => configured } as unknown as ConfigService,
    ).canActivate({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as never);

  for (const configured of ['', '   ']) {
    test(`a blank key (${JSON.stringify(configured)}) accepts nothing, not even an empty key header`, () => {
      assert.throws(
        () => call(configured, { 'x-internal-key': configured, ...org, ...U }),
        UnauthorizedException,
      );
      assert.throws(
        () => call(configured, { 'x-internal-key': '', ...org, ...U }),
        UnauthorizedException,
      );
      assert.throws(
        () => call(configured, { ...org, ...U }),
        UnauthorizedException,
      );
    });
  }
});
