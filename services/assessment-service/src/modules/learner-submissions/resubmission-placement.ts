import {
  OBLIGATION_MISSED,
  PEER_REVIEW_DISABLED,
  RESUBMITTED_AFTER_CUTOFF,
} from './learner-submissions.constants';

/**
 * Where the work of a Learner goes.
 *  - REPLACES_IN_CYCLE: it takes the place of the previous submission in the same cycle (BR-171).
 *  - OPEN_CYCLE:        it enters the cycle that is open now (BR-167, BR-313).
 *  - INSTRUCTOR:        no cycle; the Instructor grades it directly.
 */
export type SubmissionPlacement =
  'REPLACES_IN_CYCLE' | 'OPEN_CYCLE' | 'INSTRUCTOR';

export interface ResubmissionDecision {
  placement: SubmissionPlacement;
  /** Set when the Instructor has to grade (the codes of BR-206 that UC30.1 can raise). */
  interventionReason: string | null;
}

interface PreviousCycle {
  status: string;
  closesAt: Date;
}

/** Peer review is usable only when the Assignment has its reviewers and score gap configured (UC19.5). */
export const isPeerReviewOn = (assignment: {
  peerReviewEnabled: boolean;
  peerReviewersPerSubmission: number | null;
  peerReviewScoreGap: { toString(): string } | null;
}): boolean =>
  assignment.peerReviewEnabled &&
  !!assignment.peerReviewersPerSubmission &&
  assignment.peerReviewScoreGap !== null;

/** BR-313: the Learner skipped the reviews of an earlier cycle and has not been exempted since. */
export const owesPeerReviewDuty = (
  state: {
    peerReviewObligation: string | null;
    exemptedAt: Date | null;
  } | null,
): boolean =>
  state !== null &&
  state.peerReviewObligation === OBLIGATION_MISSED &&
  !state.exemptedAt;

/**
 * UC30.1 (BR-171, BR-313): where a resubmission goes.
 *  1. Peer review off: the Instructor grades it (as for any submission of this Assignment).
 *  2. The cycle of the previous submission has not reached its closing line: the new work replaces the old one there.
 *  3. That cycle is closed (or the previous submission was in no cycle): the Instructor grades it directly (A1),
 *     unless the Learner owes a peer review duty, who then joins the cycle that is open now (A2).
 */
export function decideResubmission(input: {
  peerReviewOn: boolean;
  previousCycle: PreviousCycle | null;
  owesDuty: boolean;
  now: Date;
}): ResubmissionDecision {
  if (!input.peerReviewOn) {
    return {
      placement: 'INSTRUCTOR',
      interventionReason: PEER_REVIEW_DISABLED,
    };
  }
  const { previousCycle, now } = input;
  if (
    previousCycle &&
    previousCycle.status === 'Open' &&
    previousCycle.closesAt.getTime() > now.getTime()
  ) {
    return { placement: 'REPLACES_IN_CYCLE', interventionReason: null };
  }
  if (input.owesDuty) {
    return { placement: 'OPEN_CYCLE', interventionReason: null };
  }
  return {
    placement: 'INSTRUCTOR',
    interventionReason: RESUBMITTED_AFTER_CUTOFF,
  };
}
