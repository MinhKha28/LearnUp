const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const {
  UsersController,
} = require('../dist/src/modules/users/users.controller');

const validOrganizationId = randomUUID();
const organizer = { id: randomUUID(), email: 'organizer@example.com' };

function controllerWith(getOrganizerForNotification) {
  return new UsersController({ getOrganizerForNotification });
}

test('UC20: invalid Organization UUID yields 400 without querying Tenant', async () => {
  let calls = 0;
  const controller = controllerWith(async () => {
    calls++;
    return organizer;
  });
  await assert.rejects(
    controller.getOrganizerForNotification('not-a-uuid'),
    (error) => error.getStatus() === 400,
  );
  assert.equal(calls, 0);
});

test('UC20: valid Organization UUID is passed to service', async () => {
  const inputs = [];
  const controller = controllerWith(async (organizationId) => {
    inputs.push(organizationId);
    return organizer;
  });
  assert.deepEqual(
    await controller.getOrganizerForNotification(validOrganizationId),
    organizer,
  );
  assert.deepEqual(inputs, [validOrganizationId]);
});

test('UC20: missing Organizer returns the service NotFound', async () => {
  const { NotFoundException } = require('@nestjs/common');
  const controller = controllerWith(async () => {
    throw new NotFoundException({
      code: 'ORGANIZER_NOT_FOUND',
      message: 'Active Organizer not found.',
    });
  });
  await assert.rejects(
    controller.getOrganizerForNotification(validOrganizationId),
    (error) => error.getStatus() === 404,
  );
});
