const assert = require('node:assert/strict');
const { test } = require('node:test');
const { UsersService } = require('../dist/src/modules/users/users.service');

test('an invitation email expires with its activation link (BR-28, BR-30)', async () => {
  const enqueued = [];
  const service = new UsersService(
    {},
    {},
    { get: () => 'http://localhost:3000' },
    {},
    { enqueueEmail: async (_tx, params) => enqueued.push(params) },
    {},
    {},
    {},
  );
  const expiresAt = new Date('2026-11-01T08:30:00.000Z');
  for (const [role, templateCode] of [
    ['Instructor', 'INSTRUCTOR_INVITATION'],
    ['Learner', 'LEARNER_INVITATION'],
  ]) {
    await service.enqueueInvitationEmail(
      {},
      {
        organizationId: 'o1',
        organizationName: 'Org',
        userId: 'u1',
        to: 'invitee@example.test',
        fullName: 'Invitee',
        role,
        rawToken: 'synthetic-token',
        expiresAt,
      },
    );
    const { email } = enqueued.at(-1);
    assert.equal(email.templateCode, templateCode);
    assert.equal(email.expiresAt, expiresAt.toISOString());
    assert.match(email.body, /\/activate\/synthetic-token/);
  }
});
