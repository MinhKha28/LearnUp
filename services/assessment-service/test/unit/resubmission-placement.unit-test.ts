/** The decision table of UC30.1: where a resubmission goes (BR-171, BR-313). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  decideResubmission,
  isPeerReviewOn,
  owesPeerReviewDuty,
} from '../../src/modules/learner-submissions/resubmission-placement';

const NOW = new Date('2026-10-20T00:00:00Z');
const open = { status: 'Open', closesAt: new Date('2026-10-22T00:00:00Z') };
const closed = { status: 'Open', closesAt: new Date('2026-10-19T00:00:00Z') };
const closedByJob = {
  status: 'Closed',
  closesAt: new Date('2026-10-30T00:00:00Z'),
};

describe('decideResubmission (UC30.1)', () => {
  test('the cycle of the previous submission has not closed: the new work replaces it there (BR-171)', () => {
    assert.deepEqual(
      decideResubmission({
        peerReviewOn: true,
        previousCycle: open,
        owesDuty: false,
        now: NOW,
      }),
      { placement: 'REPLACES_IN_CYCLE', interventionReason: null },
    );
    // a duty does not matter while the cycle is still open
    assert.equal(
      decideResubmission({
        peerReviewOn: true,
        previousCycle: open,
        owesDuty: true,
        now: NOW,
      }).placement,
      'REPLACES_IN_CYCLE',
    );
  });

  test('A1: the cycle is past its closing line, or already closed: the Instructor grades it (BR-171)', () => {
    for (const previousCycle of [closed, closedByJob, null]) {
      assert.deepEqual(
        decideResubmission({
          peerReviewOn: true,
          previousCycle,
          owesDuty: false,
          now: NOW,
        }),
        {
          placement: 'INSTRUCTOR',
          interventionReason: 'RESUBMITTED_AFTER_CUTOFF',
        },
      );
    }
  });

  test('a closing line that is exactly now is already past', () => {
    const edge = { status: 'Open', closesAt: NOW };
    assert.equal(
      decideResubmission({
        peerReviewOn: true,
        previousCycle: edge,
        owesDuty: false,
        now: NOW,
      }).placement,
      'INSTRUCTOR',
    );
  });

  test('A2: whoever owes a peer review duty joins the open cycle instead (BR-313)', () => {
    for (const previousCycle of [closed, closedByJob, null]) {
      assert.deepEqual(
        decideResubmission({
          peerReviewOn: true,
          previousCycle,
          owesDuty: true,
          now: NOW,
        }),
        { placement: 'OPEN_CYCLE', interventionReason: null },
      );
    }
  });

  test('with peer review off everything goes to the Instructor', () => {
    assert.deepEqual(
      decideResubmission({
        peerReviewOn: false,
        previousCycle: open,
        owesDuty: true,
        now: NOW,
      }),
      { placement: 'INSTRUCTOR', interventionReason: 'PEER_REVIEW_DISABLED' },
    );
  });
});

describe('what the decision is based on', () => {
  test('peer review counts only when reviewers and score gap are configured', () => {
    const base = {
      peerReviewEnabled: true,
      peerReviewersPerSubmission: 2,
      peerReviewScoreGap: { toString: () => '20' },
    };
    assert.equal(isPeerReviewOn(base), true);
    assert.equal(isPeerReviewOn({ ...base, peerReviewEnabled: false }), false);
    assert.equal(
      isPeerReviewOn({ ...base, peerReviewersPerSubmission: null }),
      false,
    );
    assert.equal(isPeerReviewOn({ ...base, peerReviewScoreGap: null }), false);
  });

  test('a duty is owed only while the latest cycle with reviews is Missed and the Learner is not exempted (D10)', () => {
    const now = new Date('2026-10-25T00:00:00Z');
    const review = (
      status: string,
      cycle: string,
      closes: string,
      due = '2026-10-20T00:00:00Z',
    ) => ({
      status,
      reviewDueAt: new Date(due),
      cycleId: cycle,
      cycleClosesAt: new Date(closes),
    });
    const missed = review('Missed', 'c1', '2026-10-18T00:00:00Z');
    assert.equal(
      owesPeerReviewDuty(null, [], now),
      false,
      'no review, no duty',
    );
    assert.equal(owesPeerReviewDuty(null, [missed], now), true);
    assert.equal(owesPeerReviewDuty({ exemptedAt: null }, [missed], now), true);
    assert.equal(
      owesPeerReviewDuty({ exemptedAt: new Date() }, [missed], now),
      false,
      'waived',
    );
    // made up in a later cycle: the debt is paid (the old column never reset)
    assert.equal(
      owesPeerReviewDuty(
        { exemptedAt: null },
        [missed, review('Completed', 'c2', '2026-10-24T00:00:00Z')],
        now,
      ),
      false,
    );
    // a later cycle with no review of the Learner does not erase the debt (BR-242)
    assert.equal(owesPeerReviewDuty({ exemptedAt: null }, [missed], now), true);
    // still Pending and not yet due: nothing owed; Pending past its deadline is Missed already
    assert.equal(
      owesPeerReviewDuty(
        { exemptedAt: null },
        [
          review(
            'Pending',
            'c3',
            '2026-10-30T00:00:00Z',
            '2026-10-31T00:00:00Z',
          ),
        ],
        now,
      ),
      false,
    );
    assert.equal(
      owesPeerReviewDuty(
        { exemptedAt: null },
        [
          review(
            'Pending',
            'c3',
            '2026-10-22T00:00:00Z',
            '2026-10-23T00:00:00Z',
          ),
        ],
        now,
      ),
      true,
    );
  });
});
