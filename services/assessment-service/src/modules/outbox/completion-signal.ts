import type { Prisma } from 'generated/prisma/client';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { buildCompletionSnapshot } from '../completion-snapshot/completion-snapshot';
import { CompletionSnapshotRepository } from '../completion-snapshot/completion-snapshot.repository';
import { LEARNER_STATUS_CHANGED_EVENT } from '../learner-submissions/learner-submissions.constants';

/**
 * Why the signal was sent (decision of #145). The last two are part of the contract but nothing sends them yet: the
 * service that owns the disabling of a Quiz or Assignment (UC38.3) has not published its event, so the function refuses
 * them until it does.
 */
export const COMPLETION_SIGNAL_REASONS = [
  'QUIZ_STARTED',
  'QUIZ_SUBMITTED',
  'ASSIGNMENT_SUBMITTED',
  'ASSIGNMENT_FINALIZED',
  'PEER_REVIEW_COMPLETED',
  'PEER_REVIEW_WAIVED',
  // the cycle was closed and the Learner now owes reviews; the review deadline passed and some were not done
  'PEER_REVIEW_ASSIGNED',
  'PEER_REVIEW_MISSED',
  'ASSESSMENT_DISABLED',
  'ASSESSMENT_ENABLED',
] as const;
export type CompletionSignalReason = (typeof COMPLETION_SIGNAL_REASONS)[number];

const NOT_SENT_YET: readonly CompletionSignalReason[] = [
  'ASSESSMENT_DISABLED',
  'ASSESSMENT_ENABLED',
];

export interface CompletionSignal {
  /** The `learner_assessment_states` row of the Learner on the Assessment: the aggregate of the event. */
  stateId: string;
  organizationId: string;
  assessmentId: string;
  courseId: string;
  learnerId: string;
  kind: 'QUIZ' | 'ASSIGNMENT';
  reason: CompletionSignalReason;
  /** What happened, in the words of the event (for example `Submitted`, `PeerReviewWaived`). */
  status: string;
  /** More fields of the payload that belong to this reason only (for example `submissionId`). They never override the common ones. */
  extra?: Record<string, unknown>;
  now: Date;
}

/**
 * The payload of the event. `revision` is the revision of the completion snapshot after the change, so learning can see
 * that a signal changes nothing it already knows; `firstActivityAt` is when the Learner first did anything on this
 * Assessment (null when unknown). The common fields come last so a reason cannot overwrite them.
 */
export function signalPayload(
  signal: CompletionSignal,
  revision: string,
  firstActivityAt: Date | null,
): Record<string, unknown> {
  return {
    ...signal.extra,
    assessmentId: signal.assessmentId,
    courseId: signal.courseId,
    learnerId: signal.learnerId,
    organizationId: signal.organizationId,
    kind: signal.kind,
    status: signal.status,
    reason: signal.reason,
    revision,
    firstActivityAt: firstActivityAt?.toISOString() ?? null,
  };
}

/**
 * Writes the status-changed event into the outbox of the transaction the change itself runs in, so the event exists if
 * and only if the change does. The revision is read inside the same transaction, so it already sees the change.
 * The relay (relay.service.ts) publishes the row to Kafka afterwards.
 */
export async function emitCompletionSignal(
  tx: Prisma.TransactionClient,
  signal: CompletionSignal,
): Promise<void> {
  if (NOT_SENT_YET.includes(signal.reason)) {
    throw new Error(
      `The completion signal ${signal.reason} is not sent yet (UC38.3 has not published the event).`,
    );
  }
  const state = await tx.learnerAssessmentState.findUnique({
    where: { id: signal.stateId },
    select: { firstActivityAt: true },
  });
  // The snapshot reads with one statement and only through `$queryRaw`, which a transaction has as well.
  const facts = await new CompletionSnapshotRepository(
    tx as unknown as PrismaService,
  ).findFacts(signal.organizationId, signal.learnerId, signal.courseId);
  const { revision } = buildCompletionSnapshot({
    organizationId: signal.organizationId,
    learnerId: signal.learnerId,
    courseId: signal.courseId,
    now: signal.now,
    ...facts,
  });
  await tx.outboxEvent.create({
    data: {
      aggregateType: 'LearnerAssessmentState',
      aggregateId: signal.stateId,
      eventType: LEARNER_STATUS_CHANGED_EVENT,
      organizationId: signal.organizationId,
      occurredAt: signal.now,
      payload: signalPayload(
        signal,
        revision,
        state?.firstActivityAt ?? null,
      ) as Prisma.InputJsonObject,
    },
  });
}
