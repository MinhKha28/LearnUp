/** BR-210: the Enrollment status of Learning Service decides when it answers; the Completed table is the fallback. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isEnrollmentCompleted } from '../../src/modules/learner-submissions/learner-access';

const ENROLLMENT = '00000000-0000-4000-8000-0000000000e1';
const COURSE = '00000000-0000-4000-8000-000000000004';

const table = (completed: boolean) => {
  const asked: string[] = [];
  return {
    asked,
    isEnrollmentCompleted: (id: string) => {
      asked.push(id);
      return Promise.resolve(completed);
    },
  };
};

describe('isEnrollmentCompleted (BR-210)', () => {
  test('the status of Learning Service is the answer, and the table is not asked', async () => {
    const done = table(false);
    assert.equal(
      await isEnrollmentCompleted(
        { courseId: COURSE, enrollmentId: ENROLLMENT, status: 'Completed' },
        done,
      ),
      true,
    );
    // even a table that says Completed does not turn an InProgress Enrollment read-only
    const stale = table(true);
    assert.equal(
      await isEnrollmentCompleted(
        { courseId: COURSE, enrollmentId: ENROLLMENT, status: 'InProgress' },
        stale,
      ),
      false,
    );
    assert.deepEqual([...done.asked, ...stale.asked], []);
  });

  test('every status other than Completed leaves the work open', async () => {
    for (const status of [
      'NotStarted',
      'InProgress',
      'Overdue',
      'Exempted',
      'Halted',
    ]) {
      assert.equal(
        await isEnrollmentCompleted(
          { courseId: COURSE, enrollmentId: ENROLLMENT, status },
          table(true),
        ),
        false,
        status,
      );
    }
  });

  test('without a status (an older Learning Service) the table of Completed Enrollments decides', async () => {
    const yes = table(true);
    assert.equal(
      await isEnrollmentCompleted(
        { courseId: COURSE, enrollmentId: ENROLLMENT },
        yes,
      ),
      true,
    );
    assert.deepEqual(yes.asked, [ENROLLMENT]);
    assert.equal(
      await isEnrollmentCompleted(
        { courseId: COURSE, enrollmentId: ENROLLMENT },
        table(false),
      ),
      false,
    );
  });
});
