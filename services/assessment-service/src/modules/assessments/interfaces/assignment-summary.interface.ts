/** One Assignment in the list of a Course (UC19). */
export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  position: number;
  /** UC19 step 3: passing score on the 0-100 scale. */
  passingScore: number;
  /** UC19 step 3: expected duration in minutes (BR-174). */
  expectedDurationMinutes: number | null;
  peerReviewEnabled: boolean;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  /** BR-98: prompt, Rubric, n and m are frozen once a submission exists. */
  locked: boolean;
  disabled: boolean;
}
