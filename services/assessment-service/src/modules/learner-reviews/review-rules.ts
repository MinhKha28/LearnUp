import { needsScoreReview, scoreSpread } from '../peer-review/cycle-detail';

/** The intervention reason of a submission whose reviewers disagree by more than the threshold (BR-252, BR-253). */
export const SCORE_GAP_EXCEEDED = 'SCORE_GAP_EXCEEDED';

export const AWAITING_FINALIZATION = 'AwaitingFinalization';
export const AWAITING_INSTRUCTOR = 'AwaitingInstructor';

/**
 * What a Learner can do with a review assigned to them (UC31, UC31.1):
 *  - Done: it was given (a valid review is final, BR-257);
 *  - Open: it is Pending, the cycle handed it out and its review deadline has not come (BR-229);
 *  - Closed: anything else: the deadline passed or the schedule marked it Missed, after which the Instructor grades the
 *    submission (BR-237, BR-243) and a late review would be one more score that nobody expects.
 */
export type ReviewState = 'Open' | 'Done' | 'Closed';

export function reviewStateOf(
  review: { status: string },
  cycle: { status: string; reviewDueAt: Date } | null,
  now: Date,
): ReviewState {
  if (review.status === 'Completed') return 'Done';
  if (
    review.status === 'Pending' &&
    cycle !== null &&
    cycle.status === 'Assigned' &&
    now.getTime() < cycle.reviewDueAt.getTime()
  )
    return 'Open';
  return 'Closed';
}

/**
 * Where a submission goes once every review handed out for it is Completed: to the Instructor to look at it again when the
 * peer scores differ by more than the threshold of its cycle (BR-252, BR-253), otherwise to the final grade (BR-251, BR-254).
 */
export function outcomeOfReviews(
  scores: (number | string)[],
  threshold: number,
): { gradingStatus: string; interventionReason: string | null } {
  const spread = scoreSpread(scores);
  return needsScoreReview(spread?.gap ?? null, threshold, false)
    ? {
        gradingStatus: AWAITING_INSTRUCTOR,
        interventionReason: SCORE_GAP_EXCEEDED,
      }
    : { gradingStatus: AWAITING_FINALIZATION, interventionReason: null };
}

const EXTENSION_OF: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

/**
 * BR-233: the name of the file of the author may say who the author is, so the reviewer gets a neutral one with the same
 * kind of file.
 */
export function neutralFileName(mimeType: string | null): string {
  const extension = EXTENSION_OF[(mimeType ?? '').toLowerCase()];
  return extension ? `submitted-work.${extension}` : 'submitted-work';
}
