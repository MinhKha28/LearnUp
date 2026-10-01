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

/** UC19 response: the list plus the Course-level lock that decides whether adding is allowed (BR-318). */
export interface IAssignmentList {
  courseLocked: boolean;
  courseStatus: string;
  items: IAssignmentSummary[];
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
  error?: { errorCode?: string; message?: string | string[] } | string;
  message?: string | string[];
}

/** Editable Rubric line in the Assignment forms; `key` only identifies the row in the UI. */
export interface IRubricRow {
  key: string;
  description: string;
  maxPoints: number | null;
}

/** UC19.3 payload: send only what changed. `promptFile: null` removes the attachment. */
export type IUpdateAssignment = Partial<Omit<ICreateAssignment, "courseId" | "promptFile">> & {
  promptFile?: IPromptFile | null;
};
