import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { CourseSnapshotPreparationService } from '../../src/modules/course-snapshots/course-snapshot-preparation.service';
import type { LockedCourse } from '../../src/infrastructure/clients/course/course-service.interface';

const lock: LockedCourse = {
  courseId: '0199a000-0000-7000-8000-0e0000000003',
  organizationId: '0199a000-0000-7000-8000-0a0000000001',
  chainId: '0199a000-0000-7000-8000-0d0000000002',
  courseType: 'Public',
  expectedCompletionDays: 7,
  lockedAt: new Date(),
};
const user = { organizationId: lock.organizationId } as CurrentUser;

test('snapshot preparation shares I2 across 20 simultaneous calls', async () => {
  let calls = 0;
  const service = new CourseSnapshotPreparationService(
    { existsForCourse: async () => false } as never,
    {
      getCourseTree: async () => {
        calls++;
        return {
          courseId: lock.courseId,
          chainId: lock.chainId,
          versionNumber: 1,
          disabledAt: null,
          asOf: new Date(),
          modules: [],
        };
      },
    } as never,
  );
  const rows = await Promise.all(
    Array.from({ length: 20 }, () => service.prepare(user, lock)),
  );
  assert.equal(calls, 1);
  assert.ok(rows[0]);
  assert.ok(rows.every((row) => row === rows[0]));
  await service.prepare(user, lock);
  assert.equal(calls, 2);
});

test('snapshot preparation clears rejected flight and calls I2 again', async () => {
  let calls = 0;
  const service = new CourseSnapshotPreparationService(
    { existsForCourse: async () => false } as never,
    {
      getCourseTree: async () => {
        calls++;
        throw new Error('I2 unavailable');
      },
    } as never,
  );
  await Promise.all(
    Array.from({ length: 20 }, () =>
      assert.rejects(service.prepare(user, lock), /I2 unavailable/),
    ),
  );
  assert.equal(calls, 1);
  await assert.rejects(service.prepare(user, lock), /I2 unavailable/);
  assert.equal(calls, 2);
});
