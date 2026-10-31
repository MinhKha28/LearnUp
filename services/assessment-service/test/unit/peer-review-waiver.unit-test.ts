/** UC33.2, BR-241: who has a peer review duty that the Instructor can waive. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { waiverDecision } from '../../src/modules/peer-review/waiver';
import { obligationOf } from '../../src/modules/peer-review/cycle-detail';
import { waivedNotice } from '../../src/modules/peer-review/review-notice';

const NOW = new Date('2026-10-27T10:00:00.000Z');
const PAST = new Date('2026-10-20T00:00:00.000Z');
const FUTURE = new Date('2026-11-20T00:00:00.000Z');
const owing = { exemptedAt: null };
const review = (
  status: string,
  due: Date | null = FUTURE,
  cycle = 'c1',
  closes = PAST,
) => ({
  status,
  reviewDueAt: due,
  cycleId: cycle,
  cycleClosesAt: closes,
});

describe('waiverDecision', () => {
  test('a Learner who missed the reviews owes the duty: WAIVE', () => {
    assert.equal(
      waiverDecision(owing, [review('Completed'), review('Missed', PAST)], NOW),
      'WAIVE',
    );
  });

  test('a review still Pending past its deadline is already Missed: WAIVE, without waiting for the schedule', () => {
    assert.equal(
      waiverDecision(owing, [review('Pending', PAST)], NOW),
      'WAIVE',
    );
  });

  test('reviews all done, still in time, or none assigned: nothing to waive', () => {
    assert.equal(
      waiverDecision(owing, [review('Completed'), review('Completed')], NOW),
      'NOT_OWING',
    );
    assert.equal(
      waiverDecision(owing, [review('Pending', FUTURE)], NOW),
      'NOT_OWING',
    );
    assert.equal(waiverDecision(owing, [], NOW), 'NOT_OWING');
  });

  test('a Learner who never took part (no state) has nothing to waive', () => {
    assert.equal(waiverDecision(null, [], NOW), 'NOT_OWING');
    assert.equal(
      waiverDecision(null, [review('Missed', PAST)], NOW),
      'NOT_OWING',
    );
  });

  test('a debt of an older cycle that a later cycle paid is not a duty any more (BR-239)', () => {
    const later = new Date('2026-10-25T00:00:00.000Z');
    assert.equal(
      waiverDecision(
        owing,
        [
          review('Missed', PAST, 'c1', PAST),
          review('Completed', PAST, 'c2', later),
        ],
        NOW,
      ),
      'NOT_OWING',
    );
  });

  test('a debt of the latest cycle stays a duty even when an older cycle was paid', () => {
    const later = new Date('2026-10-25T00:00:00.000Z');
    assert.equal(
      waiverDecision(
        owing,
        [
          review('Completed', PAST, 'c1', PAST),
          review('Missed', PAST, 'c2', later),
        ],
        NOW,
      ),
      'WAIVE',
    );
  });

  test('a duty that is already waived is ALREADY_WAIVED, whatever the reviews say', () => {
    const waived = { exemptedAt: PAST };
    assert.equal(
      waiverDecision(waived, [review('Missed', PAST)], NOW),
      'ALREADY_WAIVED',
    );
    assert.equal(waiverDecision(waived, [], NOW), 'ALREADY_WAIVED');
  });
});

describe('the notice of a waiver', () => {
  test('is Vietnamese, names the Assignment and asks nothing more of the Learner', () => {
    const notice = waivedNotice('Báo cáo tuần 3');
    assert.equal(notice.title, 'Bạn được miễn nghĩa vụ chấm chéo');
    assert.match(notice.message, /"Báo cáo tuần 3"/);
    assert.match(notice.message, /không cần chấm thêm/);
  });
});

describe('obligationOf: the duty of a reviewer as UC33.1 shows it', () => {
  const later = new Date('2026-10-25T00:00:00.000Z');
  test('Missed and not waived: Missed, and the Instructor can waive it', () => {
    assert.deepEqual(
      obligationOf({ exemptedAt: null }, [review('Missed', PAST)], NOW),
      { obligation: 'Missed', canWaive: true },
    );
  });

  test('waived: Waived, nothing left to waive', () => {
    assert.deepEqual(
      obligationOf({ exemptedAt: PAST }, [review('Missed', PAST)], NOW),
      { obligation: 'Waived', canWaive: false },
    );
  });

  test('all done is Satisfied, still in time is Pending: neither can be waived', () => {
    assert.deepEqual(
      obligationOf({ exemptedAt: null }, [review('Completed')], NOW),
      { obligation: 'Satisfied', canWaive: false },
    );
    assert.deepEqual(
      obligationOf({ exemptedAt: null }, [review('Pending', FUTURE)], NOW),
      { obligation: 'Pending', canWaive: false },
    );
  });

  test('a debt of an older cycle that a later cycle paid is Satisfied (BR-239)', () => {
    assert.deepEqual(
      obligationOf(
        { exemptedAt: null },
        [
          review('Missed', PAST, 'c1', PAST),
          review('Completed', PAST, 'c2', later),
        ],
        NOW,
      ),
      { obligation: 'Satisfied', canWaive: false },
    );
  });

  test('no review at all is nothing owed, shown as Satisfied', () => {
    assert.deepEqual(obligationOf({ exemptedAt: null }, [], NOW), {
      obligation: 'Satisfied',
      canWaive: false,
    });
  });
});
