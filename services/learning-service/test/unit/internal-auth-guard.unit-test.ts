/**
 * The guard of every route: the internal key first. A service that was started without a key must not accept a
 * request whose key header is empty too (an empty string equals an empty string).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { InternalAuthGuard } from '../../src/common/guards/internal-auth.guard';

const ID = '00000000-0000-4000-8000-0000000000c1';
const user = {
  'x-user-id': ID,
  'x-organization-id': ID,
  'x-user-role': 'LEARNER',
};
const KEY = 'unit-test-key-0123456789abcdef';
const call = (configured: string, headers: Record<string, unknown>) =>
  new InternalAuthGuard(
    { getAllAndOverride: () => false } as unknown as Reflector,
    { getOrThrow: () => configured } as unknown as ConfigService,
  ).canActivate({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as never);

describe('InternalAuthGuard', () => {
  test('the configured key and a complete user context are accepted', () => {
    assert.equal(call(KEY, { 'x-internal-key': KEY, ...user }), true);
  });

  test('a wrong or missing key is refused', () => {
    for (const header of [undefined, '', 'other']) {
      assert.throws(
        () => call(KEY, { 'x-internal-key': header, ...user }),
        UnauthorizedException,
      );
    }
  });

  for (const configured of ['', '   ']) {
    test(`a service started with a blank key (${JSON.stringify(configured)}) accepts nothing, not even an empty key header`, () => {
      for (const header of [undefined, '', configured]) {
        assert.throws(
          () => call(configured, { 'x-internal-key': header, ...user }),
          UnauthorizedException,
        );
      }
    });
  }
});
