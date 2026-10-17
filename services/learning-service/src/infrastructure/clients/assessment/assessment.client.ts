import type { CurrentUser } from '@learnup/ts-common';

export const ASSESSMENT_CLIENT = Symbol('ASSESSMENT_CLIENT');
export interface AssessmentActivity {
  hasQuizAttempt: boolean;
  hasSubmission: boolean;
  hasPeerReviewGiven: boolean;
}
export interface AssessmentClient {
  getActivity(user: CurrentUser, courseId: string): Promise<AssessmentActivity>;
}
export class AssessmentUnavailableError extends Error {}

export function hasAssessmentActivity(activity: AssessmentActivity): boolean {
  return (
    activity.hasQuizAttempt ||
    activity.hasSubmission ||
    activity.hasPeerReviewGiven
  );
}
