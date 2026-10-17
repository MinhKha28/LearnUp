/** UC33: the status shown for a peer review cycle (BR-200, BR-206). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cycleStatusOf } from '../../src/modules/peer-review/cycle-status';

const NOW = new Date('2026-10-20T00:00:00Z');
const before = new Date('2026-10-22T00:00:00Z');
const after = new Date('2026-10-19T00:00:00Z');
const base = { reviewersPerSubmission: 2, submissionCount: 5, now: NOW };

describe('cycleStatusOf (UC33)', () => {
  test('before the closing line the cycle is Open', () => {
    assert.equal(
      cycleStatusOf({ ...base, stored: 'Open', closesAt: before }),
      'Open',
    );
  });

  test('a closing line that is exactly now has passed', () => {
    assert.equal(
      cycleStatusOf({ ...base, stored: 'Open', closesAt: NOW }),
      'Assigned',
    );
  });

  test('past the closing line: N + 1 submissions or more are assigned, fewer go to the Instructor (BR-206)', () => {
    const closed = { ...base, stored: 'Open', closesAt: after };
    assert.equal(cycleStatusOf({ ...closed, submissionCount: 3 }), 'Assigned');
    assert.equal(
      cycleStatusOf({ ...closed, submissionCount: 2 }),
      'InstructorOnly',
    );
    assert.equal(
      cycleStatusOf({ ...closed, submissionCount: 0 }),
      'InstructorOnly',
    );
  });

  test('a status the closing wrote is shown as it is', () => {
    for (const stored of ['Assigned', 'InstructorOnly', 'Completed']) {
      assert.equal(
        cycleStatusOf({ ...base, stored, closesAt: before, submissionCount: 0 }),
        stored,
      );
    }
  });
});
