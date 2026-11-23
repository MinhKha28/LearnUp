// UC13.6 - Xóa tài khoản Learner trên Prisma giả (không cần Postgres), cùng harness với UC12.6 / UC13.5.
// Khóa dòng thật, đồng thời và chỉ mục duy nhất có điều kiện thuộc integration test.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { DeleteLearnerDto } = require('../dist/src/modules/users/dto/delete-learner.dto');
const { ORG_A, ORG_B, createHarness, id, outcome, userRow } = require('./fake-tenant-db.cjs');

const ACTIVATED = new Date('2026-10-01T00:00:00.000Z');
const DELETED_BEFORE = new Date('2026-10-20T00:00:00.000Z');

/** Harness của UC12.6 thêm các Learner của UC13.6 (cùng bộ với UC13.5). */
function learnerHarness() {
  const harness = createHarness();
  const learner = (suffix, fields) => ({
    id: id(suffix),
    organizationId: ORG_A,
    email: `l${suffix}@a.test`,
    fullName: `Learner ${suffix}`,
    role: 'Learner',
    department: null,
    status: 'Active',
    activatedAt: ACTIVATED,
    deletedAt: null,
    ...fields,
  });
  harness.db.state.users.push(
    learner('211', {}), // Active
    learner('212', { status: 'Deactivated' }), // đã vô hiệu hóa
    learner('213', { status: 'Pending', activatedAt: null }), // chưa nhận lời mời
    learner('215', { deletedAt: DELETED_BEFORE }), // đã xóa
    learner('311', { organizationId: ORG_B }), // Learner tổ chức khác
    learner('312', { organizationId: ORG_B, deletedAt: DELETED_BEFORE }), // đã xóa ở tổ chức khác
  );
  harness.db.state.accountTokens.push({
    id: 't213',
    userId: id('213'),
    purpose: 'Invitation',
    consumedAt: null,
    revokedAt: null,
  });
  return harness;
}

// Learner của ORG_A chưa xóa trong seed: 201 (fake-tenant-db), 211, 212, 213.
const SEEDED_USED = 4;

const remove = (harness, suffix, body = {}) =>
  outcome(() => harness.service.deleteLearner(harness.user, id(suffix), body));

const subscriptionOf = (harness) =>
  harness.db.state.subscriptions.find((row) => row.organizationId === ORG_A);

const outboxKinds = (harness) =>
  harness.db.state.outbox.map((row) =>
    row.email
      ? `email:${row.email.templateCode}`
      : row.record
        ? `audit:${row.record.actionType}`
        : row.type,
  );

test('UC13.6: delete an Active Learner soft-deletes, writes the event, the email and the audit (BR-46, BR-47)', async () => {
  const harness = learnerHarness();
  const result = await remove(harness, '211', { reason: 'Nghỉ việc' });
  assert.equal(result.ok.id, id('211'));
  assert.equal(result.ok.changed, true);

  const row = userRow(harness.db, '211');
  assert.ok(row.deletedAt instanceof Date, 'soft delete: deleted_at is set');
  assert.equal(row.status, 'Active', 'status is kept, only deleted_at changes');

  assert.deepEqual(outboxKinds(harness), ['UserDeleted', 'email:LEARNER_DELETED', 'audit:LEARNER_DELETED']);
  const [event, email, audit] = harness.db.state.outbox;
  // BR-47: learning-service chuyển Enrollment chưa Completed sang Withdrawn khi nhận event này.
  assert.deepEqual(event, {
    type: 'UserDeleted',
    userId: id('211'),
    organizationId: ORG_A,
    role: 'Learner',
    deletedAt: row.deletedAt,
  });

  assert.equal(email.email.to, 'l211@a.test');
  assert.doesNotMatch(email.email.body, /Nghỉ việc/, 'the email never carries the reason (BR-337)');
  // Glossary như UC13.5: Learner = Học viên, Organizer = Quản lý đào tạo.
  assert.match(email.email.subject, /Tài khoản Học viên tại Org A đã bị xóa/);
  assert.match(email.email.body, /liên hệ Quản lý đào tạo/);
  assert.doesNotMatch(email.email.body.split('\n').slice(1).join('\n'), /Learner|Organizer/);

  assert.equal(audit.record.targetResourceId, id('211'));
  assert.deepEqual(audit.record.details, { reason: 'Nghỉ việc', previousStatus: 'Active' });

  assert.deepEqual(harness.course.calls, [], 'no course hand-over for a Learner (BR-51 is Instructor only)');
  assert.deepEqual(
    harness.db.locks.map((lockId) => lockId.slice(-3)),
    ['211'],
    'lockAccounts locks only the target Learner',
  );
});

test('UC13.6: a Deactivated Learner can be deleted and is still notified', async () => {
  const harness = learnerHarness();
  const result = await remove(harness, '212');
  assert.equal(result.ok.changed, true);
  assert.ok(userRow(harness.db, '212').deletedAt instanceof Date);
  assert.deepEqual(outboxKinds(harness), ['UserDeleted', 'email:LEARNER_DELETED', 'audit:LEARNER_DELETED']);
  assert.deepEqual(harness.db.state.outbox[2].record.details, { previousStatus: 'Deactivated' });
});

test('UC13.6: a Pending Learner: the invitation is revoked before users is locked, and no email is sent', async () => {
  const harness = learnerHarness();
  const result = await remove(harness, '213');
  assert.equal(result.ok.changed, true);
  assert.ok(userRow(harness.db, '213').deletedAt instanceof Date);

  const invitation = harness.db.state.accountTokens.find((token) => token.id === 't213');
  assert.ok(invitation.revokedAt instanceof Date, 'the open invitation link is revoked');
  const revokeAt = harness.db.rawQueries.findIndex((query) => query === `revokeOpen ${id('213')}`);
  const lockAt = harness.db.rawQueries.findIndex((query) => /FROM users .*FOR UPDATE/.test(query));
  assert.ok(revokeAt >= 0 && revokeAt < lockAt, 'account_tokens before users (same order as UC12.6)');

  assert.deepEqual(outboxKinds(harness), ['UserDeleted', 'audit:LEARNER_DELETED']);
  assert.equal(harness.db.state.outbox[1].record.details.previousStatus, 'Pending');
});

test('UC13.6: an already deleted Learner of the same Organization answers 200 changed:false and writes nothing', async () => {
  const harness = learnerHarness();
  const result = await remove(harness, '215');
  assert.equal(result.ok.changed, false);
  assert.equal(result.ok.seats.used, SEEDED_USED);
  assert.equal(userRow(harness.db, '215').deletedAt.getTime(), DELETED_BEFORE.getTime());
  assert.deepEqual(harness.db.state.outbox, []);
});

test('UC13.6: a repeated delete (retry) answers changed:false the second time and writes only once', async () => {
  const harness = learnerHarness();
  const first = await remove(harness, '211');
  const deletedAt = userRow(harness.db, '211').deletedAt.getTime();
  const written = harness.db.state.outbox.length;
  const second = await remove(harness, '211');

  assert.equal(first.ok.changed, true);
  assert.equal(second.ok.changed, false);
  assert.equal(second.ok.seats.used, SEEDED_USED - 1);
  assert.equal(userRow(harness.db, '211').deletedAt.getTime(), deletedAt);
  assert.equal(harness.db.state.outbox.length, written, 'only the first call enqueues');
});

for (const [name, suffix] of [
  ['Learner của tổ chức khác', '311'],
  ['Learner đã xóa ở tổ chức khác', '312'],
  ['id của Instructor', '101'],
  ['id không tồn tại', '999'],
]) {
  test(`UC13.6: 404 LEARNER_NOT_FOUND: ${name}`, async () => {
    const harness = learnerHarness();
    const before = structuredClone(harness.db.state.users);
    const result = await remove(harness, suffix);
    assert.equal(result.status, 404);
    assert.equal(result.error.code, 'LEARNER_NOT_FOUND');
    assert.deepEqual(harness.db.state.users, before, 'no account is touched');
    assert.deepEqual(harness.db.state.outbox, []);
  });
}

test('UC13.6: seats are released: full -> delete -> one seat left (BR-31, BR-46)', async () => {
  const harness = learnerHarness();
  subscriptionOf(harness).maxLearners = SEEDED_USED;
  const result = await remove(harness, '211');
  assert.deepEqual(
    [result.ok.seats.used, result.ok.seats.max, result.ok.seats.remaining, result.ok.seats.canCreate],
    [SEEDED_USED - 1, SEEDED_USED, 1, true],
  );
  // Vô hiệu hóa KHÔNG giải phóng chỗ (BR-45): 212 Deactivated vẫn được đếm.
  assert.equal(userRow(harness.db, '212').deletedAt, null);
});

test('UC13.6: the email can be reused after deletion (BR-38, BR-39)', async () => {
  const harness = learnerHarness();
  const lookup = () =>
    harness.service.findAccountByEmailAcrossOrganizations(harness.db.prisma, 'l211@a.test');
  assert.deepEqual(await lookup(), { id: id('211') }, 'email is taken before deletion');
  await remove(harness, '211');
  assert.equal(await lookup(), null, 'email is free for a new account after deletion');
});

test('UC13.6: a Suspended Subscription or a non-Active Organization answers 403, Grace is allowed (BR-22, BR-24)', async () => {
  const suspended = learnerHarness();
  subscriptionOf(suspended).status = 'Suspended';
  const refused = await remove(suspended, '211');
  assert.equal(refused.status, 403);
  assert.equal(refused.error.code, 'SUBSCRIPTION_NOT_ACTIVE');
  assert.equal(userRow(suspended.db, '211').deletedAt, null);
  assert.deepEqual(suspended.db.state.outbox, []);

  const inactive = learnerHarness();
  inactive.db.state.organizations.find((row) => row.id === ORG_A).status = 'Suspended';
  const blocked = await remove(inactive, '211');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.error.code, 'ORGANIZATION_NOT_ACTIVE');
  assert.equal(userRow(inactive.db, '211').deletedAt, null);

  const grace = learnerHarness();
  subscriptionOf(grace).status = 'Grace';
  const allowed = await remove(grace, '211');
  assert.equal(allowed.ok.changed, true);
  assert.ok(userRow(grace.db, '211').deletedAt instanceof Date);
});

test('UC13.6: a failure after revoking the invitation rolls everything back', async () => {
  const harness = learnerHarness();
  harness.service.enqueueStatusAudit = async () => {
    throw new Error('outbox down');
  };
  await assert.rejects(remove(harness, '213'), /outbox down/);
  assert.equal(userRow(harness.db, '213').deletedAt, null);
  const invitation = harness.db.state.accountTokens.find((token) => token.id === 't213');
  assert.equal(invitation.revokedAt, null, 'the invitation revoke is rolled back');
  assert.deepEqual(harness.db.state.outbox, []);
});

test('UC13.6 DTO: receiverInstructorId is refused for a Learner, the reason keeps the UC12.6 rules (BR-337)', async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  const metadata = { type: 'body', metatype: DeleteLearnerDto };
  const parsed = await pipe.transform({ reason: '  Nghỉ   việc  ' }, metadata);
  assert.equal(parsed.reason, 'Nghỉ việc');
  const empty = await pipe.transform({}, metadata);
  assert.equal(empty.reason, undefined, 'the reason is optional');

  for (const body of [
    { receiverInstructorId: id('102') },
    { reason: 'x'.repeat(1001) },
    { reason: 'tab\u0007bell' },
  ]) {
    await assert.rejects(pipe.transform(body, metadata), (error) => {
      assert.equal(error.getStatus(), 400, JSON.stringify(body));
      return true;
    });
  }
});
