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

const userGuard = new InternalAuthGuard(
  { getAllAndOverride: () => false },
  config,
);
const userRequest = (headers) => {
  const request = { headers: { 'x-internal-key': expectedKey, ...headers } };
  return {
    request,
    context: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    },
  };
};
const organizationId = '01990000-0000-7000-8000-0000000000aa';

test('a platform Admin without an organization header is authenticated without an organization', () => {
  const { request, context } = userRequest({
    'x-user-id': 'admin-1',
    'x-user-role': 'ADMIN',
  });
  assert.equal(userGuard.canActivate(context), true);
  assert.deepEqual(request.user, {
    userId: 'admin-1',
    role: 'ADMIN',
    isAuthenticated: true,
  });
});

test('an Admin request that does carry an organization keeps it', () => {
  const { request, context } = userRequest({
    'x-user-id': 'admin-1',
    'x-user-role': 'admin',
    'x-organization-id': organizationId,
  });
  assert.equal(userGuard.canActivate(context), true);
  assert.equal(request.user.organizationId, organizationId);
});

for (const role of ['ORGANIZER', 'INSTRUCTOR', 'LEARNER']) {
  test(`${role} still needs the organization header (401 without it)`, () => {
    const { context } = userRequest({
      'x-user-id': 'user-1',
      'x-user-role': role,
    });
    assert.throws(() => userGuard.canActivate(context), UnauthorizedException);
  });
}

test('an organization member with the header is unchanged', () => {
  const { request, context } = userRequest({
    'x-user-id': 'user-1',
    'x-user-role': 'ORGANIZER',
    'x-organization-id': organizationId,
  });
  assert.equal(userGuard.canActivate(context), true);
  assert.deepEqual(request.user, {
    userId: 'user-1',
    organizationId,
    role: 'ORGANIZER',
    isAuthenticated: true,
  });
});

for (const [name, headers] of [
  ['a missing user id', { 'x-user-role': 'ADMIN' }],
  ['a missing role', { 'x-user-id': 'admin-1' }],
  ['an unknown role', { 'x-user-id': 'admin-1', 'x-user-role': 'ROOT' }],
  [
    'a repeated organization header',
    {
      'x-user-id': 'admin-1',
      'x-user-role': 'ADMIN',
      'x-organization-id': [organizationId, organizationId],
    },
  ],
]) {
  test(`401 for ${name}`, () => {
    const { context } = userRequest(headers);
    assert.throws(() => userGuard.canActivate(context), UnauthorizedException);
  });
}
