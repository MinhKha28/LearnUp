import type { CurrentUser } from '@learnup/ts-common';
import { ForbiddenException } from '@nestjs/common';
import {
  type EnrolledCourse,
  type EnrollmentClient,
} from '../../infrastructure/clients/learning/enrollment.client';
import type { ILearnerAttemptState } from './interfaces/learner-submission.interface';

/** Learner screens (UC29, UC30): only a Learner of an Organization. Returns the Organization. */
export function requireLearner(user: CurrentUser): string {
  if (user.role !== 'LEARNER' || !user.organizationId) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only a Learner can do this.',
    });
  }
  return user.organizationId;
}

/** PRE-1 of UC29 / UC30: the Learner is enrolled in the Course. */
export async function requireEnrollment(
  enrollments: EnrollmentClient,
  user: CurrentUser,
  courseId: string,
): Promise<EnrolledCourse> {
  const enrollment = await enrollments.findEnrollment(courseId, user);
  if (!enrollment) {
    throw new ForbiddenException({
      code: 'NOT_ENROLLED',
      message: 'You are not enrolled in the Course of this Assessment.',
    });
  }
  return enrollment;
}

interface LockState {
  consecutiveCount: number;
  lockedUntil: Date | null;
}

/** BR-176: after m hours the Assessment opens again and counting starts from zero. */
export const lockExpired = (state: LockState, now: Date): boolean =>
  state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime();

/** BR-175 / BR-176 / BR-179: how many tries are left and, when locked, until when. */
export function attemptStateOf(
  assessment: { maxConsecutiveAttempts: number; lockoutHours: number },
  state: LockState | null,
  now: Date,
): ILearnerAttemptState {
  const n = assessment.maxConsecutiveAttempts;
  const locked =
    state?.lockedUntil !== null &&
    state?.lockedUntil !== undefined &&
    state.lockedUntil.getTime() > now.getTime();
  const counted =
    !state || lockExpired(state, now) ? 0 : state.consecutiveCount;
  return {
    maxConsecutiveAttempts: n,
    remainingAttempts: locked ? 0 : Math.max(0, n - counted),
    lockoutHours: assessment.lockoutHours,
    lockedUntil: locked ? state.lockedUntil!.toISOString() : null,
  };
}
