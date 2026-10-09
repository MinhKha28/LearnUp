import type { PeerReviewConfig } from '../../peer-review/interfaces/peer-review-config.interface';

export interface PromptFileDetail {
  fileKey: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number;
}

export interface RubricCriterionDetail {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  position: number;
}

/** One Assignment with prompt, Rubric and grading configuration (UC19.1 and the answer of UC19.2 / 19.3 / 19.5). */
export interface AssignmentDetail {
  id: string;
  courseId: string;
  title: string;
  position: number;
  prompt: string | null;
  promptFile: PromptFileDetail | null;
  passingScore: number;
  expectedDurationMinutes: number | null;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  peerReview: PeerReviewConfig;
  /** BR-98: the Assignment already has submissions. */
  locked: boolean;
  courseLocked: boolean;
  disabled: boolean;
  rubric: RubricCriterionDetail[];
  createdAt: Date;
}
