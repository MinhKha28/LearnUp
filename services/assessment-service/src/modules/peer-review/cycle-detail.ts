import type { AssignmentFacts } from '../completion-snapshot/completion-snapshot';
import { peerReviewOf } from '../completion-snapshot/completion-snapshot';
import type { ReviewerObligation } from './interfaces/peer-review-cycle-detail.interface';
import { waiverDecision } from './waiver';

/**
 * The duty of one Learner on an Assignment, as the Instructor reads it in UC33.1 and as the completion snapshot reads it
 * (one definition, D10): Waived when the Instructor waived it, else Missed, Satisfied or Pending from the reviews of the
 * latest cycle in which the Learner has reviews. A Learner who owes nothing yet or has no review at all cannot be here
 * (a reviewer has at least one review), so NotApplicable is shown as Satisfied: nothing is owed.
 */
export function obligationOf(
  state: { exemptedAt: Date | null } | null,
  reviews: AssignmentFacts['reviews'],
  now: Date,
): { obligation: ReviewerObligation; canWaive: boolean } {
  const result = peerReviewOf(reviews, now, state?.exemptedAt ?? null);
  const obligation: ReviewerObligation =
    result.status === 'NotApplicable' ? 'Satisfied' : result.status;
  return {
    obligation,
    canWaive: waiverDecision(state, reviews, now) === 'WAIVE',
  };
}

/** The validated score of a review has two decimals (0-100, BR-202): compare whole hundredths, never floats. */
const cents = (score: number | string): number =>
  Math.round(Number(score) * 100);

/**
 * BR-253: the gap of a submission is the highest minus the lowest of its valid peer review scores. Fewer than two scores
 * have no gap (nothing to compare). The gap is returned on the 0-100 scale with two decimals.
 */
export function scoreSpread(
  scores: (number | string)[],
): { lowest: number; highest: number; gap: number } | null {
  if (scores.length < 2) return null;
  const hundredths = scores.map(cents);
  const lowest = Math.min(...hundredths);
  const highest = Math.max(...hundredths);
  return {
    lowest: lowest / 100,
    highest: highest / 100,
    gap: (highest - lowest) / 100,
  };
}

/**
 * BR-252, BR-253: a submission goes to the Instructor for review when its gap is greater than the threshold of the cycle
 * (equal is not greater). One the Instructor has already finalized needs nothing more.
 */
export function needsScoreReview(
  gap: number | null,
  threshold: number,
  finalized: boolean,
): boolean {
  return gap !== null && !finalized && cents(gap) > cents(threshold);
}
