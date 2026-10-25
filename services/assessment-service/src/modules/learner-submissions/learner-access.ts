import type { CurrentUser } from '@learnup/ts-common';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  type AssessmentAccess,
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

/**
 * PRE-1 of UC29 / UC30: the Learner is enrolled in the Course and the Enrollment lets them into it. Learning Service
 * decides (L17, assessment-access): Halted and Withdrawn give None, which closes every Learner screen; Completed gives
 * ReadOnly, which keeps reading open (BR-210) and is refused by assertCanWrite.
 */
export async function requireAccess(
  enrollments: EnrollmentClient,
  user: CurrentUser,
  courseId: string,
): Promise<AssessmentAccess> {
  const access = await enrollments.getAssessmentAccess(courseId, user);
  if (!access) {
    throw new ForbiddenException({
      code: 'NOT_ENROLLED',
      message: 'You are not enrolled in the Course of this Assessment.',
    });
  }
  if (access.access === 'None') {
    throw new ConflictException({
      code: 'ENROLLMENT_NOT_ACTIVE',
      message: 'Your Enrollment in this Course is not active.',
    });
  }
  return access;
}

/** BR-210: a Completed Enrollment is read-only, so nothing new can be started or submitted. */
export const isReadOnly = (access: AssessmentAccess): boolean =>
  access.access === 'ReadOnly';

export function assertCanWrite(access: AssessmentAccess): void {
  if (isReadOnly(access)) {
    throw new ConflictException({
      code: 'ENROLLMENT_COMPLETED',
      message:
        'This Course is completed, so the Assignment can no longer be submitted.',
    });
  }
}

interface LockState {
  consecutiveCount: number;
  lockedUntil: Date | null;
}

/** BR-218: after m hours the Assessment opens again and counting starts from zero. */
export const lockExpired = (state: LockState, now: Date): boolean =>
  state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime();

/** BR-217 / BR-218 / BR-221: how many tries are left and, when locked, until when. */
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
