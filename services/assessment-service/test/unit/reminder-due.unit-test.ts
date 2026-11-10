/** UC33 (BR-232): the reminder window in front of the review deadline. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isReminderDue } from '../../src/modules/peer-review/peer-review.schedule';

const hours = (n: number) =>
  new Date(Date.UTC(2026, 9, 20, 12) + n * 3_600_000);
const cycle = { reviewDueAt: hours(48), reminderHours: 24 };

describe('isReminderDue', () => {
  test('before the window: no', () => {
    assert.equal(isReminderDue(cycle, hours(0)), false);
    assert.equal(isReminderDue(cycle, hours(23.99)), false);
  });
  test('from 24 hours before the deadline up to the deadline: yes', () => {
    assert.equal(isReminderDue(cycle, hours(24)), true);
    assert.equal(isReminderDue(cycle, hours(47.99)), true);
  });
  test('at or after the deadline: no (the cycle expires instead)', () => {
    assert.equal(isReminderDue(cycle, hours(48)), false);
    assert.equal(isReminderDue(cycle, hours(60)), false);
  });
  test('the window follows reminder_hours of the cycle', () => {
    assert.equal(
      isReminderDue({ ...cycle, reminderHours: 6 }, hours(30)),
      false,
    );
    assert.equal(
      isReminderDue({ ...cycle, reminderHours: 6 }, hours(42)),
      true,
    );
  });
});
