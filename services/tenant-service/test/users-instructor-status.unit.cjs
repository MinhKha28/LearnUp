// UC12.5 - Đổi trạng thái Instructor: hồi quy trên Prisma giả (không cần Postgres).
// Đặt SNAPSHOT_OUT=<file> để ghi kết quả từng ca ra JSON (so trước / sau refactor của UC12.6).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { after, test } = require('node:test');
const { ORG_A, createHarness, id, outcome, userRow } = require('./fake-tenant-db.cjs');

const snapshot = {};

function record(name, harness, result) {
  const { db, course } = harness;
  snapshot[name] = {
    result,
    users: db.state.users.map((row) => [row.id.slice(-3), row.status, row.deletedAt !== null]),
    chains: course.chains.map((chain) => [chain.chainId, chain.instructorId.slice(-3)]),
    outbox: db.state.outbox,
    courseCalls: course.calls,
    locks: db.locks.map((lockId) => lockId.slice(-3)),
  };
}

after(() => {
  if (process.env.SNAPSHOT_OUT) {
    fs.writeFileSync(process.env.SNAPSHOT_OUT, JSON.stringify(snapshot, null, 2));
  }
});

const deactivate = (harness, suffix, body = {}) =>
  outcome(() =>
    harness.service.changeInstructorStatus(harness.user, id(suffix), {
      action: 'DEACTIVATE',
      ...body,
    }),
  );

test('UC12.5 (A) không phụ trách chuỗi: vô hiệu hóa thẳng, thư + audit', async () => {
  const harness = createHarness();
  const result = await deactivate(harness, '103', { reason: 'Nghỉ phép' });
  record('A_no_chains', harness, result);
  assert.equal(result.ok.changed, true);
  assert.equal(result.ok.status, 'Deactivated');
  assert.deepEqual(result.ok.transferredCourses, []);
  assert.equal(userRow(harness.db, '103').status, 'Deactivated');
  const types = harness.db.state.outbox.map((row) => row.email?.templateCode ?? row.record.actionType);
  assert.deepEqual(types, ['INSTRUCTOR_DEACTIVATED', 'INSTRUCTOR_DEACTIVATED']);
  const audit = harness.db.state.outbox[1].record;
  assert.deepEqual(audit.details, { reason: 'Nghỉ phép', receiverId: null, chainIds: [] });
  assert.doesNotMatch(harness.db.state.outbox[0].email.body, /Nghỉ phép/);
  assert.ok(!harness.course.calls.some(([kind]) => kind === 'transfer'));
});

test('UC12.5 (B) có chuỗi + người tiếp nhận hợp lệ: chuyển rồi vô hiệu hóa', async () => {
  const harness = createHarness();
  const result = await deactivate(harness, '101', { receiverInstructorId: id('102') });
  record('B_transfer', harness, result);
  assert.equal(result.ok.changed, true);
  assert.deepEqual(
    result.ok.transferredCourses.map((chain) => chain.chainId),
    ['c1', 'c2'],
  );
  assert.deepEqual(result.ok.receiver, { id: id('102'), fullName: 'Instructor 102' });
  assert.ok(harness.course.chains.every((chain) => chain.instructorId === id('102')));
  assert.deepEqual(harness.db.locks.map((lockId) => lockId.slice(-3)), ['101', '102']);
  const templates = harness.db.state.outbox.filter((row) => row.email).map((row) => row.email.templateCode);
  assert.deepEqual(templates, ['INSTRUCTOR_DEACTIVATED', 'COURSE_CHAINS_TRANSFERRED']);
  const audit = harness.db.state.outbox.find((row) => row.record).record;
  assert.deepEqual(audit.details.chainIds, ['c1', 'c2']);
});

test('UC12.5 còn chuỗi, không gửi người tiếp nhận: 409 RECEIVER_REQUIRED', async () => {
  const harness = createHarness();
  const result = await deactivate(harness, '101');
  record('receiver_required', harness, result);
  assert.equal(result.status, 409);
  assert.equal(result.error.code, 'RECEIVER_REQUIRED');
  assert.equal(result.error.courses.length, 2);
  assert.equal(userRow(harness.db, '101').status, 'Active');
  assert.deepEqual(harness.db.state.outbox, []);
});

for (const [name, suffix] of [
  ['self', '101'],
  ['other_org', '301'],
  ['deactivated', '104'],
  ['pending', '105'],
  ['deleted', '106'],
]) {
  test(`UC12.5 người tiếp nhận không hợp lệ (${name}): 400 INVALID_RECEIVER`, async () => {
    const harness = createHarness();
    const result = await deactivate(harness, '101', { receiverInstructorId: id(suffix) });
    record(`invalid_receiver_${name}`, harness, result);
    assert.equal(result.status, 400);
    assert.equal(result.error.code, 'INVALID_RECEIVER');
    assert.equal(userRow(harness.db, '101').status, 'Active');
    assert.ok(harness.course.chains.every((chain) => chain.instructorId === id('101')));
  });
}

test('UC12.5 (C) không còn Instructor hợp lệ: 409 NO_VALID_RECEIVER + courses', async () => {
  const harness = createHarness();
  for (const row of harness.db.state.users) {
    if (row.organizationId === ORG_A && ['102', '103'].includes(row.id.slice(-3))) {
      row.status = 'Deactivated';
    }
  }
  const result = await deactivate(harness, '101', { receiverInstructorId: id('105') });
  record('C_no_valid_receiver', harness, result);
  assert.equal(result.status, 409);
  assert.equal(result.error.code, 'NO_VALID_RECEIVER');
  assert.equal(result.error.courses.length, 2);
});

test('UC12.5 bấm lặp / chưa kích hoạt / không tồn tại', async () => {
  const harness = createHarness();
  const repeated = await deactivate(harness, '104');
  const pending = await deactivate(harness, '105');
  const deleted = await deactivate(harness, '106');
  const learner = await deactivate(harness, '201');
  record('state_checks', harness, { repeated, pending, deleted, learner });
  assert.equal(repeated.ok.changed, false);
  assert.equal(pending.error.code, 'ACCOUNT_NOT_ACTIVATED');
  assert.equal(deleted.error.code, 'INSTRUCTOR_NOT_FOUND');
  assert.equal(learner.error.code, 'INSTRUCTOR_NOT_FOUND');
  assert.deepEqual(harness.db.state.outbox, []);
});

test('UC12.5 course-service lỗi: 503, không đổi gì', async () => {
  for (const step of ['count', 'list', 'transfer']) {
    const harness = createHarness();
    harness.course.fail[step] = true;
    const result = await deactivate(harness, '101', { receiverInstructorId: id('102') });
    record(`course_down_${step}`, harness, result);
    assert.equal(result.status, 503);
    assert.equal(result.error.code, 'COURSE_SERVICE_UNAVAILABLE');
    assert.equal(userRow(harness.db, '101').status, 'Active');
    assert.deepEqual(harness.db.state.outbox, []);
  }
});

test('UC12.5 vừa có chuỗi mới sau khi chuyển: 409, không hoàn tác chuyển, bấm lại thì xong', async () => {
  const harness = createHarness();
  harness.course.afterTransfer = () => {
    harness.course.afterTransfer = null;
    harness.course.chains.push({ chainId: 'c9', instructorId: id('101'), organizationId: ORG_A });
  };
  const first = await deactivate(harness, '101', { receiverInstructorId: id('102') });
  assert.equal(first.status, 409);
  assert.equal(first.error.code, 'MANAGED_COURSES_REMAINING');
  assert.equal(userRow(harness.db, '101').status, 'Active');
  assert.deepEqual(harness.db.state.outbox, []);
  const second = await deactivate(harness, '101', { receiverInstructorId: id('102') });
  record('managed_courses_remaining', harness, { first, second });
  assert.equal(second.ok.changed, true);
  assert.deepEqual(second.ok.transferredCourses.map((chain) => chain.chainId), ['c9']);
});

test('UC12.5 Subscription Suspended / Organization không Active: 403', async () => {
  const suspended = createHarness();
  suspended.db.state.subscriptions[0].status = 'Suspended';
  const bySubscription = await deactivate(suspended, '103');
  const inactive = createHarness();
  inactive.db.state.organizations[0].status = 'Suspended';
  const byOrganization = await deactivate(inactive, '103');
  const grace = createHarness();
  grace.db.state.subscriptions[0].status = 'Grace';
  const inGrace = await deactivate(grace, '103');
  record('subscription_checks', grace, { bySubscription, byOrganization, inGrace });
  assert.equal(bySubscription.error.code, 'SUBSCRIPTION_NOT_ACTIVE');
  assert.equal(byOrganization.error.code, 'ORGANIZATION_NOT_ACTIVE');
  assert.equal(inGrace.ok.changed, true);
});

test('UC12.5 kích hoạt lại', async () => {
  const harness = createHarness();
  const reactivate = (suffix) =>
    outcome(() =>
      harness.service.changeInstructorStatus(harness.user, id(suffix), {
        action: 'REACTIVATE',
      }),
    );
  const done = await reactivate('104');
  const active = await reactivate('103');
  const pending = await reactivate('105');
  const neverActivated = await reactivate('107');
  record('reactivate', harness, { done, active, pending, neverActivated });
  assert.equal(done.ok.changed, true);
  assert.equal(userRow(harness.db, '104').status, 'Active');
  assert.equal(active.ok.changed, false);
  assert.equal(pending.error.code, 'ACCOUNT_NOT_DEACTIVATED');
  assert.equal(neverActivated.error.code, 'ACCOUNT_NOT_ACTIVATED');
});

test('UC12.5 GET status-change', async () => {
  const harness = createHarness();
  const get = (suffix) =>
    outcome(() => harness.service.getInstructorStatusChange(harness.user, id(suffix)));
  const withChains = await get('101');
  const noChains = await get('103');
  const deactivated = await get('104');
  const pending = await get('105');
  harness.course.fail.count = true;
  const courseDown = await get('101');
  harness.course.fail.count = false;
  harness.db.state.users.forEach((row) => {
    if (['102', '103'].includes(row.id.slice(-3))) row.status = 'Deactivated';
  });
  const noReceiver = await get('101');
  record('status_change_preview', harness, {
    withChains,
    noChains,
    deactivated,
    pending,
    courseDown,
    noReceiver,
  });
  assert.equal(withChains.ok.canDeactivate, true);
  assert.deepEqual(
    withChains.ok.receivers.map((receiver) => receiver.id.slice(-3)),
    ['102', '103'],
  );
  assert.equal(noChains.ok.canDeactivate, true);
  assert.equal(deactivated.ok.blockReason, 'ALREADY_DEACTIVATED');
  assert.equal(pending.ok.blockReason, 'ACCOUNT_NOT_ACTIVATED');
  assert.equal(courseDown.ok.blockReason, 'COURSE_SERVICE_UNAVAILABLE');
  assert.equal(courseDown.ok.courses, null);
  assert.equal(noReceiver.ok.blockReason, 'NO_VALID_RECEIVER');
});
