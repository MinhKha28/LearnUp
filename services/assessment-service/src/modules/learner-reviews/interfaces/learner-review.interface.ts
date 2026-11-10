import type { ReviewState } from '../review-rules';

/** UC31: one review assigned to the Learner. Nothing in it says who wrote the work (BR-233). */
export interface ILearnerReviewItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  /** Pending, Completed or Missed, as stored. */
  status: string;
  /** Whether it can be given now: Open, or already Done, or Closed (see reviewStateOf). */
  state: ReviewState;
  /** The deadline of the cycle, shared by every reviewer of it (BR-229). */
  reviewDueAt: string | null;
  completedAt: string | null;
  /** The score the Learner gave, once given. */
  score: number | null;
}

export interface ILearnerReviewList {
  /** Reviews the Learner can still give, in the whole queue and not only on this page: the number the screen shows first (BR-232). */
  pendingCount: number;
  /** Every review of the Learner that is in the queue. */
  total: number;
  page: number;
  pageSize: number;
  /** This page: the ones to give first (the earliest deadline first), then the given, then the closed. */
  items: ILearnerReviewItem[];
}

export interface IReviewCriterion {
  id: string;
  name: string;
  description: string | null;
  maxPoints: number;
  position: number;
}

export interface ILearnerReviewDetail extends ILearnerReviewItem {
  assignment: {
    prompt: string | null;
    rubric: IReviewCriterion[];
    /** Where the prompt file is read from, when the Assignment has one (the route of UC30). */
    promptFileUrl: string | null;
    promptFileName: string | null;
  };
  /** The work to review, without its author, its number or its date. */
  submission: {
    content: string | null;
    file: {
      fileName: string;
      mimeType: string | null;
      sizeBytes: number | null;
      url: string;
    } | null;
  };
  /** The review as the Learner gave it, once given. */
  myReview: {
    comment: string | null;
    scores: { criterionId: string; points: number }[];
  } | null;
}

/** UC31.1: what giving a review answers. */
export interface ILearnerReviewResult {
  id: string;
  status: 'Completed';
  score: number;
  completedAt: string;
  /** The reviews of this Assignment that the Learner still owes in this cycle and can give. */
  remainingInAssignment: number;
}

/** UC31.2: the state of the peer review duty of the Learner on one Assignment, as learning-service sees it. */
export type TObligationStatus =
  'NotApplicable' | 'Pending' | 'Satisfied' | 'Missed' | 'Waived';

export interface IReviewObligation {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  status: TObligationStatus;
  /** The reviews handed to the Learner in the latest cycle in which they have any. */
  requiredCount: number;
  completedCount: number;
}

/** UC31.2: one review the Learner gave: the score for the whole work and for each criterion. Nothing says who wrote the work (BR-233). */
export interface IReviewHistoryItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  /** The score of the review, on 0-100 (BR-197). */
  score: number | null;
  completedAt: string | null;
  comment: string | null;
  criteria: {
    criterionId: string;
    name: string;
    points: number;
    maxPoints: number;
  }[];
}

export interface IReviewHistory {
  /** The duty as a whole, and for each Assignment on which reviews were handed to the Learner. */
  overall: TObligationStatus;
  obligations: IReviewObligation[];
  /** Reviews handed out (latest cycle of each Assignment) and given, summed. */
  assignedCount: number;
  completedCount: number;
  /** The reviews given, newest first: this page, and the number of all of them (of the Assignment asked for, if any). */
  total: number;
  page: number;
  pageSize: number;
  items: IReviewHistoryItem[];
}
