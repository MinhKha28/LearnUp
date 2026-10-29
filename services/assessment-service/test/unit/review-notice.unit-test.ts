/** UC33: the two notices a reviewer reads (Vietnamese, with the time of the Organization). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assignedNotice,
  formatDeadline,
  reminderNotice,
} from '../../src/modules/peer-review/review-notice';

describe('formatDeadline', () => {
  test('is the time on the wall of the Organization (Ho Chi Minh), not UTC', () => {
    assert.equal(formatDeadline(new Date('2026-10-28T10:30:00Z')), '28/10/2026 17:30');
  });

  test('crosses midnight with the day of the Organization, and never writes 24:00', () => {
    assert.equal(formatDeadline(new Date('2026-10-28T17:00:00Z')), '29/10/2026 00:00');
    assert.equal(formatDeadline(new Date('2026-10-28T16:59:00Z')), '28/10/2026 23:59');
  });

  test('takes the time zone as an argument', () => {
    assert.equal(formatDeadline(new Date('2026-10-28T10:30:00Z'), 'UTC'), '28/10/2026 10:30');
  });
});

describe('the notices of a reviewer', () => {
  const due = new Date('2026-10-28T17:00:00Z');

  test('the assignment notice says how many submissions, for which Assignment and by when, in Vietnamese', () => {
    const notice = assignedNotice(2, 'Bài tập an toàn', due);
    assert.equal(notice.title, 'Bạn có bài cần chấm chéo');
    assert.equal(
      notice.message,
      'Bạn có 2 bài nộp cần chấm cho "Bài tập an toàn". Vui lòng hoàn thành trước 29/10/2026 00:00.',
    );
  });

  test('the reminder says how many are still not reviewed and the deadline, in Vietnamese', () => {
    const notice = reminderNotice(1, 'Bài tập an toàn', due);
    assert.equal(notice.title, 'Sắp đến hạn chấm chéo');
    assert.equal(
      notice.message,
      'Bạn còn 1 bài nộp chưa chấm cho "Bài tập an toàn". Hạn chấm là 29/10/2026 00:00.',
    );
  });

  test('no notice shows a raw ISO time (a Learner cannot read 2026-10-28T17:00:00.000Z)', () => {
    for (const notice of [assignedNotice(3, 'A', due), reminderNotice(3, 'A', due)]) {
      assert.doesNotMatch(notice.message, /\d{4}-\d{2}-\d{2}T/);
    }
  });
});
