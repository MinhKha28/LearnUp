import type { INestApplicationContext } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PlatformSettingsRepository } from '../src/modules/platform-settings/platform-settings.repository';
import { CourseServiceClient } from '../src/infrastructure/clients/course/course-service.client';
import { buildCourseSnapshotRows } from '../src/modules/course-snapshots/course-snapshot-rows';
import {
  VIDEO_DEMO_COURSE as COURSE,
  VIDEO_DEMO_MATERIAL as MATERIAL,
  VIDEO_DEMO_ORG as ORG,
  VIDEO_DEMO_PLANS as PLANS,
} from './video-demo-fixture';

/** D92: tiến độ dựng riêng, không dùng chung Enrollment với các demo trước. */
export async function seedVideoDemo(app: INestApplicationContext) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing video demo seed in production.');
  const prisma = app.get(PrismaService);
  const user: CurrentUser = {
    userId: '01900000-0000-7000-8000-00000000a010',
    organizationId: ORG,
    role: 'ORGANIZER',
    isAuthenticated: true,
  };
  const existing = await prisma.enrollment.findMany({
    where: {
      OR: [
        { id: { in: PLANS.map((p) => p.enrollmentId) } },
        {
          organizationId: ORG,
          courseId: COURSE,
          learnerId: { in: PLANS.map((p) => p.learnerId) },
        },
      ],
    },
  });
  if (
    existing.some(
      (row) =>
        !PLANS.some(
          (p) =>
            p.enrollmentId === row.id &&
            p.learnerId === row.learnerId &&
            row.organizationId === ORG &&
            row.courseId === COURSE,
        ),
    )
  )
    throw new Error('Video demo IDs or Learner–Course pair are occupied.');
  const pending = PLANS.filter(
    (p) => !existing.some((row) => row.id === p.enrollmentId),
  );
  if (!pending.length) return;
  const percent = await app
    .get(PlatformSettingsRepository)
    .getVideoCompletionPercent();
  if (percent === null || Math.ceil((601 * percent) / 100) <= 511)
    throw new Error(
      'Video demo requires a threshold greater than 511 seconds.',
    );
  const client = app.get(CourseServiceClient);
  const lock = await client.lockCourse(user, COURSE, false);
  const tree = await client.getCourseTree(user, COURSE);
  const video = tree.modules
    .flatMap((m) => m.lessons)
    .filter((l) => l.disabledAt === null)
    .flatMap((l) => l.materials)
    .find(
      (m) =>
        m.id === MATERIAL &&
        m.materialType === 'Video' &&
        m.disabledAt === null,
    );
  if (tree.disabledAt || video?.durationSeconds !== 601)
    throw new Error('Video demo seed metadata differs from D92.');
  const snapshot = buildCourseSnapshotRows(lock, tree, new Date());
  await prisma.$transaction(async (tx) => {
    await tx.courseVersionSnapshot.createMany({
      data: [snapshot.course],
      skipDuplicates: true,
    });
    await tx.materialSnapshot.createMany({
      data: snapshot.materials,
      skipDuplicates: true,
    });
    await tx.lessonSnapshot.createMany({
      data: snapshot.lessons,
      skipDuplicates: true,
    });
    await tx.enrollment.createMany({
      data: pending.map((p) => ({
        id: p.enrollmentId,
        organizationId: ORG,
        courseId: COURSE,
        learnerId: p.learnerId,
        enrollmentType: 'Optional',
        status: 'NotStarted',
        firstActivityAt: null,
        videoCompletionPercent: percent,
      })),
    });
    const partial = pending.find((p) => p.watchedSeconds > 0);
    if (partial)
      await tx.$executeRaw`INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,watched_ranges,last_reported_at,position_seconds,position_reported_at)
      VALUES ('01900000-0000-7000-8000-2b0000000028'::uuid,${ORG}::uuid,${partial.enrollmentId}::uuid,${MATERIAL}::uuid,int4multirange(int4range(0,${partial.watchedSeconds}::int)),NULL,${partial.watchedSeconds},now())`;
  });
}
