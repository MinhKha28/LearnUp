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

/** UC19.2 payload. No required flag or deadline: BR-206 / BR-207. */
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

/** UC19 response: a page ({ meta, items } as in the other list endpoints) plus the Course-level lock that decides whether adding is allowed (BR-114). */
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

/** UC19 list row. `locked` = a submission exists (BR-120). */
export interface IAssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  position: number;
  passingScore: number;
  expectedDurationMinutes: number | null;
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
  /** Course-level Locked (BR-97): blocks the Peer Review on/off switch (BR-227). */
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
 * UC18: why a Quiz cannot be fully edited (BR-121).
 * QUIZ_HAS_ATTEMPTS (BR-117, BR-119), COURSE_LOCKED (BR-113), COURSE_SUBMITTED (BR-83).
 * UC18.1 permissions add COURSE_NOT_EDITABLE (Archived/Disabled, BR-83) and COURSE_LEFT_DRAFT (BR-118);
 * the UC18 list never sends those two.
 */
export type QuizLockReason =
  | "QUIZ_HAS_ATTEMPTS"
  | "COURSE_LOCKED"
  | "COURSE_SUBMITTED"
  | "COURSE_NOT_EDITABLE"
  | "COURSE_LEFT_DRAFT";

/** BR-194: the three auto-graded question types. */
export type QuizQuestionType = "SingleChoice" | "MultipleChoice" | "TrueFalse";

/** UC18 list row. `moduleId` null = attached to the Course (BR-192). `disabled` is not a lock reason. */
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

/** UC18.1: one answer option; `isCorrect` is the answer key (Instructor only). */
export interface IQuizOption {
  id: string;
  position: number;
  content: string;
  isCorrect: boolean;
}

export interface IQuizQuestion {
  id: string;
  position: number;
  /** Normally a QuizQuestionType; any other stored value is passed through as is. */
  type: string;
  content: string;
  options: IQuizOption[];
}

/** UC18.1: whether one change is possible now and why not (BR-121). */
export interface IQuizPermission {
  allowed: boolean;
  reasons: QuizLockReason[];
}

export interface IQuizPermissions {
  editQuestions: IQuizPermission;
  editTimeLimit: IQuizPermission;
  editAttemptRule: IQuizPermission;
  editPassingScore: IQuizPermission;
  editRequired: IQuizPermission;
  deleteQuiz: IQuizPermission;
  deleteLastQuestion: IQuizPermission;
}

/** UC18.1 response: the list row plus placement, Course facts, permissions and questions in display order. */
export interface IQuizDetail extends IQuizSummary {
  placement: "MODULE" | "COURSE";
  courseStatus: string;
  courseLocked: boolean;
  permissions: IQuizPermissions;
  questions: IQuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

/** UC18 response: same page shape as UC19 plus the Course-level flags. */
export interface IQuizList {
  meta: { current: number; pageSize: number; pages: number; total: number };
  items: IQuizSummary[];
  courseLocked: boolean;
  courseStatus: string;
}

/**
 * UC18.2 payload (BR-195). `moduleId` omitted = attached to the Course (BR-192).
 * `isRequired` has no default; n and m fall back to the platform defaults when omitted (BR-217).
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

/** UC18.4 payload: the five configuration fields (BR-195); send only what changed. */
export type IUpdateQuizConfigReq = Partial<
  Pick<ICreateQuizReq, "timeLimitMinutes" | "passingScore" | "isRequired" | "maxConsecutiveAttempts" | "lockoutHours">
>;

/** UC19.3 payload: send only what changed. `promptFile: null` removes the attachment. */
export type IUpdateAssignment = Partial<Omit<ICreateAssignment, "courseId" | "promptFile">> & {
  promptFile?: IPromptFile | null;
};

/** What the Learner sees about the lock of one Assignment (BR-218, BR-221). */
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
/** UC30 / UC30.1: where a submission goes (BR-213, BR-239). */
export type SubmissionPlacement = "REPLACES_IN_CYCLE" | "OPEN_CYCLE" | "INSTRUCTOR";

/** UC30.1: where a resubmission would go right now. */
export interface IResubmissionOutlook {
  placement: SubmissionPlacement;
  /** REPLACES_IN_CYCLE only: when the cycle of the previous submission closes. */
  cycleClosesAt: string | null;
}

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
  /** BR-210: the Enrollment is Completed. */
  readOnly: boolean;
  /** The largest file a submission may carry now (it depends on the storage plan). */
  maxFileBytes: number;
  latestSubmission: ILearnerSubmissionSummary | null;
  /** Set once the Learner has submitted and the Course is not completed. */
  resubmission: IResubmissionOutlook | null;
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
  /** Where the work went: a cycle (new or the same one), or straight to the Instructor. */
  placement: SubmissionPlacement;
  /** UC30.1: the submission this one replaced. */
  replacedSubmissionId: string | null;
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
  /** Quiz: best attempt (BR-198). Assignment: final score of the latest submission (BR-212). */
  recordedScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  attempts: ILearnerAttemptState;
}

export interface ILearnerAssessmentList {
  courseId: string;
  enrollmentId: string;
  /** BR-210: the Enrollment is Completed. */
  readOnly: boolean;
  items: ILearnerAssessmentItem[];
}

/** UC30.2: the result of a Finalized submission. Reviewers are never named (BR-234). */
export interface IGradingResult {
  submission: { id: string; submissionNumber: number; submittedAt: string; fileName: string | null };
  assignment: { id: string; courseId: string; title: string; passingScore: number };
  finalScore: number;
  passed: boolean;
  finalizationComment: string | null;
  finalizedAt: string;
  criteria: { id: string; name: string; maxPoints: number; averagePoints: number | null }[];
  comments: { source: "PEER" | "INSTRUCTOR"; comment: string; completedAt: string | null }[];
}

/** UC33: what a cycle of a peer review is called on the Instructor screen. */
export type TPeerReviewCycleStatus = "Open" | "Assigned" | "InstructorOnly" | "Completed";

export interface IPeerReviewCycleItem {
  id: string;
  opensAt: string;
  closesAt: string;
  reviewDueAt: string;
  submissionCount: number;
  status: TPeerReviewCycleStatus;
  /** The closing has run; until then the status only shows what the closing will do. */
  closed: boolean;
}

export interface IPeerReviewCycleList {
  assignmentId: string;
  title: string;
  settings: {
    reviewersPerSubmission: number | null;
    cycleDays: number | null;
    deadlineDays: number | null;
    scoreGap: number | null;
  };
  items: IPeerReviewCycleItem[];
}

export interface IClosedPeerReviewCycle {
  cycleId: string;
  status: TPeerReviewCycleStatus;
  submissionCount: number;
  reviewCount: number;
  closedAt: string;
  alreadyClosed: boolean;
}
