/** Step 21 of the plan: the status-changed event Hào and Danh call from the places where a Learner's result changes. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  COMPLETION_SIGNAL_REASONS,
  emitCompletionSignal,
  signalPayload,
  type CompletionSignal,
} from '../../src/modules/outbox/completion-signal';

const NOW = new Date('2026-11-02T03:00:00.000Z');
const signal = (over: Partial<CompletionSignal> = {}): CompletionSignal => ({
  stateId: '00000000-0000-4000-8000-0000000000a1',
  organizationId: '00000000-0000-4000-8000-0000000000a2',
  assessmentId: '00000000-0000-4000-8000-0000000000a3',
  courseId: '00000000-0000-4000-8000-0000000000a4',
  learnerId: '00000000-0000-4000-8000-0000000000a5',
  kind: 'ASSIGNMENT',
  reason: 'ASSIGNMENT_SUBMITTED',
  status: 'Submitted',
  now: NOW,
  ...over,
});

describe('the reasons of a completion signal', () => {
  test('are the eight of the decision of #145', () => {
    assert.deepEqual(
      [...COMPLETION_SIGNAL_REASONS],
      [
        'QUIZ_STARTED',
        'QUIZ_SUBMITTED',
        'ASSIGNMENT_SUBMITTED',
        'ASSIGNMENT_FINALIZED',
        'PEER_REVIEW_COMPLETED',
        'PEER_REVIEW_WAIVED',
        'ASSESSMENT_DISABLED',
        'ASSESSMENT_ENABLED',
      ],
    );
  });
});

describe('signalPayload', () => {
  test('carries the organization, the reason, the revision and the first activity besides what the event always had', () => {
    assert.deepEqual(
      signalPayload(signal(), 'abc123', new Date('2026-11-01T00:00:00.000Z')),
      {
        assessmentId: '00000000-0000-4000-8000-0000000000a3',
        courseId: '00000000-0000-4000-8000-0000000000a4',
        learnerId: '00000000-0000-4000-8000-0000000000a5',
        organizationId: '00000000-0000-4000-8000-0000000000a2',
        kind: 'ASSIGNMENT',
        status: 'Submitted',
        reason: 'ASSIGNMENT_SUBMITTED',
        revision: 'abc123',
        firstActivityAt: '2026-11-01T00:00:00.000Z',
      },
    );
  });

  test('an unknown first activity is null, not missing', () => {
    assert.equal(signalPayload(signal(), 'r', null).firstActivityAt, null);
  });

  test('the fields of the reason come along but cannot overwrite the common ones', () => {
    const payload = signalPayload(
      signal({
        extra: {
          submissionId: 's1',
          consecutiveCount: 2,
          learnerId: 'someone-else',
          revision: 'forged',
        },
      }),
      'real',
      null,
    );
    assert.equal(payload.submissionId, 's1');
    assert.equal(payload.consecutiveCount, 2);
    assert.equal(payload.learnerId, '00000000-0000-4000-8000-0000000000a5');
    assert.equal(payload.revision, 'real');
  });
});

describe('emitCompletionSignal', () => {
  for (const reason of ['ASSESSMENT_DISABLED', 'ASSESSMENT_ENABLED'] as const) {
    test(`refuses ${reason}: UC38.3 has not published the event, and it writes nothing`, async () => {
      let touched = false;
      const tx = new Proxy(
        {},
        {
          get: () => {
            touched = true;
            throw new Error('the transaction must not be used');
          },
        },
      );
      await assert.rejects(
        emitCompletionSignal(tx as never, signal({ reason })),
        /not sent yet/,
      );
      assert.equal(touched, false);
    });
  }
});
