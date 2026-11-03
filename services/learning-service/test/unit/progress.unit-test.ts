import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { ProgressService } from '../../src/modules/curriculum/progress.service';
import { assessmentConditions } from '../../src/modules/course-completion/assessment-conditions';
import {
  CompletionClientError,
  type CompletionSnapshot,
} from '../../src/infrastructure/clients/assessment/assessment-completion.client';

const user: CurrentUser = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  role: 'LEARNER',
  isAuthenticated: true,
};
const courseId = randomUUID();
const enrollmentId = randomUUID();
const materialId = randomUUID();
const quizId = randomUUID();
const assignmentId = randomUUID();
function snapshot(): CompletionSnapshot {
  return {
    schemaVersion: 1,
    snapshotId: randomUUID(),
    asOf: new Date().toISOString(),
    revision: 'fixture',
    organizationId: user.organizationId!,
    learnerId: user.userId,
    courseId,
    eligible: false,
    requiredComponentCount: 2,
    quizzes: [
      {
        assessmentId: quizId,
        attemptId: randomUUID(),
        recordedScore: '80',
        passingScore: '60',
        passed: true,
      },
    ],
    assignments: [
      {
        assessmentId: assignmentId,
        submissionId: randomUUID(),
        finalScore: '90',
        passingScore: '60',
        finalizedAt: new Date().toISOString(),
        passed: true,
        peerReview: { status: 'Pending', requiredCount: 2, completedCount: 1 },
      },
    ],
  };
}
function setup(value: unknown = snapshot(), completed = false) {
  let calls = 0;
  let treeCalls = 0;
  const service = new ProgressService(
    {
      findAccessibleEnrollment: async () => ({
        id: enrollmentId,
        courseId,
        status: completed ? 'Completed' : 'InProgress',
        storedStatus: completed ? 'Completed' : 'InProgress',
        enrollmentType: 'Required',
        dueAt: new Date('2026-10-01T17:00:00Z'),
        dueTimezone: 'Asia/Ho_Chi_Minh',
        completedAt: completed ? new Date('2026-10-02T00:00:00Z') : null,
        completedLate: completed ? true : null,
      }),
      getProgressCurriculum: async () => {
        treeCalls++;
        return {
          visibleLessons: [
            {
              lessonId: randomUUID(),
              materials: [
                {
                  materialId,
                  title: 'Reading',
                  materialType: 'Reading',
                  isRequired: true,
                  completed: false,
                },
                {
                  materialId: randomUUID(),
                  title: 'Optional',
                  materialType: 'Video',
                  isRequired: false,
                  completed: false,
                },
              ],
            },
          ],
        };
      },
    } as never,
    {
      getCompletionSnapshot: async (org, learner, course) => {
        calls++;
        assert.deepEqual(
          [org, learner, course],
          [user.organizationId, user.userId, courseId],
        );
        if (value instanceof Error) throw value;
        return value as CompletionSnapshot;
      },
    },
  );
  return { service, calls: () => calls, treeCalls: () => treeCalls };
}

void test('UC28 counts separate material, pass and peer duty conditions; never counts optional materials', async () => {
  const { service } = setup();
  const result = await service.getProgress(user, enrollmentId);
  assert.deepEqual(result.conditions, {
    state: 'ok',
    met: 2,
    total: 4,
    missing: [
      { kind: 'material', id: materialId },
      { kind: 'peerReview', id: assignmentId },
    ],
  });
  assert.equal(result.materials?.length, 2);
  assert.equal(result.enrollment.dueTimezone, 'Asia/Ho_Chi_Minh');
  assert.ok(!JSON.stringify(result).includes('percentage'));
});
void test('UC28 Completed returns historical summary without current tree or snapshot calls', async () => {
  const fixture = setup(new Error('must never call'), true);
  const result = await fixture.service.getProgress(user, enrollmentId);
  assert.deepEqual(Object.keys(result), ['enrollment']);
  assert.equal(result.enrollment.completedLate, true);
  assert.equal(result.enrollment.completedAt, '2026-10-02T00:00:00.000Z');
  assert.equal(fixture.calls(), 0);
  assert.equal(fixture.treeCalls(), 0);
});
for (const [label, value] of [
  ['503', new CompletionClientError('ASSESSMENT_UNAVAILABLE', 503)],
  ['timeout', new DOMException('Timeout', 'TimeoutError')],
  ['invalid snapshot', { ...snapshot(), requiredComponentCount: 100 }],
] as const) {
  void test(`UC28 assessment ${label} keeps materials and marks counts unknown`, async () => {
    const warn = mock.method(Logger.prototype, 'warn', () => undefined);
    try {
      const { service } = setup(value);
      const result = await service.getProgress(user, enrollmentId);
      assert.equal(result.materials?.length, 2);
      assert.deepEqual(result.assessment, { state: 'unavailable' });
      assert.deepEqual(result.conditions, {
        state: 'unavailable',
        met: null,
        total: null,
        missing: [{ kind: 'material', id: materialId }],
      });
      assert.deepEqual(warn.mock.calls[0].arguments, [
        { code: 'PROGRESS_ASSESSMENT_UNAVAILABLE', enrollmentId },
      ]);
    } finally {
      warn.mock.restore();
    }
  });
}
void test('UC28 materials-only course has an ok assessment with zero items', async () => {
  const result = await setup({
    ...snapshot(),
    quizzes: [],
    assignments: [],
    requiredComponentCount: 0,
    eligible: true,
  }).service.getProgress(user, enrollmentId);
  assert.deepEqual(result.assessment, { state: 'ok', items: [] });
  assert.equal(result.conditions?.total, 1);
});
for (const status of [
  'NotApplicable',
  'Satisfied',
  'Waived',
  'Pending',
  'Missed',
] as const) {
  void test(`UC28 shared worker recomputation handles peer duty ${status}`, () => {
    const facts = snapshot();
    facts.assignments[0].peerReview.status = status;
    const item = assessmentConditions(facts)[1];
    assert.equal(item.passed, true);
    assert.equal(
      item.learning,
      ['NotApplicable', 'Satisfied', 'Waived'].includes(status),
    );
  });
}

void test('UC28 missing list includes failed Quiz and unfinalized Assignment independently of peer duty', async () => {
  const facts = snapshot();
  facts.quizzes[0].recordedScore = '10';
  facts.quizzes[0].passed = false;
  facts.assignments[0].finalizedAt = null;
  facts.assignments[0].passed = false;
  facts.assignments[0].peerReview = {
    status: 'Satisfied',
    requiredCount: 2,
    completedCount: 2,
  };
  const result = await setup(facts).service.getProgress(user, enrollmentId);
  assert.deepEqual(result.conditions, {
    state: 'ok',
    met: 1,
    total: 4,
    missing: [
      { kind: 'material', id: materialId },
      { kind: 'quiz', id: quizId },
      { kind: 'assignment', id: assignmentId },
    ],
  });
});
