const assert = require('node:assert/strict');
const { test } = require('node:test');
const { UnauthorizedException } = require('@nestjs/common');
const {
  InternalAuthGuard,
} = require('../dist/src/common/guards/internal-auth.guard');

const expectedKey = 'tenant-guard-unit-test-key-0123456789abcdef';
const serviceCallReflector = { getAllAndOverride: (key) => key !== 'isPublic' };
const config = { getOrThrow: () => expectedKey };
const guard = new InternalAuthGuard(serviceCallReflector, config);
const contextWith = (headers) => ({
  getHandler: () => undefined,
  getClass: () => undefined,
  switchToHttp: () => ({ getRequest: () => ({ headers }) }),
});

test('accepts the configured internal key', () => {
  assert.equal(
    guard.canActivate(contextWith({ 'x-internal-key': expectedKey })),
    true,
  );
});

for (const [name, value] of [
  ['missing key', undefined],
  ['wrong key of the same length', expectedKey.replace(/.$/, 'X')],
  ['shorter key', expectedKey.slice(0, 10)],
  ['longer key', `${expectedKey}extra`],
  ['empty key', ''],
  ['repeated header', [expectedKey, expectedKey]],
]) {
  test(`returns 401 for ${name}`, () => {
    assert.throws(
      () => guard.canActivate(contextWith({ 'x-internal-key': value })),
      UnauthorizedException,
    );
  });
}

for (const configured of ['', '   ']) {
  test(`a service started with a blank key (${JSON.stringify(configured)}) accepts nothing, not even an empty key header`, () => {
    const blank = new InternalAuthGuard(serviceCallReflector, {
      getOrThrow: () => configured,
    });
    for (const header of [undefined, '', configured]) {
      assert.throws(
        () => blank.canActivate(contextWith({ 'x-internal-key': header })),
        UnauthorizedException,
      );
    }
  });
}
