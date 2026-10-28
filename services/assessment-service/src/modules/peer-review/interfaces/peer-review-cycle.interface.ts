import type { CycleStatus } from '../cycle-status';

/** UC33: one cycle of the list with its three milestones (BR-228). */
export interface IPeerReviewCycleItem {
  id: string;
  /** (1) the cycle opens. */
  opensAt: string;
  /** (2) the cycle closes and the work is assigned. */
  closesAt: string;
  /** (3) the reviews are due (BR-229: counted from the closing day). */
  reviewDueAt: string;
  /** The submissions in the cycle, one per Learner: a replaced submission is not counted twice (BR-213). */
  submissionCount: number;
  status: CycleStatus;
  /** True once the closing has run; until then the status only shows what the closing will do. */
  closed: boolean;
}

export interface IPeerReviewCycleList {
  assignmentId: string;
  title: string;
  /** What the new cycles use; the cycles already made keep their own dates (BR-335). */
  settings: {
    reviewersPerSubmission: number | null;
    cycleDays: number | null;
    deadlineDays: number | null;
    scoreGap: number | null;
  };
  items: IPeerReviewCycleItem[];
}

/** UC33: what closing a cycle did (BR-242, BR-249). */
export interface IClosedCycle {
  cycleId: string;
  status: CycleStatus;
  /** The Learners who submitted in the cycle (BR-248). */
  submissionCount: number;
  /** The reviews handed out: submissionCount x N when assigned, 0 when the Instructor grades them all. */
  reviewCount: number;
  closedAt: string;
  /** True when the cycle was closed before this call; nothing was changed (closing again is safe). */
  alreadyClosed: boolean;
}
