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

/** UC30 step 1: the Assignment as the Learner reads it before submitting. */
export interface ILearnerAssignment {
  id: string;
  courseId: string;
  title: string;
  prompt: string | null;
  promptFile: { fileName: string; sizeBytes: number } | null;
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
  /** BR-169: the Enrollment is Completed, so the Assignment is read-only. */
  readOnly: boolean;
  latestSubmission: ILearnerSubmissionSummary | null;
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
}
