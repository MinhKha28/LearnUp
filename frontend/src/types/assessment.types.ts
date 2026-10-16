export interface IRubricCriterionInput {
  name: string;
  description: string;
  maxPoints: number;
}

export interface IPromptFile {
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** UC19.2 payload. No required flag or deadline: BR-165 / BR-166. */
export interface ICreateAssignment {
  courseId: string;
  title: string;
  prompt?: string;
  promptFile?: IPromptFile;
  passingScore: number;
  expectedDurationMinutes: number;
  maxConsecutiveAttempts?: number;
  lockoutHours?: number;
  rubric: IRubricCriterionInput[];
}

/** UC19 response: a page ({ meta, items } as in the other list endpoints) plus the Course-level lock that decides whether adding is allowed (BR-318). */
export interface IAssignmentList {
  meta: { current: number; pageSize: number; pages: number; total: number };
  items: IAssignmentSummary[];
  courseLocked: boolean;
  courseStatus: string;
}

/**
 * What the Course Builder layout hands to its pages through the Outlet context.
 * `assignments` is null until loaded, or when Assessment Service cannot be reached (the builder keeps working without it).
 */
export interface ICourseBuilderContext {
  assignments: IAssignmentSummary[] | null;
}

/** UC19 list row. `locked` = a submission exists (BR-98). */
export interface IAssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  position: number;
  peerReviewEnabled: boolean;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  locked: boolean;
  disabled: boolean;
}

export interface IPeerReviewConfig {
  enabled: boolean;
  reviewersPerSubmission: number | null;
  cycleDays: number | null;
  deadlineDays: number | null;
  scoreGap: number | null;
}

/** UC19.5 payload. Reviewer count and gap are required when enabling; cycle and deadline default server-side. */
export interface IUpdatePeerReview {
  enabled: boolean;
  reviewersPerSubmission?: number;
  cycleDays?: number;
  deadlineDays?: number;
  scoreGap?: number;
}

/** UC19.1 / UC19.2 response. */
export interface IAssignment {
  id: string;
  courseId: string;
  title: string;
  position: number;
  prompt: string | null;
  promptFile: IPromptFile | null;
  passingScore: number;
  expectedDurationMinutes: number | null;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  peerReview: IPeerReviewConfig;
  locked: boolean;
  /** Course-level Locked (BR-80): blocks the Peer Review on/off switch (BR-185). */
  courseLocked: boolean;
  disabled: boolean;
  rubric: (IRubricCriterionInput & { id: string; position: number })[];
  createdAt: string;
}

/** Error envelope from the NestJS HttpExceptionFilter. */
export interface IAssessmentError {
  statusCode: number;
  error?: { code?: string; message?: string | string[]; lockedUntil?: string } | string;
  message?: string | string[];
}

/** Editable Rubric line in the Assignment forms; `key` only identifies the row in the UI. */
export interface IRubricRow {
  key: string;
  description: string;
  maxPoints: number | null;
}

/**
 * UC18: why a Quiz cannot be fully edited (BR-99).
 * QUIZ_HAS_ATTEMPTS (BR-96, BR-97), COURSE_LOCKED (BR-94), COURSE_SUBMITTED (BR-285).
 */
export type QuizLockReason = "QUIZ_HAS_ATTEMPTS" | "COURSE_LOCKED" | "COURSE_SUBMITTED";

/** UC18 list row. `moduleId` null = attached to the Course (BR-154). `disabled` is not a lock reason. */
export interface IQuizSummary {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  position: number;
  questionCount: number;
  passingScore: number;
  isRequired: boolean;
  timeLimitMinutes: number | null;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  hasAttempts: boolean;
  locked: boolean;
  lockReasons: QuizLockReason[];
  disabled: boolean;
}

/** UC18 response: same page shape as UC19 plus the Course-level flags. */
export interface IQuizList {
  meta: { current: number; pageSize: number; pages: number; total: number };
  items: IQuizSummary[];
  courseLocked: boolean;
  courseStatus: string;
}

/**
 * UC18.2 payload (BR-156). `moduleId` omitted = attached to the Course (BR-154).
 * `isRequired` has no default; n and m fall back to the platform defaults when omitted (BR-175).
 */
export interface ICreateQuizReq {
  courseId: string;
  moduleId?: string;
  title: string;
  timeLimitMinutes: number;
  passingScore: number;
  isRequired: boolean;
  maxConsecutiveAttempts?: number;
  lockoutHours?: number;
}

/** UC19.3 payload: send only what changed. `promptFile: null` removes the attachment. */
export type IUpdateAssignment = Partial<Omit<ICreateAssignment, "courseId" | "promptFile">> & {
  promptFile?: IPromptFile | null;
};

/** What the Learner sees about the lock of one Assignment (BR-176, BR-179). */
export interface ILearnerAttemptState {
  maxConsecutiveAttempts: number;
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

/** UC30 step 1: the Assignment as the enrolled Learner reads it. */
export interface ILearnerAssignment {
  id: string;
  courseId: string;
  title: string;
  prompt: string | null;
  promptFile: { fileName: string; sizeBytes: number } | null;
  passingScore: number;
  expectedDurationMinutes: number | null;
  peerReviewEnabled: boolean;
  rubric: { id: string; name: string; description: string; maxPoints: number }[];
  attempts: ILearnerAttemptState;
  /** BR-169: the Enrollment is Completed. */
  readOnly: boolean;
  latestSubmission: ILearnerSubmissionSummary | null;
}

/** UC30 result. */
export interface ISubmissionReceipt {
  id: string;
  assessmentId: string;
  submissionNumber: number;
  submittedAt: string;
  gradingStatus: string;
  cycle: { id: string; opensAt: string; closesAt: string; reviewDueAt: string } | null;
  attempts: ILearnerAttemptState;
}

/** UC29: what the Learner sees about one Quiz or Assignment of a Course. */
export type LearnerAssessmentStatus = "NotStarted" | "InProgress" | "AwaitingResult" | "Completed";

export interface ILearnerAssessmentItem {
  id: string;
  kind: "QUIZ" | "ASSIGNMENT";
  title: string;
  moduleId: string | null;
  isRequired: boolean;
  passingScore: number;
  timeLimitMinutes: number | null;
  expectedDurationMinutes: number | null;
  status: LearnerAssessmentStatus;
  /** Quiz: best attempt (BR-159). Assignment: final score of the latest submission (BR-170). */
  recordedScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  attempts: ILearnerAttemptState;
}

export interface ILearnerAssessmentList {
  courseId: string;
  enrollmentId: string;
  /** BR-169: the Enrollment is Completed. */
  readOnly: boolean;
  items: ILearnerAssessmentItem[];
}
