import type { CycleStatus } from '../cycle-status';

/** UC33: one cycle of the list with its three milestones (BR-186). */
export interface IPeerReviewCycleItem {
  id: string;
  /** (1) the cycle opens. */
  opensAt: string;
  /** (2) the cycle closes and the work is assigned. */
  closesAt: string;
  /** (3) the reviews are due (BR-187: counted from the closing day). */
  reviewDueAt: string;
  /** The submissions in the cycle, one per Learner: a replaced submission is not counted twice (BR-171). */
  submissionCount: number;
  status: CycleStatus;
}

export interface IPeerReviewCycleList {
  assignmentId: string;
  title: string;
  /** What the new cycles use; the cycles already made keep their own dates (BR-269). */
  settings: {
    reviewersPerSubmission: number | null;
    cycleDays: number | null;
    deadlineDays: number | null;
    scoreGap: number | null;
  };
  items: IPeerReviewCycleItem[];
}
