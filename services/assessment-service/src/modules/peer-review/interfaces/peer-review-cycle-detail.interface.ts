import type { CycleStatus } from '../cycle-status';

/** The state of the peer review duty of one Learner on the Assignment (BR-239, BR-241), as the snapshot reads it. */
export type ReviewerObligation = 'Pending' | 'Satisfied' | 'Missed' | 'Waived';

/** UC33.1: one submission of the cycle with the reviews it got. */
export interface IPeerReviewCycleSubmission {
  id: string;
  learnerId: string;
  /** Empty when tenant-service does not know the Learner. */
  fullName: string;
  submittedAt: string;
  /** The peer reviews handed out for this submission (not the Instructor's own). */
  reviewsAssigned: number;
  reviewsCompleted: number;
  /** Assigned and not completed: the Instructor grades these (BR-243). */
  reviewsMissing: number;
}

/** UC33.1: one Learner who has reviews to give in the cycle, with the state of the whole duty. */
export interface IPeerReviewCycleReviewer {
  learnerId: string;
  fullName: string;
  /** The reviews handed out to this Learner in this cycle. */
  assigned: number;
  completed: number;
  obligation: ReviewerObligation;
  /** UC33.2: true when the Instructor can waive the duty now (it is Missed and not waived). */
  canWaive: boolean;
}

export interface IPeerReviewCycleDetail {
  assignmentId: string;
  title: string;
  cycle: {
    id: string;
    opensAt: string;
    closesAt: string;
    reviewDueAt: string;
    reviewersPerSubmission: number;
    submissionCount: number;
    status: CycleStatus;
    closed: boolean;
  };
  submissions: IPeerReviewCycleSubmission[];
  reviewers: IPeerReviewCycleReviewer[];
}
