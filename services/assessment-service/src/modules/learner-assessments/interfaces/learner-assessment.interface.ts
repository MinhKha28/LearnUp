import type { ILearnerAttemptState } from '../../learner-submissions/interfaces/learner-submission.interface';

/**
 * What the Learner sees about one Quiz or Assignment (UC29).
 *  - NotStarted:     nothing done yet; BR-153: a Learner who has not submitted is "not completed", never "failed".
 *  - InProgress:     a Quiz attempt is running.
 *  - AwaitingResult: submitted, not graded yet (Assignment) .
 *  - Completed:      there is a recorded score; `passed` tells whether it reaches the passing score.
 */
export type LearnerAssessmentStatus =
  'NotStarted' | 'InProgress' | 'AwaitingResult' | 'Completed';

export interface ILearnerAssessmentItem {
  id: string;
  kind: 'QUIZ' | 'ASSIGNMENT';
  title: string;
  moduleId: string | null;
  /** Assignments are always required for the Certificate (BR-165). */
  isRequired: boolean;
  passingScore: number;
  timeLimitMinutes: number | null;
  expectedDurationMinutes: number | null;
  status: LearnerAssessmentStatus;
  /** Quiz: the best attempt (BR-159). Assignment: the final score of the latest submission (BR-170). */
  recordedScore: number | null;
  passed: boolean | null;
  /** When the Learner last submitted, if ever. */
  submittedAt: string | null;
  /** Tries left before the lock and, while locked, when it opens again (BR-160, BR-179). */
  attempts: ILearnerAttemptState;
}

export interface ILearnerAssessmentList {
  courseId: string;
  enrollmentId: string;
  /** BR-169: the Enrollment is Completed, so nothing can be done any more. */
  readOnly: boolean;
  items: ILearnerAssessmentItem[];
}
