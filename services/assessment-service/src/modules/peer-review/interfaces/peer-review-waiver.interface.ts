export interface IPeerReviewWaiver {
  assignmentId: string;
  learnerId: string;
  /** When the duty was waived: now for a new waiver, the first time for a repeated request. */
  waivedAt: string;
  alreadyWaived: boolean;
}
