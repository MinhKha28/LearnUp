/**
 * What an answer of Learning Service (assessment-access) lets the Learner do (BR-210): Full does everything, ReadOnly
 * (Completed) only reads, None (Halted, Withdrawn) is shut out, and a Learner who is not enrolled is refused.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  AssessmentAccess,
  AssessmentAccessLevel,
  EnrollmentClient,
} from '../../src/infrastructure/clients/learning/enrollment.client';
import {
  assertCanWrite,
  isReadOnly,
  requireAccess,
} from '../../src/modules/learner-submissions/learner-access';
import { COURSE, instructor, rejectsWith } from './fixtures';

const ENROLLMENT = '00000000-0000-4000-8000-0000000000e1';
const learner = { ...instructor, role: 'LEARNER' as const };

const access = (level: AssessmentAccessLevel): AssessmentAccess => ({
  enrollmentId: ENROLLMENT,
  status: level === 'ReadOnly' ? 'Completed' : 'InProgress',
  access: level,
});

const client = (answer: AssessmentAccess | null) => {
  const asked: { courseId: string; userId: string }[] = [];
  const stub: EnrollmentClient = {
    getAssessmentAccess: (courseId, user) => {
      asked.push({ courseId, userId: user.userId });
      return Promise.resolve(answer);
    },
  };
  return { asked, stub };
};

describe('requireAccess', () => {
  test('Full and ReadOnly let the Learner in, and the answer is given back', async () => {
    for (const level of ['Full', 'ReadOnly'] as const) {
      const { stub, asked } = client(access(level));
      assert.deepEqual(await requireAccess(stub, learner, COURSE), access(level));
      assert.deepEqual(asked, [{ courseId: COURSE, userId: learner.userId }]);
    }
  });

  test('None (Halted, Withdrawn) shuts the Learner out: 409 ENROLLMENT_NOT_ACTIVE', async () => {
    await rejectsWith(
      requireAccess(client(access('None')).stub, learner, COURSE),
      ConflictException,
      'ENROLLMENT_NOT_ACTIVE',
    );
  });

  test('a Learner who is not enrolled is refused: 403 NOT_ENROLLED', async () => {
    await rejectsWith(
      requireAccess(client(null).stub, learner, COURSE),
      ForbiddenException,
      'NOT_ENROLLED',
    );
  });

  test('when Learning Service cannot answer, the error goes up: nothing is let through', async () => {
    const failing: EnrollmentClient = {
      getAssessmentAccess: () => Promise.reject(new Error('down')),
    };
    await assert.rejects(requireAccess(failing, learner, COURSE), /down/);
  });
});

describe('isReadOnly and assertCanWrite (BR-210)', () => {
  test('only ReadOnly is read-only, and only ReadOnly refuses a write with 409 ENROLLMENT_COMPLETED', () => {
    assert.equal(isReadOnly(access('Full')), false);
    assert.equal(isReadOnly(access('ReadOnly')), true);
    assert.doesNotThrow(() => assertCanWrite(access('Full')));
    assert.throws(
      () => assertCanWrite(access('ReadOnly')),
      (error: unknown) =>
        error instanceof ConflictException &&
        (error.getResponse() as { code?: string }).code === 'ENROLLMENT_COMPLETED',
    );
  });
});
