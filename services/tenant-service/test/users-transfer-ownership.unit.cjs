// UC23 - Course ownership transfer candidate lookup and eligibility.
// These tests use the compiled Tenant Service and do not require PostgreSQL.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { UsersRepository } = require('../dist/src/modules/users/users.repository');
const { UsersService } = require('../dist/src/modules/users/users.service');
const { UserRoleValue, UserStatus } = require('../dist/src/common/constants/tenant.constants');

const organizationId = randomUUID();
const otherOrganizationId = randomUUID();
const existingInstructorId = randomUUID();
const receivingInstructorId = randomUUID();
const organizer = { role: 'ORGANIZER', organizationId, userId: randomUUID() };
const instructor = { role: 'INSTRUCTOR', organizationId, userId: existingInstructorId };
const receiver = { id: receivingInstructorId, fullName: 'Instructor B' };

function createRepository() {
  const calls = { findMany: [], findFirst: [] };
  const prisma = {
    user: {
      findMany: async (args) => {
        calls.findMany.push(args);
        return [receiver];
      },
      findFirst: async (args) => {
        calls.findFirst.push(args);
        return receiver;
      },
    },
  };
  return { repository: new UsersRepository(prisma), calls, prisma };
}

function createService(repository) {
  // Only the two UC23 methods are exercised here; the other service
  // dependencies and UC12.5/12.6 workflows are intentionally untouched.
  const service = Object.create(UsersService.prototype);
  service.usersRepository = repository;
  return service;
}

test('repository lists only eligible receivers with tenant and exclusion filters', async () => {
  const { repository, calls } = createRepository();
  assert.deepEqual(
    await repository.findTransferCandidates(organizationId, existingInstructorId),
    [receiver],
  );
  assert.deepEqual(calls.findMany[0], {
    where: {
      organizationId,
      role: UserRoleValue.Instructor,
      status: UserStatus.Active,
      activatedAt: { not: null },
      deletedAt: null,
      id: { not: existingInstructorId },
    },
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    select: { id: true, fullName: true },
  });
});

test('repository rechecks the receiver in the requested Organization', async () => {
  const { repository, calls } = createRepository();
  assert.deepEqual(await repository.findEligibleTransferReceiver(
    organizationId, receivingInstructorId,
  ), receiver);
  assert.deepEqual(calls.findFirst[0], {
    where: {
      id: receivingInstructorId,
      organizationId,
      role: UserRoleValue.Instructor,
      status: UserStatus.Active,
      activatedAt: { not: null },
      deletedAt: null,
    },
    select: { id: true, fullName: true },
  });
});

test('Service delegates candidate selection and preserves response fields', async () => {
  const calls = [];
  const service = createService({
    findTransferCandidates: async (...args) => {
      calls.push(args);
      return [receiver];
    },
  });
  assert.deepEqual(
    await service.getTransferCandidates(organizer, existingInstructorId),
    [receiver],
  );
  assert.deepEqual(calls, [[organizationId, existingInstructorId]]);
});

test('Service validates an Instructor and returns their ID and full name', async () => {
  const calls = [];
  const service = createService({
    findEligibleTransferReceiver: async (...args) => {
      calls.push(args);
      return receiver;
    },
  });
  assert.deepEqual(
    await service.validateTransferReceiver(organizer, receivingInstructorId),
    receiver,
  );
  assert.deepEqual(calls, [[organizationId, receivingInstructorId]]);
});

for (const [name, user] of [
  ['non-Organizer', instructor],
  ['missing Organization', { role: 'ORGANIZER', organizationId: null }],
]) {
  test('UC23 rejects ' + name + ' without a database query', async () => {
    const calls = [];
    const service = createService({
      findTransferCandidates: async () => calls.push('list'),
      findEligibleTransferReceiver: async () => calls.push('detail'),
    });
    for (const call of [
      () => service.getTransferCandidates(user, existingInstructorId),
      () => service.validateTransferReceiver(user, receivingInstructorId),
    ]) {
      await assert.rejects(call, error =>
        error.getStatus() === 403 &&
        error.getResponse().code === 'FORBIDDEN',
      );
    }
    assert.deepEqual(calls, []);
  });
}

test('UC23 returns 400 INVALID_RECEIVER when the repository finds no eligible Instructor', async () => {
  const service = createService({
    findEligibleTransferReceiver: async () => null,
  });
  await assert.rejects(
    () => service.validateTransferReceiver(organizer, receivingInstructorId),
    error => error.getStatus() === 400 &&
      error.getResponse().code === 'INVALID_RECEIVER',
  );
});

test('repository returns the Prisma result without leaking another Organization', async () => {
  const { repository, calls, prisma } = createRepository();
  prisma.user.findFirst = async args => {
    calls.findFirst.push(args);
    return null;
  };
  assert.equal(await repository.findEligibleTransferReceiver(
    otherOrganizationId, receivingInstructorId,
  ), null);
  assert.equal(calls.findFirst[0].where.organizationId, otherOrganizationId);
});
