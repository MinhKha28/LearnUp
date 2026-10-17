/**
 * What learning-service asks before a Learner leaves an optional Course (UC25.4, BR-131): has the Learner any result of
 * an assessment in the Course? Any true flag means the data must be kept.
 */
export interface IAssessmentActivity {
  /** A Quiz attempt, from the moment it starts (BR-314), finished or not. */
  hasQuizAttempt: boolean;
  /** An Assignment submission, also one that a resubmission has replaced (BR-171). */
  hasSubmission: boolean;
  /** A peer review the Learner has given: completed, and not one written as the Instructor. */
  hasPeerReviewGiven: boolean;
}
