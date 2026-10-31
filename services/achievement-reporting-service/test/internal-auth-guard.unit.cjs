const assert = require('node:assert/strict');
const { test } = require('node:test');
const { UnauthorizedException } = require('@nestjs/common');
const {
  InternalAuthGuard,
} = require('../dist/src/common/guards/internal-auth.guard');

const ID = '0199a000-0000-7000-8000-0a0000000001';
const guardWith = (configured) =>
  new InternalAuthGuard(
    { getAllAndOverride: () => false },
    { getOrThrow: () => configured },
  );
const contextWith = (headers) => ({
  getHandler: () => undefined,
  getClass: () => undefined,
  switchToHttp: () => ({ getRequest: () => ({ headers }) }),
});
const user = {
  'x-user-id': ID,
  'x-organization-id': ID,
  'x-user-role': 'ORGANIZER',
};

test('the configured key and a complete user context are accepted', () => {
  const key = 'achievement-guard-unit-test-key-0123456789abcdef';
  assert.equal(
    guardWith(key).canActivate(contextWith({ 'x-internal-key': key, ...user })),
    true,
  );
});

for (const configured of ['', '   ']) {
  test(`a service started with a blank key (${JSON.stringify(configured)}) accepts nothing, not even an empty key header`, () => {
    for (const header of [undefined, '', configured]) {
      assert.throws(
        () =>
          guardWith(configured).canActivate(
            contextWith({ 'x-internal-key': header, ...user }),
          ),
        UnauthorizedException,
      );
    }
  });
}
