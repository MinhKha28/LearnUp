/** The yes/no answers learning-service needs before it lets a Learner leave a Course (UC25.4, BR-131). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AssessmentActivityService } from '../../src/modules/assessment-activity/assessment-activity.service';
import type { AssessmentActivityRepository } from '../../src/modules/assessment-activity/assessment-activity.repository';

const ORG = '00000000-0000-4000-8000-000000000001';
const LEARNER = '00000000-0000-4000-8000-0000000000c1';
const COURSE = '00000000-0000-4000-8000-000000000004';
const user = {
  userId: LEARNER,
  organizationId: ORG,
  role: 'LEARNER',
  isAuthenticated: true,
} as never;

const build = (flags: [boolean, boolean, boolean]) => {
  const calls: unknown[][] = [];
  const answer = (value: boolean) => (...args: unknown[]) => {
    calls.push(args);
    return Promise.resolve(value);
  };
  const repository = {
    hasQuizAttempt: answer(flags[0]),
    hasSubmission: answer(flags[1]),
    hasPeerReviewGiven: answer(flags[2]),
  } as unknown as AssessmentActivityRepository;
  return { service: new AssessmentActivityService(repository), calls };
};

describe('AssessmentActivityService', () => {
  test('answers the three flags, each asked in the Organization of the caller', async () => {
    const { service, calls } = build([true, false, true]);
    assert.deepEqual(await service.getActivity(user, LEARNER, COURSE), {
      hasQuizAttempt: true,
      hasSubmission: false,
      hasPeerReviewGiven: true,
    });
    assert.equal(calls.length, 3);
    for (const call of calls) assert.deepEqual(call, [ORG, LEARNER, COURSE]);
  });

  test('a Learner without any activity gets three false flags', async () => {
    const { service } = build([false, false, false]);
    assert.deepEqual(await service.getActivity(user, LEARNER, COURSE), {
      hasQuizAttempt: false,
      hasSubmission: false,
      hasPeerReviewGiven: false,
    });
  });

  test('the Learner of the path must be the caller (403), and nothing is read', async () => {
    const { service, calls } = build([true, true, true]);
    await assert.rejects(
      () =>
        service.getActivity(
          user,
          '00000000-0000-4000-8000-0000000000c2',
          COURSE,
        ),
      ForbiddenException,
    );
    assert.equal(calls.length, 0);
  });
});
