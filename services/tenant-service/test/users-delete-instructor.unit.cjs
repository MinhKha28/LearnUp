// UC12.6 - Xóa tài khoản Instructor trên Prisma giả (không cần Postgres).
// Chỉ mục duy nhất có điều kiện, khóa và đồng thời thật nằm ở users-delete-instructor.integration.cjs.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  SignInAccessService,
} = require('../dist/src/modules/sign-in-access/sign-in-access.service');
const { ORG_A, createHarness, id, outcome, userRow } = require('./fake-tenant-db.cjs');

const remove = (harness, suffix, body = {}) =>
  outcome(() => harness.service.deleteInstructor(harness.user, id(suffix), body));
const preview = (harness, suffix) =>
  outcome(() => harness.service.getInstructorDeletion(harness.user, id(suffix)));
const outboxKinds = (harness) =>
  harness.db.state.outbox.map((row) =>
    row.email ? `email:${row.email.templateCode}` : `audit:${row.record.actionType}`,
  );
// Instructor chưa xóa của tổ chức A trong seed: 101, 102, 103, 104, 105, 107.
const SEEDED_USED = 6;

test('còn chuỗi + người tiếp nhận hợp lệ: chuyển quyền rồi xóa mềm, giải phóng chỗ', async () => {
  const harness = createHarness();
  const result = await remove(harness, '101', {
    receiverInstructorId: id('102'),
    reason: 'Nghỉ việc',
  });
  assert.equal(result.ok.changed, true);
  assert.deepEqual(result.ok.transferredCourses.map((chain) => chain.chainId), ['c1', 'c2']);
  assert.deepEqual(result.ok.receiver, { id: id('102'), fullName: 'Instructor 102' });
  assert.equal(result.ok.seats.used, SEEDED_USED - 1);
  assert.equal(result.ok.seats.remaining, 8 - (SEEDED_USED - 1));

  const deleted = userRow(harness.db, '101');
  assert.ok(deleted.deletedAt instanceof Date, 'deleted_at is set (soft delete)');
  assert.equal(deleted.status, 'Active', 'status is kept; deleted_at is the deletion marker');
  assert.ok(harness.course.chains.every((chain) => chain.instructorId === id('102')));
  assert.deepEqual(
    harness.course.calls.map(([kind]) => kind),
    ['count', 'list', 'transfer', 'count'],
  );

  assert.deepEqual(outboxKinds(harness), [
    'email:INSTRUCTOR_DELETED',
    'email:COURSE_CHAINS_TRANSFERRED',
    'audit:INSTRUCTOR_DELETED',
  ]);
  const [deletedEmail, receiverEmail, audit] = harness.db.state.outbox;
  assert.equal(deletedEmail.email.to, 'i101@a.test');
  assert.equal(deletedEmail.organizationId, ORG_A);
  assert.doesNotMatch(deletedEmail.email.body, /Nghỉ việc/, 'reason is never emailed');
  assert.equal(receiverEmail.email.to, 'i102@a.test');
  assert.match(receiverEmail.email.body, /Course c1[\s\S]*Course c2/);
  assert.equal(audit.aggregateId, id('101'));
  assert.equal(audit.record.organizationId, ORG_A);
  assert.equal(audit.record.actorUserId, harness.user.userId);
  assert.equal(audit.record.targetResourceId, id('101'));
  assert.deepEqual(audit.record.details, {
    reason: 'Nghỉ việc',
    previousStatus: 'Active',
    receiverId: id('102'),
    chainIds: ['c1', 'c2'],
  });
});

test('còn chuỗi + không còn Instructor hợp lệ khác: 409 NO_VALID_RECEIVER kèm danh sách Course', async () => {
  const harness = createHarness();
  for (const suffix of ['102', '103']) userRow(harness.db, suffix).status = 'Deactivated';
  const result = await remove(harness, '101', { receiverInstructorId: id('105') });
  assert.equal(result.status, 409);
  assert.equal(result.error.code, 'NO_VALID_RECEIVER');
  assert.deepEqual(result.error.courses.map((chain) => chain.chainId), ['c1', 'c2']);
  assert.equal(userRow(harness.db, '101').deletedAt, null);
  assert.deepEqual(harness.db.state.outbox, []);
  assert.ok(!harness.course.calls.some(([kind]) => kind === 'transfer'));
});

test('còn chuỗi, không chọn người tiếp nhận: 409 RECEIVER_REQUIRED', async () => {
  const harness = createHarness();
  const result = await remove(harness, '101');
  assert.equal(result.status, 409);
  assert.equal(result.error.code, 'RECEIVER_REQUIRED');
  assert.equal(result.error.courses.length, 2);
  assert.equal(userRow(harness.db, '101').deletedAt, null);
});

for (const [name, suffix] of [
  ['khác tổ chức', '301'],
  ['bị vô hiệu hóa', '104'],
  ['chưa kích hoạt', '105'],
  ['đã bị xóa', '106'],
  ['chính người bị xóa', '101'],
]) {
  test(`người tiếp nhận không hợp lệ (${name}): 400 INVALID_RECEIVER, không đổi gì`, async () => {
    const harness = createHarness();
    const result = await remove(harness, '101', { receiverInstructorId: id(suffix) });
    assert.equal(result.status, 400);
    assert.equal(result.error.code, 'INVALID_RECEIVER');
    assert.match(result.error.message, /khác người bị xóa/);
    assert.equal(userRow(harness.db, '101').deletedAt, null);
    assert.ok(harness.course.chains.every((chain) => chain.instructorId === id('101')));
    assert.deepEqual(harness.db.state.outbox, []);
  });
}

test('xóa tài khoản đã bị xóa trong cùng tổ chức: 200 changed:false, không phát gì', async () => {
  const harness = createHarness();
  const before = userRow(harness.db, '106').deletedAt.getTime();
  const result = await remove(harness, '106');
  assert.equal(result.ok.changed, false);
  assert.deepEqual(result.ok.transferredCourses, []);
  assert.equal(result.ok.receiver, null);
  assert.equal(result.ok.seats.used, SEEDED_USED);
  assert.equal(userRow(harness.db, '106').deletedAt.getTime(), before);
  assert.deepEqual(harness.db.state.outbox, []);
  assert.deepEqual(harness.course.calls, []);
});

test('xóa lặp lại (retry sau khi đã xóa xong): lần 2 trả changed:false', async () => {
  const harness = createHarness();
  const first = await remove(harness, '103');
  const second = await remove(harness, '103');
  assert.equal(first.ok.changed, true);
  assert.equal(second.ok.changed, false);
  assert.equal(second.ok.seats.used, SEEDED_USED - 1);
  assert.equal(harness.db.state.outbox.length, 2, 'only the first call enqueues');
});

for (const [name, target] of [
  ['đã xóa ở tổ chức khác', id('302')],
  ['Instructor đang hoạt động của tổ chức khác', id('301')],
  ['Learner', id('201')],
  ['id không tồn tại', '01900000-0000-7000-8000-000000000999'],
]) {
  test(`404 INSTRUCTOR_NOT_FOUND: ${name}`, async () => {
    const harness = createHarness();
    const result = await outcome(() => harness.service.deleteInstructor(harness.user, target, {}));
    assert.equal(result.status, 404);
    assert.equal(result.error.code, 'INSTRUCTOR_NOT_FOUND');
    assert.deepEqual(harness.db.state.outbox, []);
    const row = harness.db.state.users.find((user) => user.id === target);
    if (row) assert.ok(row.id !== id('302') ? row.deletedAt === null : row.deletedAt instanceof Date);
  });
}

test('email được cấp lại sau khi xóa (BR-38, BR-39)', async () => {
  const harness = createHarness();
  const lookup = () =>
    harness.service.findAccountByEmailAcrossOrganizations(harness.db.prisma, 'i103@a.test');
  assert.deepEqual(await lookup(), { id: id('103') }, 'email is taken before deletion');
  await remove(harness, '103');
  assert.equal(await lookup(), null, 'email is free for a new account after deletion');
});

test('seat được giải phóng: hết chỗ -> xóa -> còn 1 chỗ, tạo được', async () => {
  const harness = createHarness();
  harness.db.state.subscriptions[0].maxInstructors = SEEDED_USED;
  const full = await harness.service.getInstructorSeats(harness.user);
  assert.deepEqual([full.used, full.remaining, full.canCreate], [SEEDED_USED, 0, false]);
  const result = await remove(harness, '103');
  assert.deepEqual(
    [result.ok.seats.used, result.ok.seats.remaining, result.ok.seats.canCreate],
    [SEEDED_USED - 1, 1, true],
  );
  // Vô hiệu hóa KHÔNG giải phóng chỗ (BR-45): 104 Deactivated vẫn được đếm.
  assert.equal(userRow(harness.db, '104').status, 'Deactivated');
});

test('tài khoản Pending: thu hồi lời mời trước khi khóa users, không gửi thư', async () => {
  const harness = createHarness();
  const result = await remove(harness, '105');
  assert.equal(result.ok.changed, true);
  const token = harness.db.state.accountTokens.find((row) => row.id === 't105');
  assert.ok(token.revokedAt instanceof Date, 'open invitation link is revoked');
  const revokeAt = harness.db.rawQueries.findIndex((query) => query.startsWith('revokeOpen'));
  const lockAt = harness.db.rawQueries.findIndex((query) => /FROM users .*FOR UPDATE/.test(query));
  assert.ok(revokeAt >= 0 && revokeAt < lockAt, 'account_tokens before users (same order as UC04)');
  assert.deepEqual(outboxKinds(harness), ['audit:INSTRUCTOR_DELETED']);
  assert.equal(harness.db.state.outbox[0].record.details.previousStatus, 'Pending');
});

test('tài khoản Deactivated vẫn còn chuỗi (khe 15 phút của UC12.5): vẫn phải chuyển quyền', async () => {
  const harness = createHarness();
  harness.course.chains.push({ chainId: 'c4', instructorId: id('104'), organizationId: ORG_A });
  const blocked = await remove(harness, '104');
  assert.equal(blocked.error.code, 'RECEIVER_REQUIRED');
  const done = await remove(harness, '104', { receiverInstructorId: id('103') });
  assert.equal(done.ok.changed, true);
  assert.deepEqual(outboxKinds(harness), [
    'email:INSTRUCTOR_DELETED',
    'email:COURSE_CHAINS_TRANSFERRED',
    'audit:INSTRUCTOR_DELETED',
  ]);
  assert.equal(harness.db.state.outbox[2].record.details.previousStatus, 'Deactivated');
});

test('course-service lỗi ở bất kỳ bước nào: 503, rollback cả việc thu hồi lời mời', async () => {
  for (const step of ['count', 'list', 'transfer']) {
    const harness = createHarness();
    harness.course.chains.push({ chainId: 'c5', instructorId: id('105'), organizationId: ORG_A });
    harness.course.fail[step] = true;
    const result = await remove(harness, '105', { receiverInstructorId: id('102') });
    assert.equal(result.status, 503, step);
    assert.equal(result.error.code, 'COURSE_SERVICE_UNAVAILABLE');
    assert.equal(userRow(harness.db, '105').deletedAt, null);
    assert.equal(harness.db.state.accountTokens[0].revokedAt, null);
    assert.deepEqual(harness.db.state.outbox, []);
  }
});

test('chuyển xong nhưng vừa có chuỗi mới: 409, không hoàn tác chuyển quyền; bấm lại thì xóa được', async () => {
  const harness = createHarness();
  harness.course.afterTransfer = () => {
    harness.course.afterTransfer = null;
    harness.course.chains.push({ chainId: 'c9', instructorId: id('101'), organizationId: ORG_A });
  };
  const first = await remove(harness, '101', { receiverInstructorId: id('102') });
  assert.equal(first.error.code, 'MANAGED_COURSES_REMAINING');
  assert.equal(userRow(harness.db, '101').deletedAt, null);
  assert.deepEqual(harness.db.state.outbox, []);
  assert.equal(harness.course.chains.filter((chain) => chain.instructorId === id('102')).length, 2);
  const second = await remove(harness, '101', { receiverInstructorId: id('102') });
  assert.equal(second.ok.changed, true);
  assert.deepEqual(second.ok.transferredCourses.map((chain) => chain.chainId), ['c9']);
});

test('Subscription Suspended / Organization không Active: 403; Grace: cho phép', async () => {
  const suspended = createHarness();
  suspended.db.state.subscriptions[0].status = 'Suspended';
  assert.equal((await remove(suspended, '103')).error.code, 'SUBSCRIPTION_NOT_ACTIVE');
  assert.equal(userRow(suspended.db, '103').deletedAt, null);
  const inactive = createHarness();
  inactive.db.state.organizations[0].status = 'Suspended';
  assert.equal((await remove(inactive, '103')).error.code, 'ORGANIZATION_NOT_ACTIVE');
  const grace = createHarness();
  grace.db.state.subscriptions[0].status = 'Grace';
  assert.equal((await remove(grace, '103')).ok.changed, true);
});

test('sau khi xóa, sign-in-access từ chối ACCOUNT_NOT_FOUND (identity chặn login/refresh)', async () => {
  const harness = createHarness();
  const signIn = new SignInAccessService({
    findUserWithOrganization: async (userId) => {
      const row = harness.db.state.users.find((user) => user.id === userId);
      return row ? { ...row, organization: harness.db.state.organizations[0] } : null;
    },
    findCurrentSubscription: async () => harness.db.state.subscriptions[0],
  });
  assert.equal((await signIn.check(id('103'))).allowed, true);
  await remove(harness, '103');
  assert.deepEqual(await signIn.check(id('103')), {
    allowed: false,
    accessMode: null,
    reason: 'ACCOUNT_NOT_FOUND',
  });
});

test('GET deletion: dữ liệu cho dialog', async () => {
  const harness = createHarness();
  const withChains = await preview(harness, '101');
  assert.equal(withChains.ok.canDelete, true);
  assert.equal(withChains.ok.blockReason, null);
  assert.equal(withChains.ok.courses.length, 2);
  assert.deepEqual(withChains.ok.receivers.map((receiver) => receiver.id.slice(-3)), ['102', '103']);

  const pending = await preview(harness, '105');
  assert.deepEqual(
    [pending.ok.status, pending.ok.activated, pending.ok.canDelete, pending.ok.courses],
    ['Pending', false, true, []],
  );
  assert.deepEqual(pending.ok.receivers, []);
  assert.equal((await preview(harness, '104')).ok.canDelete, true);

  assert.equal((await preview(harness, '106')).error.code, 'INSTRUCTOR_NOT_FOUND');
  assert.equal((await preview(harness, '301')).error.code, 'INSTRUCTOR_NOT_FOUND');

  harness.course.fail.count = true;
  const down = await preview(harness, '101');
  assert.deepEqual(
    [down.ok.canDelete, down.ok.blockReason, down.ok.courses],
    [false, 'COURSE_SERVICE_UNAVAILABLE', null],
  );
  harness.course.fail.count = false;

  for (const suffix of ['102', '103']) userRow(harness.db, suffix).status = 'Deactivated';
  const none = await preview(harness, '101');
  assert.deepEqual([none.ok.canDelete, none.ok.blockReason], [false, 'NO_VALID_RECEIVER']);
  assert.equal(none.ok.courses.length, 2);
});
