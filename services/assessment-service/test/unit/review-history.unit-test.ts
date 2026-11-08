/** UC31.2: the state of the peer review duty of a Learner, one entry for each Assignment and as a whole. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildObligations,
  overallObligation,
  type ObligationRow,
} from '../../src/modules/learner-reviews/review-history';

const NOW = new Date('2026-11-10T12:00:00Z');
const PAST = new Date('2026-11-01T12:00:00Z');
const FUTURE = new Date('2026-11-20T12:00:00Z');
const A1 = '00000000-0000-4000-8000-0000000000a1';
const A2 = '00000000-0000-4000-8000-0000000000a2';
const COURSE = '00000000-0000-4000-8000-0000000000c1';

const row = (over: Partial<ObligationRow> = {}): ObligationRow => ({
  assignmentId: A1,
  assignmentTitle: 'Bài luận',
  courseId: COURSE,
  status: 'Completed',
  reviewDueAt: FUTURE,
  cycleId: 'c1',
  cycleClosesAt: PAST,
  exemptedAt: null,
  ...over,
});

describe('buildObligations', () => {
  test('nothing handed out: no entry, and the duty as a whole does not apply', () => {
    assert.deepEqual(buildObligations([], NOW), []);
    assert.equal(overallObligation([]), 'NotApplicable');
  });

  test('every review of the cycle given: Satisfied, with the counts', () => {
    const [o] = buildObligations([row(), row()], NOW);
    assert.deepEqual(
      [o.status, o.requiredCount, o.completedCount],
      ['Satisfied', 2, 2],
    );
    assert.deepEqual(
      [o.assignmentId, o.assignmentTitle, o.courseId],
      [A1, 'Bài luận', COURSE],
    );
  });

  test('a review still to give before its deadline: Pending', () => {
    const [o] = buildObligations([row(), row({ status: 'Pending' })], NOW);
    assert.deepEqual(
      [o.status, o.requiredCount, o.completedCount],
      ['Pending', 2, 1],
    );
  });

  test('a review still Pending past its deadline is Missed already, without waiting for the schedule (BR-237)', () => {
    const [o] = buildObligations(
      [row(), row({ status: 'Pending', reviewDueAt: PAST })],
      NOW,
    );
    assert.equal(o.status, 'Missed');
  });

  test('a review the schedule marked Missed: Missed', () => {
    assert.equal(
      buildObligations([row({ status: 'Missed' })], NOW)[0].status,
      'Missed',
    );
  });

  test('the deadline itself is not past yet only while it is ahead: a review due exactly now is Pending', () => {
    assert.equal(
      buildObligations([row({ status: 'Pending', reviewDueAt: NOW })], NOW)[0]
        .status,
      'Pending',
    );
  });

  test('a waiver by the Instructor makes it Waived whatever the reviews say, and the counts stay (BR-241)', () => {
    const [o] = buildObligations(
      [
        row({ exemptedAt: PAST }),
        row({ status: 'Missed', exemptedAt: PAST }),
        row({ status: 'Pending', exemptedAt: PAST }),
      ],
      NOW,
    );
    assert.deepEqual(
      [o.status, o.requiredCount, o.completedCount],
      ['Waived', 3, 1],
    );
  });

  test('only the latest cycle counts: a later cycle done pays an earlier Missed (BR-239)', () => {
    const [o] = buildObligations(
      [
        row({
          status: 'Missed',
          cycleId: 'c1',
          cycleClosesAt: new Date('2026-10-01T00:00:00Z'),
        }),
        row({
          status: 'Completed',
          cycleId: 'c2',
          cycleClosesAt: new Date('2026-10-20T00:00:00Z'),
        }),
      ],
      NOW,
    );
    assert.deepEqual(
      [o.status, o.requiredCount, o.completedCount],
      ['Satisfied', 1, 1],
    );
  });

  test('a later cycle not done is Pending although the earlier one was done', () => {
    const [o] = buildObligations(
      [
        row({
          status: 'Completed',
          cycleId: 'c1',
          cycleClosesAt: new Date('2026-10-01T00:00:00Z'),
        }),
        row({
          status: 'Pending',
          cycleId: 'c2',
          cycleClosesAt: new Date('2026-10-20T00:00:00Z'),
        }),
      ],
      NOW,
    );
    assert.equal(o.status, 'Pending');
  });

  test('each Assignment has its own entry; reviews of one never count for another', () => {
    const obligations = buildObligations(
      [
        row({ assignmentId: A1, assignmentTitle: 'B' }),
        row({ assignmentId: A2, assignmentTitle: 'A', status: 'Missed' }),
      ],
      NOW,
    );
    assert.deepEqual(
      obligations.map((o) => [o.assignmentId, o.status, o.requiredCount]),
      [
        [A2, 'Missed', 1],
        [A1, 'Satisfied', 1],
      ],
    );
  });

  test('what needs attention comes first: Missed, Pending, Waived, Satisfied; the same state by title', () => {
    const ids = ['x1', 'x2', 'x3', 'x4', 'x5'].map(
      (n) => `00000000-0000-4000-8000-0000000000${n.slice(1).padStart(2, '0')}`,
    );
    const obligations = buildObligations(
      [
        row({
          assignmentId: ids[0],
          assignmentTitle: 'Satisfied A',
          status: 'Completed',
        }),
        row({
          assignmentId: ids[1],
          assignmentTitle: 'Waived',
          status: 'Pending',
          exemptedAt: PAST,
        }),
        row({
          assignmentId: ids[2],
          assignmentTitle: 'Pending',
          status: 'Pending',
        }),
        row({
          assignmentId: ids[3],
          assignmentTitle: 'Missed B',
          status: 'Missed',
        }),
        row({
          assignmentId: ids[4],
          assignmentTitle: 'Missed A',
          status: 'Missed',
        }),
      ],
      NOW,
    );
    assert.deepEqual(
      obligations.map((o) => o.assignmentTitle),
      ['Missed A', 'Missed B', 'Pending', 'Waived', 'Satisfied A'],
    );
  });

  test('the rows are not changed', () => {
    const rows = [row(), row({ status: 'Pending' })];
    const before = JSON.stringify(rows);
    buildObligations(rows, NOW);
    assert.equal(JSON.stringify(rows), before);
  });
});

describe('overallObligation', () => {
  const entry = (status: string) =>
    ({
      assignmentId: A1,
      assignmentTitle: 't',
      courseId: COURSE,
      status,
      requiredCount: 1,
      completedCount: 0,
    }) as never;

  test('Missed beats Pending, Pending beats Satisfied', () => {
    assert.equal(
      overallObligation([
        entry('Satisfied'),
        entry('Pending'),
        entry('Missed'),
      ]),
      'Missed',
    );
    assert.equal(
      overallObligation([entry('Satisfied'), entry('Pending')]),
      'Pending',
    );
    assert.equal(
      overallObligation([entry('Satisfied'), entry('Satisfied')]),
      'Satisfied',
    );
  });

  test('a waived duty is a satisfied one (BR-241)', () => {
    assert.equal(overallObligation([entry('Waived')]), 'Satisfied');
    assert.equal(
      overallObligation([entry('Waived'), entry('Satisfied')]),
      'Satisfied',
    );
    assert.equal(
      overallObligation([entry('Waived'), entry('Pending')]),
      'Pending',
    );
  });

  test('nothing that applies: NotApplicable', () => {
    assert.equal(overallObligation([entry('NotApplicable')]), 'NotApplicable');
  });
});
