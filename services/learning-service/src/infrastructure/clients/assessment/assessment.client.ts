import type { CurrentUser } from '@learnup/ts-common';

export const ASSESSMENT_CLIENT = Symbol('ASSESSMENT_CLIENT');
export interface AssignmentAssessmentActivity {
  hasQuizAttempt: boolean;
  hasSubmission: boolean;
}
export interface AssessmentActivity extends AssignmentAssessmentActivity {
  hasPeerReviewGiven: boolean;
}
export interface AssessmentClient {
  getActivity(user: CurrentUser, courseId: string): Promise<AssessmentActivity>;
  getAssignmentActivity(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<AssignmentAssessmentActivity>;
}
export class AssessmentUnavailableError extends Error {}

export function hasAssessmentActivity(activity: AssessmentActivity): boolean {
  return (
    activity.hasQuizAttempt ||
    activity.hasSubmission ||
    activity.hasPeerReviewGiven
  );
}
