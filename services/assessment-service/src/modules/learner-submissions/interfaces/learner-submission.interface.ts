/** What the Learner sees about the lock of one Assignment (BR-176, BR-179). */
export interface ILearnerAttemptState {
  maxConsecutiveAttempts: number;
  /** Submissions left before the lock: n minus the consecutive count; 0 while locked. */
  remainingAttempts: number;
  lockoutHours: number;
  /** Set while locked: when the Learner may submit again. */
  lockedUntil: string | null;
}

export interface ILearnerSubmissionSummary {
  id: string;
  submissionNumber: number;
  submittedAt: string;
  gradingStatus: string;
  hasFile: boolean;
  fileName: string | null;
}

/** UC30.1: where a resubmission would go right now, so the Learner knows before sending it. */
export interface IResubmissionOutlook {
  placement: 'REPLACES_IN_CYCLE' | 'OPEN_CYCLE' | 'INSTRUCTOR';
  /** REPLACES_IN_CYCLE only: when the cycle of the previous submission closes. */
  cycleClosesAt: string | null;
}

/** UC30 step 1: the Assignment as the Learner reads it before submitting. */
export interface ILearnerAssignment {
  id: string;
  courseId: string;
  title: string;
  prompt: string | null;
  promptFile: { fileName: string; sizeBytes: number } | null;
  /** The largest file a submission may carry now (the product ceiling lowered to the storage plan). */
  maxFileBytes: number;
  passingScore: number;
  expectedDurationMinutes: number | null;
  peerReviewEnabled: boolean;
  rubric: {
    id: string;
    name: string;
    description: string;
    maxPoints: number;
  }[];
  attempts: ILearnerAttemptState;
  /** BR-210: the Enrollment is Completed, so the Assignment is read-only. */
  readOnly: boolean;
  latestSubmission: ILearnerSubmissionSummary | null;
  /** Set once the Learner has submitted and the Course is not completed. */
  resubmission: IResubmissionOutlook | null;
}

export interface ICycleWindow {
  id: string;
  opensAt: string;
  closesAt: string;
  reviewDueAt: string;
}

/** UC30 result. */
export interface ISubmissionReceipt {
  id: string;
  assessmentId: string;
  submissionNumber: number;
  submittedAt: string;
  gradingStatus: string;
  /** The open cycle the submission waits in; null when the Instructor grades it directly. */
  cycle: ICycleWindow | null;
  attempts: ILearnerAttemptState;
  /** Where the work went: a cycle (new or the same one), or straight to the Instructor. */
  placement: 'REPLACES_IN_CYCLE' | 'OPEN_CYCLE' | 'INSTRUCTOR';
  /** UC30.1: the submission this one replaced. */
  replacedSubmissionId: string | null;
}

/** UC30.2: the result of a Finalized submission. No reviewer id or name is ever part of it (BR-191). */
export interface IGradingResult {
  submission: {
    id: string;
    submissionNumber: number;
    submittedAt: string;
    fileName: string | null;
  };
  assignment: {
    id: string;
    courseId: string;
    title: string;
    passingScore: number;
  };
  /** BR-322: the score the Instructor finalized, on the 0-100 scale. */
  finalScore: number;
  passed: boolean;
  /** BR-322: the explanation the Instructor wrote when the final score differs from the aggregate. */
  finalizationComment: string | null;
  finalizedAt: string;
  /** BR-322: the average of the valid reviews for each criterion; null when no review scored it. */
  criteria: {
    id: string;
    name: string;
    maxPoints: number;
    averagePoints: number | null;
  }[];
  /** BR-208: the comments of the reviewers, anonymous: only whether a peer or the Instructor wrote it. */
  comments: {
    source: 'PEER' | 'INSTRUCTOR';
    comment: string;
    completedAt: string | null;
  }[];
}
