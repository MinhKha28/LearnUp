/** UC28.1: what the Learner did on one Quiz or Assignment of a Course, set against the passing score. */
export interface IAssessmentResultQuizAttempt {
  attemptNumber: number;
  score: number;
  submittedAt: string;
  /** `Manual` (the Learner submitted) or `TimedOut` (the time ran out and the system submitted). */
  submissionKind: string | null;
}

export interface IAssessmentResult {
  assessmentId: string;
  kind: 'QUIZ' | 'ASSIGNMENT';
  title: string;
  /** BR-206: every Assignment is required; a Quiz is required only when its flag says so. */
  isRequired: boolean;
  /** BR-296: a disabled component keeps its score but no longer counts for the Certificate. */
  disabled: boolean;
  passingScore: number;
  /** InProgress: a Quiz attempt is running. AwaitingResult: submitted, not yet finalized. Completed: there is a score. */
  status: 'InProgress' | 'AwaitingResult' | 'Completed';
  /** Quiz: the best submitted attempt (BR-198). Assignment: the final score of the latest submission (BR-212). */
  recordedScore: number | null;
  /** BR-191: no score yet is "not completed", never "failed": null. */
  passed: boolean | null;
  /** Quiz: attempts submitted. Assignment: submissions made. */
  attemptCount: number;
  lastActivityAt: string;
  quiz: {
    bestAttemptNumber: number | null;
    attempts: IAssessmentResultQuizAttempt[];
  } | null;
  assignment: {
    latestSubmissionNumber: number;
    gradingStatus: string;
  } | null;
}

export interface IAssessmentResults {
  courseId: string;
  items: IAssessmentResult[];
}
