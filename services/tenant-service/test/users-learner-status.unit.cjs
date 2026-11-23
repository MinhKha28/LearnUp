// UC13.5 - Đổi trạng thái Learner trên Prisma giả (không cần Postgres), cùng harness với UC12.5 / UC12.6.
// Khóa dòng thật, đồng thời và chỉ mục duy nhất thuộc integration test.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const {
  ChangeLearnerStatusDto,
} = require('../dist/src/modules/users/dto/change-account-status.dto');
const { ORG_A, ORG_B, createHarness, id, outcome, userRow } = require('./fake-tenant-db.cjs');

const ACTIVATED = new Date('2026-10-01T00:00:00.000Z');

/** Harness của UC12.5 thêm các Learner của UC13.5. */
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
    learner('214', { status: 'Deactivated', activatedAt: null }), // Deactivated chưa từng kích hoạt
    learner('215', { deletedAt: new Date('2026-10-20T00:00:00.000Z') }), // đã xóa
    learner('311', { organizationId: ORG_B }), // Learner tổ chức khác
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

const change = (harness, suffix, action, body = {}) =>
  outcome(() =>
    harness.service.changeLearnerStatus(harness.user, id(suffix), { action, ...body }),
  );

const subscriptionOf = (harness) =>
  harness.db.state.subscriptions.find((row) => row.organizationId === ORG_A);

test('UC13.5: deactivate an Active Learner writes the event, the email and the audit', async () => {
  const harness = learnerHarness();
  const result = await change(harness, '211', 'DEACTIVATE', { reason: 'Nghỉ học' });
  assert.deepEqual(result.ok, { id: id('211'), status: 'Deactivated', changed: true });
  assert.equal(userRow(harness.db, '211').status, 'Deactivated');

  const outbox = harness.db.state.outbox;
  assert.deepEqual(
    outbox.map((row) => row.type),
    ['UserDeactivated', 'EmailRequested', 'AuditRecorded'],
  );
  const { type: _type, ...event } = outbox[0];
  assert.deepEqual(event, {
    eventType: 'UserDeactivated',
    userId: id('211'),
    organizationId: ORG_A,
    role: 'Learner',
    status: 'Deactivated',
  });
  assert.equal(outbox[1].email.templateCode, 'LEARNER_DEACTIVATED');
  assert.equal(outbox[1].email.to, 'l211@a.test');
  assert.doesNotMatch(outbox[1].email.body, /Nghỉ học/, 'the email never carries the reason');
  // Glossary: Learner = Học viên, Organizer = Quản lý đào tạo.
  assert.match(outbox[1].email.subject, /Tài khoản Học viên tại Org A/);
  assert.match(outbox[1].email.body, /liên hệ Quản lý đào tạo/);
  // Sau dòng chào (họ tên fixture là "Learner 211").
  assert.doesNotMatch(outbox[1].email.body.split('\n').slice(1).join('\n'), /Learner|Organizer/);
  assert.equal(outbox[2].record.actionType, 'LEARNER_DEACTIVATED');
  assert.equal(outbox[2].record.targetResourceId, id('211'));
  assert.deepEqual(outbox[2].record.details, { reason: 'Nghỉ học' });
  assert.ok(!harness.course.calls.length, 'no course hand-over for a Learner');
});

test('UC13.5: reactivate a Deactivated Learner writes the event, the email and the audit, with no seat check', async () => {
  const harness = learnerHarness();
  // BR-45: vô hiệu hóa không trả chỗ, nên kích hoạt lại không kiểm số chỗ dù gói đã đầy.
  subscriptionOf(harness).maxLearners = 0;
  const result = await change(harness, '212', 'REACTIVATE');
  assert.deepEqual(result.ok, { id: id('212'), status: 'Active', changed: true });
  assert.equal(userRow(harness.db, '212').status, 'Active');

  const outbox = harness.db.state.outbox;
  assert.deepEqual(
    outbox.map((row) => row.type),
    ['UserReactivated', 'EmailRequested', 'AuditRecorded'],
  );
  assert.equal(outbox[0].status, 'Active');
  assert.equal(outbox[1].email.templateCode, 'LEARNER_REACTIVATED');
  assert.equal(outbox[2].record.actionType, 'LEARNER_REACTIVATED');
  assert.deepEqual(outbox[2].record.details, {}, 'no reason given, no receiverId / chainIds');
});

test('UC13.5: a repeated call returns changed: false and writes nothing', async () => {
  const harness = learnerHarness();
  const first = await change(harness, '211', 'DEACTIVATE');
  assert.equal(first.ok.changed, true);
  const written = harness.db.state.outbox.length;

  const again = await change(harness, '211', 'DEACTIVATE');
  assert.deepEqual(again.ok, { id: id('211'), status: 'Deactivated', changed: false });
  const reactivateActive = await change(harness, '211', 'REACTIVATE');
  assert.equal(reactivateActive.ok.changed, true);
  const reactivateAgain = await change(harness, '211', 'REACTIVATE');
  assert.deepEqual(reactivateAgain.ok, { id: id('211'), status: 'Active', changed: false });

  assert.equal(harness.db.state.outbox.length, written * 2, 'only the two real changes wrote rows');
});

test('UC13.5: a Pending or never-activated account answers 409 and its invitation stays usable', async () => {
  const harness = learnerHarness();
  const pendingDeactivate = await change(harness, '213', 'DEACTIVATE');
  const pendingReactivate = await change(harness, '213', 'REACTIVATE');
  const neverActivated = await change(harness, '214', 'REACTIVATE');

  assert.equal(pendingDeactivate.status, 409);
  assert.equal(pendingDeactivate.error.code, 'ACCOUNT_NOT_ACTIVATED');
  assert.match(pendingDeactivate.error.message, /xóa tài khoản/, 'points to deleting the account');
  assert.equal(pendingReactivate.status, 409);
  assert.equal(pendingReactivate.error.code, 'ACCOUNT_NOT_DEACTIVATED');
  assert.equal(neverActivated.status, 409);
  assert.equal(neverActivated.error.code, 'ACCOUNT_NOT_ACTIVATED');

  assert.equal(userRow(harness.db, '213').status, 'Pending');
  assert.equal(userRow(harness.db, '214').status, 'Deactivated');
  const invitation = harness.db.state.accountTokens.find((token) => token.id === 't213');
  assert.equal(invitation.revokedAt, null, 'the invitation is not revoked');
  assert.equal(invitation.consumedAt, null);
  assert.deepEqual(harness.db.state.outbox, []);
});

test('UC13.5: another Organization, an Instructor id or a deleted Learner answers 404', async () => {
  const harness = learnerHarness();
  for (const suffix of ['311', '101', '215', '999']) {
    const result = await change(harness, suffix, 'DEACTIVATE');
    assert.equal(result.status, 404, suffix);
    assert.equal(result.error.code, 'LEARNER_NOT_FOUND', suffix);
  }
  assert.equal(userRow(harness.db, '311').status, 'Active');
  assert.equal(userRow(harness.db, '101').status, 'Active');
  assert.deepEqual(harness.db.state.outbox, []);
});

test('UC13.5: a Suspended Subscription answers 403, and Grace is allowed', async () => {
  const suspended = learnerHarness();
  subscriptionOf(suspended).status = 'Suspended';
  const refused = await change(suspended, '211', 'DEACTIVATE');
  assert.equal(refused.status, 403);
  assert.equal(refused.error.code, 'SUBSCRIPTION_NOT_ACTIVE');
  assert.equal(userRow(suspended.db, '211').status, 'Active');
  assert.deepEqual(suspended.db.state.outbox, []);

  const grace = learnerHarness();
  subscriptionOf(grace).status = 'Grace';
  const allowed = await change(grace, '211', 'DEACTIVATE');
  assert.equal(allowed.ok.changed, true);
  assert.equal(userRow(grace.db, '211').status, 'Deactivated');
});

test('UC13.5: a non-Active Organization answers 403', async () => {
  const harness = learnerHarness();
  harness.db.state.organizations.find((row) => row.id === ORG_A).status = 'Suspended';
  const result = await change(harness, '211', 'DEACTIVATE');
  assert.equal(result.status, 403);
  assert.equal(result.error.code, 'ORGANIZATION_NOT_ACTIVE');
});

test('UC12.5 regression after the lockAccounts / audit refactor: the audit still has receiverId and chainIds', async () => {
  const harness = createHarness();
  const result = await outcome(() =>
    harness.service.changeInstructorStatus(harness.user, id('101'), {
      action: 'DEACTIVATE',
      receiverInstructorId: id('102'),
      reason: 'Chuyển công tác',
    }),
  );
  assert.equal(result.ok.changed, true);
  const audit = harness.db.state.outbox.find((row) => row.record).record;
  assert.equal(audit.actionType, 'INSTRUCTOR_DEACTIVATED');
  assert.deepEqual(audit.details, {
    reason: 'Chuyển công tác',
    receiverId: id('102'),
    chainIds: ['c1', 'c2'],
  });
  // lockAccounts khóa đúng role Instructor cho người bị tác động và người tiếp nhận.
  assert.deepEqual(harness.db.locks.map((lockId) => lockId.slice(-3)), ['101', '102']);
});

test('UC13.5 DTO: receiverInstructorId is refused for a Learner, the reason keeps the UC12.5 rules', async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  const metadata = { type: 'body', metatype: ChangeLearnerStatusDto };
  const parsed = await pipe.transform({ action: 'DEACTIVATE', reason: '  Nghỉ   học  ' }, metadata);
  assert.equal(parsed.action, 'DEACTIVATE');
  assert.equal(parsed.reason, 'Nghỉ học');

  for (const body of [
    { action: 'DEACTIVATE', receiverInstructorId: id('102') },
    { action: 'DELETE' },
    { action: 'DEACTIVATE', reason: 'x'.repeat(1001) },
    { action: 'DEACTIVATE', reason: 'tab\u0007bell' },
  ]) {
    await assert.rejects(pipe.transform(body, metadata), (error) => {
      assert.equal(error.getStatus(), 400, JSON.stringify(body));
      return true;
    });
  }
});
