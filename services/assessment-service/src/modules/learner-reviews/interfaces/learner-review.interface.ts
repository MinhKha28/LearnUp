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
  /** Reviews the Learner can still give: the number the screen shows first (BR-232). */
  pendingCount: number;
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
