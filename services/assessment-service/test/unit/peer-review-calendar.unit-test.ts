/** Calendar of the peer review cycles (BR-312): whole days of the Organization time zone. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addCalendarDays,
  calendarDaysBetween,
  cycleWindowFor,
  startOfDay,
} from '../../src/modules/learner-submissions/peer-review-calendar';

const HCM = 'Asia/Ho_Chi_Minh'; // UTC+7, no clock change
const iso = (d: Date) => d.toISOString();

describe('peer review calendar (BR-312)', () => {
  test('the first cycle opens at the start of the local day of the first submission', () => {
    // 03:30 on 15 Oct in Ho Chi Minh is still 14 Oct in UTC
    const w = cycleWindowFor(new Date('2026-10-14T20:30:00Z'), null, 7, 3, HCM);
    assert.equal(iso(w.opensAt), '2026-10-14T17:00:00.000Z'); // 15 Oct 00:00
    // end of the 7th day, the open day being day 1
    assert.equal(iso(w.closesAt), '2026-10-21T17:00:00.000Z'); // 22 Oct 00:00
    // end of the 3rd day after the closing day
    assert.equal(iso(w.reviewDueAt), '2026-10-24T17:00:00.000Z'); // 25 Oct 00:00
  });

  test('the next cycle opens exactly where the previous one closes', () => {
    const first = cycleWindowFor(
      new Date('2026-10-15T01:00:00Z'),
      null,
      7,
      3,
      HCM,
    );
    // 23 Oct is the second day after the closing line of the first cycle: still the first slot of the grid
    const second = cycleWindowFor(
      new Date('2026-10-23T03:00:00Z'), // 23 Oct 10:00 local
      first.closesAt,
      7,
      3,
      HCM,
    );
    assert.equal(iso(second.opensAt), iso(first.closesAt));
  });

  test('days without any submission create no cycle: the grid is kept and the slot holding now is used', () => {
    const anchor = new Date('2026-10-21T17:00:00Z'); // 22 Oct 00:00 local
    // 3 Nov 12:00 local is 12 days after the anchor: slot 1 of 7-day slots (29 Oct - 5 Nov)
    const w = cycleWindowFor(
      new Date('2026-11-03T05:00:00Z'),
      anchor,
      7,
      3,
      HCM,
    );
    assert.equal(iso(w.opensAt), '2026-10-28T17:00:00.000Z'); // 29 Oct 00:00
    assert.equal(iso(w.closesAt), '2026-11-04T17:00:00.000Z'); // 5 Nov 00:00
  });

  test('a moment exactly on the closing line belongs to the next slot', () => {
    const anchor = new Date('2026-10-21T17:00:00Z');
    const w = cycleWindowFor(anchor, anchor, 7, 3, HCM);
    assert.equal(iso(w.opensAt), iso(anchor));
  });

  test('a day with a clock change is 25 hours long and still starts at local midnight', () => {
    const NY = 'America/New_York'; // clocks go back on 1 Nov 2026
    const day = startOfDay(new Date('2026-11-01T12:00:00Z'), NY);
    assert.equal(iso(day), '2026-11-01T04:00:00.000Z'); // 00:00 EDT
    const next = addCalendarDays(day, 1, NY);
    assert.equal(iso(next), '2026-11-02T05:00:00.000Z'); // 00:00 EST
    assert.equal(calendarDaysBetween(day, next, NY), 1);
  });
});
