import type { Prisma } from 'generated/prisma/client';

export const SUBMISSION_FINALIZED_EVENT = 'SubmissionFinalized';

export interface SubmissionFinalized {
  organizationId: string;
  learnerId: string;
  submissionId: string;
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  finalScore: number;
}

/** Persist the result notice in the transaction that finalizes the submission. */
export async function emitSubmissionFinalized(
  tx: Prisma.TransactionClient,
  event: SubmissionFinalized,
  now: Date,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      aggregateType: 'Submission',
      aggregateId: event.submissionId,
      eventType: SUBMISSION_FINALIZED_EVENT,
      organizationId: event.organizationId,
      occurredAt: now,
      payload: {
        learnerId: event.learnerId,
        submissionId: event.submissionId,
        assessmentId: event.assessmentId,
        assessmentTitle: event.assessmentTitle,
        finalScore: event.finalScore.toFixed(2),
        maxScore: '100.00',
        courseId: event.courseId,
        finalizedAt: now.toISOString(),
      },
    },
  });
}
