/** BR-232: the event that tells a reviewer what a closed cycle handed out (the payload that notification-service reads). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  emitPeerReviewAssigned,
  peerReviewAssignedPayload,
  reviewCounts,
  type PeerReviewAssigned,
} from '../../src/modules/outbox/peer-review-assigned';

const event: PeerReviewAssigned = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  assessmentId: '22222222-2222-4222-8222-222222222222',
  cycleId: '33333333-3333-4333-8333-333333333333',
  assignmentTitle: 'Bài tập an toàn',
  reviewDueAt: new Date('2026-11-10T17:00:00Z'),
  reviewerId: '44444444-4444-4444-8444-444444444444',
  reviewCount: 2,
};

describe('the payload of PeerReviewAssigned', () => {
  test('names the reviewer learnerId (the key and the order of the relay), and carries what the notice needs', () => {
    assert.deepEqual(peerReviewAssignedPayload(event), {
      learnerId: event.reviewerId,
      organizationId: event.organizationId,
      assessmentId: event.assessmentId,
      cycleId: event.cycleId,
      assignmentTitle: 'Bài tập an toàn',
      reviewCount: 2,
      reviewDueAt: '2026-11-10T17:00:00.000Z',
    });
  });

  test('has nothing about the authors of the submissions to review (BR-233)', () => {
    const keys = Object.keys(peerReviewAssignedPayload(event));
    for (const key of keys)
      assert.doesNotMatch(key, /author|submission|authorId/i);
  });
});

describe('reviewCounts', () => {
  test('counts the reviews of each reviewer, one entry each', () => {
    const counts = reviewCounts([
      { reviewerId: 'a' },
      { reviewerId: 'b' },
      { reviewerId: 'a' },
      { reviewerId: 'c' },
      { reviewerId: 'a' },
    ]);
    assert.deepEqual(
      [...counts],
      [
        ['a', 3],
        ['b', 1],
        ['c', 1],
      ],
    );
  });

  test('is empty without pairs', () => {
    assert.equal(reviewCounts([]).size, 0);
  });
});

describe('emitPeerReviewAssigned', () => {
  const written: unknown[] = [];
  const tx = {
    outboxEvent: {
      createMany: (args: { data: unknown[] }) => {
        written.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      },
    },
  };

  test('writes one outbox row for each reviewer, about the cycle, with the time of the closing', async () => {
    written.length = 0;
    const now = new Date('2026-11-07T10:00:00Z');
    await emitPeerReviewAssigned(
      tx as never,
      [
        event,
        {
          ...event,
          reviewerId: '55555555-5555-4555-8555-555555555555',
          reviewCount: 1,
        },
      ],
      now,
    );
    assert.equal(written.length, 2);
    for (const row of written as Record<string, unknown>[]) {
      assert.equal(row.aggregateType, 'PeerReviewCycle');
      assert.equal(row.aggregateId, event.cycleId);
      assert.equal(row.eventType, 'PeerReviewAssigned');
      assert.equal(row.organizationId, event.organizationId);
      assert.equal(row.occurredAt, now);
    }
  });

  test('writes nothing for a cycle that handed out nothing', async () => {
    written.length = 0;
    await emitPeerReviewAssigned(tx as never, [], new Date());
    assert.equal(written.length, 0);
  });
});
