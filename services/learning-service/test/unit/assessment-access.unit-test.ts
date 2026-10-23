import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessmentAccessOf } from '../../src/modules/enrollments/assessment-access.service';
for (const [status, access] of Object.entries({
  NotStarted: 'Full',
  InProgress: 'Full',
  Exempted: 'Full',
  Completed: 'ReadOnly',
  Halted: 'None',
  Withdrawn: 'None',
})) {
  test(`assessment access ${status}`, () =>
    assert.equal(assessmentAccessOf(status), access));
}
test('unknown status fails closed', () =>
  assert.throws(
    () => assessmentAccessOf('Overdue'),
    (error: any) => error.getStatus() === 500,
  ));
