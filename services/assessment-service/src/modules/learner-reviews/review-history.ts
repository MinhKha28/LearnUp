import { peerReviewOf } from '../completion-snapshot/completion-snapshot';
import type {
  IReviewObligation,
  TObligationStatus,
} from './interfaces/learner-review.interface';

/** One review row of the Learner on an Assignment, as the snapshot of completion reads it (D10). */
export interface ObligationRow {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  status: string;
  reviewDueAt: Date | null;
  cycleId: string | null;
  cycleClosesAt: Date | null;
  /** When the Instructor waived the duty of this Learner on this Assignment (UC33.2, BR-241). */
  exemptedAt: Date | null;
}

const WORST_FIRST: Record<TObligationStatus, number> = {
  Missed: 0,
  Pending: 1,
  Waived: 2,
  Satisfied: 3,
  NotApplicable: 4,
};

/**
 * The peer review duty of the Learner, one entry for each Assignment on which reviews were handed to them. The status is
 * the one `peerReviewOf` gives to learning-service, so the screen and the Certificate agree: of the reviews of the latest
 * cycle in which the Learner has any, one Missed (or Pending past its deadline) makes it Missed, all done makes it
 * Satisfied, a waiver by the Instructor makes it Waived (BR-236, BR-238, BR-239, BR-241). Those needing attention first.
 */
export function buildObligations(
  rows: ObligationRow[],
  now: Date,
): IReviewObligation[] {
  const byAssignment = new Map<string, ObligationRow[]>();
  for (const row of rows) {
    const list = byAssignment.get(row.assignmentId) ?? [];
    list.push(row);
    byAssignment.set(row.assignmentId, list);
  }
  const obligations: IReviewObligation[] = [];
  for (const [assignmentId, own] of byAssignment) {
    const result = peerReviewOf(
      own.map((row) => ({
        status: row.status,
        reviewDueAt: row.reviewDueAt,
        cycleId: row.cycleId,
        cycleClosesAt: row.cycleClosesAt,
      })),
      now,
      own[0].exemptedAt,
    );
    obligations.push({
      assignmentId,
      assignmentTitle: own[0].assignmentTitle,
      courseId: own[0].courseId,
      status: result.status,
      requiredCount: result.requiredCount,
      completedCount: result.completedCount,
    });
  }
  return obligations.sort(
    (a, b) =>
      WORST_FIRST[a.status] - WORST_FIRST[b.status] ||
      a.assignmentTitle.localeCompare(b.assignmentTitle) ||
      a.assignmentId.localeCompare(b.assignmentId),
  );
}

/**
 * The whole duty in one word: Missed when any Assignment is, Pending when any is still owed, Satisfied when every one is
 * Satisfied or Waived (a waived duty is a satisfied one, BR-241), NotApplicable when no review was ever handed out.
 */
export function overallObligation(
  obligations: IReviewObligation[],
): TObligationStatus {
  if (obligations.length === 0) return 'NotApplicable';
  if (obligations.some((o) => o.status === 'Missed')) return 'Missed';
  if (obligations.some((o) => o.status === 'Pending')) return 'Pending';
  if (obligations.every((o) => o.status === 'NotApplicable'))
    return 'NotApplicable';
  return 'Satisfied';
}
