const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const {
  LookupUsersDto,
} = require('../dist/src/modules/internal-users/dto/lookup-users.dto');
const {
  InternalUsersService,
} = require('../dist/src/modules/internal-users/internal-users.service');

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});
const validate = (body) =>
  pipe.transform(body, { type: 'body', metatype: LookupUsersDto });
const organizationId = randomUUID();
const repeated = randomUUID();

for (const [name, userIds] of [
  ['empty IDs', []],
  ['501 IDs', Array.from({ length: 501 }, randomUUID)],
  ['duplicate IDs', [repeated, repeated]],
  ['case-insensitive duplicate IDs', [repeated, repeated.toUpperCase()]],
  ['invalid UUID', ['invalid']],
  ['non-array IDs', repeated],
]) {
  test(`returns 400 for ${name}`, async () => {
    await assert.rejects(
      validate({ organizationId, userIds }),
      (error) => error.getStatus() === 400,
    );
  });
}

test('returns 400 for invalid organization UUID', async () => {
  await assert.rejects(
    validate({ organizationId: 'invalid', userIds: [randomUUID()] }),
    (error) => error.getStatus() === 400,
  );
});

const createService = () => {
  const calls = [];
  const service = new InternalUsersService({
    lookup: async (...args) => {
      calls.push(args);
      return [];
    },
  });
  return { service, calls };
};
const lookupDto = { organizationId, userIds: [repeated] };

test('looks up when x-organization-id matches the body, ignoring case', async () => {
  const { service, calls } = createService();
  assert.deepEqual(
    await service.lookup(organizationId.toUpperCase(), lookupDto),
    { items: [] },
  );
  assert.deepEqual(calls, [[organizationId, [repeated]]]);
});

for (const [name, header] of [
  ['another organization', randomUUID()],
  ['an empty header', ''],
  ['a whitespace-only header', '   '],
  ['a non-UUID header', 'not-a-uuid'],
  ['a missing header', undefined],
]) {
  test(`returns 404 without querying for ${name}`, async () => {
    const { service, calls } = createService();
    await assert.rejects(
      service.lookup(header, lookupDto),
      (error) =>
        error.getStatus() === 404 &&
        error.getResponse().code === 'ORGANIZATION_NOT_FOUND',
    );
    assert.equal(calls.length, 0);
  });
}

test('accepts one and 500 unique UUIDs', async () => {
  for (const length of [1, 500]) {
    const result = await validate({
      organizationId,
      userIds: Array.from({ length }, randomUUID),
    });
    assert.equal(result.userIds.length, length);
  }
});
