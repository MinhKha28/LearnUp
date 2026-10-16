import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import {
  classifyLearners,
  type AssignmentEnrollment,
} from '../../src/modules/assignments/classify-learners';
import {
  runAssignmentTransaction,
  OptionalInsertConflict,
  concurrentChange,
} from '../../src/modules/assignments/assignment-retry';
import type { LookupLearner } from '../../src/infrastructure/clients/tenant/tenant.client';

const item = (
  userId = randomUUID(),
  extra: Partial<LookupLearner> = {},
): LookupLearner => ({
  userId,
  role: 'Learner',
  status: 'Active',
  activatedAt: null,
  deletedAt: null,
  fullName: 'Test',
  email: 'test@example.test',
  ...extra,
});
const enrollment = (
  userId: string,
  extra: Partial<AssignmentEnrollment> = {},
): AssignmentEnrollment => ({
  id: randomUUID(),
  learnerId: userId,
  enrollmentType: 'Optional',
  status: 'NotStarted',
  firstActivityAt: null,
  ...extra,
});

test('classification returns every invalid learner with reason precedence', () => {
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const users = [
    item(ids[1], { role: 'Instructor', deletedAt: new Date().toISOString() }),
    item(ids[2], {
      deletedAt: new Date().toISOString(),
      status: 'Deactivated',
    }),
    item(ids[3], { status: 'Deactivated' }),
    item(ids[4]),
  ];
  const result = classifyLearners(ids, users, [
    enrollment(ids[4], { enrollmentType: 'Required', status: 'Completed' }),
  ]);
  assert.deepEqual(
    result.errors,
    ids.map((learnerId, index) => ({
      learnerId,
      reason: [
        'NOT_IN_ORGANIZATION',
        'NOT_A_LEARNER',
        'ACCOUNT_DELETED',
        'ACCOUNT_DEACTIVATED',
        'ALREADY_ASSIGNED',
      ][index],
    })),
  );
  assert.equal(result.plans.length, 0);
});

test('classification accepts Pending and produces all four assignment kinds', () => {
  const users = Array.from({ length: 4 }, () =>
    item(undefined, { status: 'Pending' }),
  );
  const ids = users.map((u) => u.userId);
  const result = classifyLearners(ids, users, [
    enrollment(ids[1], { status: 'InProgress', firstActivityAt: new Date() }),
    enrollment(ids[2], { status: 'Completed' }),
    enrollment(ids[3], { status: 'Withdrawn' }),
  ]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.plans.map((p) => p.kind),
    ['CREATE', 'CONVERT', 'CONVERT_COMPLETED', 'RESTORE'],
  );
});

test('Required enrollment is already assigned in every status', () => {
  for (const status of [
    'NotStarted',
    'InProgress',
    'Completed',
    'Exempted',
    'Halted',
    'Withdrawn',
  ]) {
    const user = item();
    assert.equal(
      classifyLearners(
        [user.userId],
        [user],
        [enrollment(user.userId, { enrollmentType: 'Required', status })],
      ).errors[0].reason,
      'ALREADY_ASSIGNED',
    );
  }
});

const logger = () => ({
  debugMessages: [] as string[],
  warnMessages: [] as string[],
  debug(message: string) {
    this.debugMessages.push(message);
  },
  warn(message: string) {
    this.warnMessages.push(message);
  },
});
const isConcurrent = (e: unknown) =>
  e instanceof HttpException &&
  e.getStatus() === 409 &&
  (e.getResponse() as { code: string }).code === 'CONCURRENT_CHANGE';

test('Optional conflict retries once and succeeds without delay', async () => {
  let calls = 0;
  const log = logger();
  assert.equal(
    await runAssignmentTransaction(
      async () => {
        if (++calls === 1) throw new OptionalInsertConflict();
        return 'ok';
      },
      log,
      'course',
      500,
    ),
    'ok',
  );
  assert.equal(calls, 2);
  assert.match(log.debugMessages[1], /retryCount=1/);
  assert.equal(log.warnMessages.length, 0);
});
test('Required conflict returns 409 immediately without retry', async () => {
  let calls = 0;
  await assert.rejects(
    runAssignmentTransaction(
      async () => {
        calls++;
        throw concurrentChange();
      },
      logger(),
      'course',
      1,
    ),
    isConcurrent,
  );
  assert.equal(calls, 1);
});
test('three Optional conflicts return 409 and warn with course and learner count', async () => {
  let calls = 0;
  const log = logger();
  await assert.rejects(
    runAssignmentTransaction(
      async () => {
        calls++;
        throw new OptionalInsertConflict();
      },
      log,
      'course-123',
      500,
    ),
    isConcurrent,
  );
  assert.equal(calls, 3);
  assert.equal(log.warnMessages.length, 1);
  assert.match(log.warnMessages[0], /courseId=course-123 learnerCount=500/);
});
