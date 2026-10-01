/**
 * Tạo Enrollment Required trên fixture ORG_TEST như phân công (UC24.2 chưa có): I1 (selfEnroll: false)
 * và I2 với danh tính ENROLL_IT_ORGANIZER, bản sao bằng hàm của UC25.3, hạn gốc BR-300.
 */
import assert from 'node:assert/strict';
import type { CurrentUser } from '@learnup/ts-common';
import type { INestApplicationContext } from '@nestjs/common';
import { buildCourseSnapshotRows } from '../../src/course-snapshots/course-snapshot-rows';
import { CourseSnapshotsRepository } from '../../src/course-snapshots/course-snapshots.repository';
import { BaseDueAtRepository } from '../../src/enrollments/base-due-at.repository';
import { EnrollmentsRepository } from '../../src/enrollments/enrollments.repository';
import { CourseServiceClient } from '../../src/integrations/course-service/course-service.client';
import { OrganizationTimezoneService } from '../../src/integrations/tenant/organization-timezone.service';
import { PlatformSettingsRepository } from '../../src/platform-settings/platform-settings.repository';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ENROLL_IT_ORG, ENROLL_IT_ORGANIZER } from './enroll-it-fixture';

export async function createRequiredEnrollment(
  app: INestApplicationContext,
  learner: CurrentUser,
  courseId: string,
  assignedAt: Date,
): Promise<{ id: string; dueAt: Date }> {
  const courseClient = app.get(CourseServiceClient);
  const lock = await courseClient.lockCourse(
    ENROLL_IT_ORGANIZER,
    courseId,
    false,
  );
  const tree = await courseClient.getCourseTree(ENROLL_IT_ORGANIZER, courseId);
  const timezone = await app
    .get(OrganizationTimezoneService)
    .getTimezone(ENROLL_IT_ORGANIZER);
  assert.ok(timezone, 'tenant phải trả múi giờ cho ORG_TEST');
  const videoCompletionPercent = await app
    .get(PlatformSettingsRepository)
    .getVideoCompletionPercent();
  assert.ok(videoCompletionPercent, 'learning_db thiếu platform_settings');

  const snapshots = app.get(CourseSnapshotsRepository);
  return app.get(PrismaService).$transaction(async (tx) => {
    if (!(await snapshots.existsForCourse(courseId, ENROLL_IT_ORG, tx))) {
      await snapshots.insertIgnoringConflicts(
        buildCourseSnapshotRows(lock, tree, new Date()),
        tx,
      );
    }
    const baseDueAt = await app
      .get(BaseDueAtRepository)
      .computeBaseDueAt(assignedAt, lock.expectedCompletionDays, timezone, tx);
    const created = await app.get(EnrollmentsRepository).create(
      {
        organizationId: ENROLL_IT_ORG,
        learnerId: learner.userId,
        courseId,
        enrollmentType: 'Required',
        status: 'NotStarted',
        enrolledAt: assignedAt,
        assignedAt,
        expectedCompletionDays: lock.expectedCompletionDays,
        baseDueAt,
        dueAt: baseDueAt,
        extensionSeconds: 0,
        videoCompletionPercent,
      },
      tx,
    );
    return { id: created.id, dueAt: baseDueAt };
  });
}
