import type { AssignmentFacts } from '../completion-snapshot/completion-snapshot';
import { owesPeerReviewDuty } from '../learner-submissions/resubmission-placement';

export type WaiverDecision = 'WAIVE' | 'ALREADY_WAIVED' | 'NOT_OWING';

/**
 * UC33.2, BR-241: the Instructor can waive the peer review duty of a Learner who owes it, at any time. A Learner who
 * owes it is the one the completion snapshot calls Missed (the same definition as the resubmission, D10). A duty that
 * is already waived answers the same as the first time and changes nothing; a Learner who does not owe a duty (reviews
 * done, still in time, none assigned, or never took part) has nothing to waive.
 */
export function waiverDecision(
  state: { exemptedAt: Date | null } | null,
  reviews: AssignmentFacts['reviews'],
  now: Date,
): WaiverDecision {
  // No state means the Learner never took part: there is no row to record a waiver on.
  if (!state) return 'NOT_OWING';
  if (state.exemptedAt) return 'ALREADY_WAIVED';
  return owesPeerReviewDuty(state, reviews, now) ? 'WAIVE' : 'NOT_OWING';
}
