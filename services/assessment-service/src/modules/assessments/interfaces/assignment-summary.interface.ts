/** One Assignment in the list of a Course (UC19). */
export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  position: number;
  peerReviewEnabled: boolean;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  /** BR-98: prompt, Rubric, n and m are frozen once a submission exists. */
  locked: boolean;
  disabled: boolean;
}
