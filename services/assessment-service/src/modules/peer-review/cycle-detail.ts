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
