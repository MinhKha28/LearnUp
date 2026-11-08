import type { Prisma } from 'generated/prisma/client';
import { PEER_REVIEW_ASSIGNED_EVENT } from '../learner-submissions/learner-submissions.constants';

/** The reviews of one reviewer that a closed cycle handed out (BR-232). */
export interface PeerReviewAssigned {
  organizationId: string;
  assessmentId: string;
  cycleId: string;
  assignmentTitle: string;
  reviewDueAt: Date;
  /** The Learner who has to review. */
  reviewerId: string;
  /** How many submissions this reviewer has to review in this cycle (1 or more). */
  reviewCount: number;
}

/**
 * The payload of the event. The reviewer is `learnerId`, the same name every event of this service gives to the Learner
 * it is about: the relay keeps the events of one Learner in the order they were written and uses that Learner as the Kafka
 * key, so the two events of one reviewer (two cycles) are never read out of order. The title is the one the Instructor
 * gave; nothing about the authors of the submissions is in the event (BR-233).
 */
export function peerReviewAssignedPayload(
  event: PeerReviewAssigned,
): Prisma.InputJsonObject {
  return {
    learnerId: event.reviewerId,
    organizationId: event.organizationId,
    assessmentId: event.assessmentId,
    cycleId: event.cycleId,
    assignmentTitle: event.assignmentTitle,
    reviewCount: event.reviewCount,
    reviewDueAt: event.reviewDueAt.toISOString(),
  };
}

/** The number of reviews each reviewer has to give, from the pairs of a cycle; one entry for each reviewer. */
export function reviewCounts(
  pairs: readonly { reviewerId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    counts.set(pair.reviewerId, (counts.get(pair.reviewerId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Writes one event for each reviewer into the outbox of the transaction that hands the reviews out, so a reviewer is told
 * if and only if the reviews exist (BR-232). The relay publishes them later; a Kafka that is down delays the notice and
 * never undoes the closing of the cycle.
 */
export async function emitPeerReviewAssigned(
  tx: Prisma.TransactionClient,
  events: readonly PeerReviewAssigned[],
  now: Date,
): Promise<void> {
  if (events.length === 0) return;
  await tx.outboxEvent.createMany({
    data: events.map((event) => ({
      aggregateType: 'PeerReviewCycle',
      aggregateId: event.cycleId,
      eventType: PEER_REVIEW_ASSIGNED_EVENT,
      organizationId: event.organizationId,
      occurredAt: now,
      payload: peerReviewAssignedPayload(event),
    })),
  });
}
