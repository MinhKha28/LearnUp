import type { INestApplicationContext } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { CourseServiceClient } from '../src/infrastructure/clients/course/course-service.client';
import {
  ASSESSMENT_CLIENT,
  hasAssessmentActivity,
  type AssessmentClient,
} from '../src/infrastructure/clients/assessment/assessment.client';
import { buildCourseSnapshotRows } from '../src/modules/course-snapshots/course-snapshot-rows';
import { PlatformSettingsRepository } from '../src/modules/platform-settings/platform-settings.repository';
import {
  WITHDRAWAL_DEMO_ORG as ORG,
  WITHDRAWAL_DEMO_LEARNER as LEARNER,
  WITHDRAWAL_DEMO_PLANS as PLANS,
} from './withdrawal-demo-fixture';

/** Dữ liệu tiến độ dựng cho Học viên 4, chỉ dùng qua proxy danh tính dev. */
export async function seedWithdrawalDemo(
  app: INestApplicationContext,
): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing withdrawal demo seed in production.');
  const prisma = app.get(PrismaService);
  const user: CurrentUser = {
    userId: LEARNER,
    organizationId: ORG,
    role: 'LEARNER',
    isAuthenticated: true,
  };
  const assessment = app.get<AssessmentClient>(ASSESSMENT_CLIENT);
  let results;
  try {
    results = await Promise.all(
      PLANS.map((plan) => assessment.getActivity(user, plan.courseId)),
    );
  } catch (error) {
    throw new Error(
      'Không kiểm tra được hoạt động assessment cho demo UC25.4; seed chưa ghi dữ liệu.',
      { cause: error },
    );
  }
  if (hasAssessmentActivity(results[0]) || !hasAssessmentActivity(results[1]))
    throw new Error(
      'Demo UC25.4 cần Course X không có hoạt động assessment và Course Y có hoạt động. ' +
        (process.env.ASSESSMENT_CLIENT_MODE?.trim() === 'fake'
          ? 'Đặt Course Y trong ASSESSMENT_FAKE_RESULT_COURSE_IDS, Course X ngoài danh sách.'
          : 'Chạy npm run db:seed:withdrawal-demo của assessment-service.'),
    );
  const [existing, progress, percent] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        OR: [
          { id: { in: PLANS.map((p) => p.enrollmentId) } },
          {
            learnerId: LEARNER,
            courseId: { in: PLANS.map((p) => p.courseId) },
          },
        ],
      },
    }),
    prisma.materialProgress.findMany({
      where: { id: { in: PLANS.map((p) => p.progressId) } },
      select: { id: true, enrollmentId: true, organizationId: true },
    }),
    app.get(PlatformSettingsRepository).getVideoCompletionPercent(),
  ]);
  if (percent === null)
    throw new Error('Thiếu video_completion_percent cho demo UC25.4.');
  for (const row of existing) {
    if (
      !PLANS.some(
        (p) =>
          p.enrollmentId === row.id &&
          p.courseId === row.courseId &&
          row.organizationId === ORG &&
          row.learnerId === LEARNER,
      )
    )
      throw new Error(
        'ID hoặc cặp Learner–Course demo UC25.4 bị chiếm; không ghi đè.',
      );
  }
  for (const row of progress) {
    if (
      !PLANS.some(
        (p) =>
          p.progressId === row.id &&
          p.enrollmentId === row.enrollmentId &&
          row.organizationId === ORG,
      )
    )
      throw new Error('ID tiến độ demo UC25.4 bị chiếm; không ghi đè.');
  }
  const pending = PLANS.filter(
    (p) => !existing.some((row) => row.id === p.enrollmentId),
  );
  if (!pending.length) return;
  const courses = app.get(CourseServiceClient);
  const fetched = await Promise.all(
    pending.map(async (plan) => {
      const lock = await courses.lockCourse(user, plan.courseId, true);
      const tree = await courses.getCourseTree(user, plan.courseId);
      const material = tree.modules
        .flatMap((m) => m.lessons)
        .filter((l) => l.disabledAt === null)
        .flatMap((l) => l.materials)
        .find((m) => m.isRequired && m.disabledAt === null);
      if (!material)
        throw new Error(
          'Course demo UC25.4 thiếu học liệu bắt buộc còn hoạt động.',
        );
      return {
        plan,
        material,
        snapshot: buildCourseSnapshotRows(lock, tree, new Date()),
      };
    }),
  );
  await prisma.$transaction(async (tx) => {
    await tx.courseVersionSnapshot.createMany({
      data: fetched.map((f) => f.snapshot.course),
      skipDuplicates: true,
    });
    await tx.materialSnapshot.createMany({
      data: fetched.flatMap((f) => f.snapshot.materials),
      skipDuplicates: true,
    });
    await tx.lessonSnapshot.createMany({
      data: fetched.flatMap((f) => f.snapshot.lessons),
      skipDuplicates: true,
    });
    await tx.enrollment.createMany({
      data: fetched.map(({ plan }) => ({
        id: plan.enrollmentId,
        organizationId: ORG,
        learnerId: LEARNER,
        courseId: plan.courseId,
        enrollmentType: 'Optional',
        status: 'InProgress',
        videoCompletionPercent: percent,
        firstActivityAt: new Date(),
      })),
    });
    await tx.$executeRaw`INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,watched_ranges,completed_at)
      VALUES ${Prisma.join(
        fetched.map(
          ({
            plan,
            material,
          }) => Prisma.sql`(${plan.progressId}::uuid,${ORG}::uuid,${plan.enrollmentId}::uuid,${material.id}::uuid,
        ${material.materialType === 'Video' ? Prisma.sql`int4multirange(int4range(0,${material.durationSeconds}::int))` : Prisma.sql`NULL`},now())`,
        ),
      )}`;
  });
  console.log(
    'UC25.4: Học viên 4 (tenant ABC a206) có Course X → DELETED, Course Y → WITHDRAWN rồi khôi phục tiến độ.',
  );
}
