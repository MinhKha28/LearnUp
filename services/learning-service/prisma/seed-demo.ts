/**
 * Seed demo UC26 (D35) cho learning-service. CHỈ DÙNG CHO DEV, cần course-service đang chạy.
 *
 * Chạy: npm run seed:demo
 *
 * Đây là dữ liệu DỰNG cho demo:
 * - LEARNER_1 (ORG_A) có hai Enrollment Required: Course 04 phân công lúc chạy; Course 02 bị LÙI ngày phân công
 *   (expectedCompletionDays + 2 ngày) để đã quá hạn (Overdue).
 * - Dòng tiến độ của Course 02 (một học liệu bắt buộc đã hoàn thành, Enrollment InProgress) là dữ liệu dựng.
 * - D50: thêm dòng tiến độ dựng cho Video …1c0000000111 của L11 (xem đủ ngưỡng video_completion_percent
 *   của Enrollment) để L11 hiện "Đã hoàn thành" ở UC27; Module 1 vẫn chưa xong, Enrollment vẫn InProgress.
 * - Seed gọi I1 nên gắn Locked THẬT cho Course 02 và 04 trong course_db local (BR-80).
 * Không seed Course 03 (để demo UC25.3), LEARNER_2 để trống.
 *
 * Kiểm trước, ghi sau: mọi điều kiện được kiểm trước khi gọi I1 hay ghi dòng nào.
 * ID cố định; chạy lại không đổi gì. Cặp Learner–Course đã có Enrollment khác ID demo thì dừng, không ghi đè.
 */
import 'dotenv/config';
import type { CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import { Client } from 'pg';
import { AppModule } from '../src/app.module';
import { buildCourseSnapshotRows } from '../src/modules/course-snapshots/course-snapshot-rows';
import { CourseSnapshotsRepository } from '../src/modules/course-snapshots/course-snapshots.repository';
import { BaseDueAtRepository } from '../src/modules/enrollments/base-due-at.repository';
import { EnrollmentsRepository } from '../src/modules/enrollments/enrollments.repository';
import { CourseServiceClient } from '../src/infrastructure/integrations/course-service/course-service.client';
import type {
  CourseTree,
  CourseTreeMaterial,
  LockedCourse,
} from '../src/infrastructure/integrations/course-service/course-service.interface';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../src/infrastructure/integrations/tenant/tenant.client';
import { PlatformSettingsRepository } from '../src/modules/platform-settings/platform-settings.repository';
import { PrismaService } from '../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// ID cố định
// ---------------------------------------------------------------------------
const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const LEARNER_1 = '0199a000-0000-7000-8000-0b0000000001';
const COURSE_AN_TOAN_V2 = '0199a000-0000-7000-8000-0e0000000002';
const COURSE_QUY_TRINH_PRIVATE = '0199a000-0000-7000-8000-0e0000000004';

/** Organizer của ORG_A: danh tính gọi I1 (selfEnroll: false) và I2, như người phân công ở UC24.2. */
const ORGANIZER_A: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0f0000000001',
  organizationId: ORG_A,
  role: 'ORGANIZER',
  isAuthenticated: true,
};

const DEMO_ENROLLMENT_04 = '0199a000-0000-7000-8000-2a0000000001';
const DEMO_ENROLLMENT_02 = '0199a000-0000-7000-8000-2a0000000002';
const DEMO_PROGRESS_02 = '0199a000-0000-7000-8000-2b0000000001';
/** D50: Video của L11 trên E-demo-2, dữ liệu dựng cho demo. */
const DEMO_VIDEO_PROGRESS_02 = '0199a000-0000-7000-8000-2b0000000002';
const DEMO_VIDEO_MATERIAL_02 = '0199a000-0000-7000-8000-1c0000000111';
const DEMO_VIDEO_LESSON_02 = '0199a000-0000-7000-8000-1b0000000011';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoPlan {
  enrollmentId: string;
  courseId: string;
  label: string;
  /** Lùi ngày phân công để đã quá hạn, và ghi một học liệu bắt buộc hoàn thành. */
  overdueWithProgress: boolean;
}

const PLANS: DemoPlan[] = [
  {
    enrollmentId: DEMO_ENROLLMENT_04,
    courseId: COURSE_QUY_TRINH_PRIVATE,
    label: 'E-demo-1 (Course 04)',
    overdueWithProgress: false,
  },
  {
    enrollmentId: DEMO_ENROLLMENT_02,
    courseId: COURSE_AN_TOAN_V2,
    label: 'E-demo-2 (Course 02)',
    overdueWithProgress: true,
  },
];

const BANNER = [
  'seed:demo learning-service: dữ liệu DỰNG cho demo UC26, chỉ dùng cho dev.',
  '- Ngày phân công Course 02 bị lùi (expectedCompletionDays + 2 ngày) để có Enrollment Overdue.',
  '- Dòng tiến độ (một học liệu bắt buộc của Course 02 đã hoàn thành) là dữ liệu dựng.',
  '- D50: dòng tiến độ Video L11 của Course 02 (xem đủ ngưỡng hoàn thành) là dữ liệu dựng.',
  '- Seed gắn Locked THẬT cho Course 02 và 04 trong course_db local.',
].join('\n');

class SeedAbort extends Error {}

/** Bỏ ?schema=… của Prisma; pg không hiểu tham số này. */
function courseDatabaseUrl(): string {
  if (process.env.COURSE_DATABASE_URL) {
    return process.env.COURSE_DATABASE_URL;
  }
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/course_db';
  url.search = '';
  return url.toString();
}

interface CourseRow {
  id: string;
  name: string;
  published_at: Date | null;
  expected_completion_days: number;
}

/** Chỉ SELECT: published_at và số ngày để kiểm ngày lùi trước khi gọi I1. */
async function readCourses(
  courseIds: string[],
): Promise<Map<string, CourseRow>> {
  const courseDb = new Client({ connectionString: courseDatabaseUrl() });
  await courseDb.connect();
  try {
    const { rows } = await courseDb.query<CourseRow>(
      `SELECT id::text, name, published_at, expected_completion_days
         FROM courses WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
      [courseIds, ORG_A],
    );
    return new Map(rows.map((row) => [row.id, row]));
  } finally {
    await courseDb.end();
  }
}

/** Học liệu bắt buộc còn hoạt động đầu tiên theo thứ tự cây: ưu tiên Reading, không có thì Video. */
function pickRequiredMaterial(tree: CourseTree): CourseTreeMaterial | null {
  if (tree.disabledAt !== null) {
    return null;
  }
  const active = tree.modules
    .flatMap((module) => module.lessons)
    .filter((lesson) => lesson.disabledAt === null)
    .flatMap((lesson) => lesson.materials)
    .filter((material) => material.isRequired && material.disabledAt === null);
  return (
    active.find((material) => material.materialType === 'Reading') ??
    active.find((material) => material.materialType === 'Video') ??
    null
  );
}

async function run(): Promise<void> {
  console.log(`${BANNER}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const enrollments = app.get(EnrollmentsRepository);
    const snapshots = app.get(CourseSnapshotsRepository);
    const baseDueAt = app.get(BaseDueAtRepository);
    const courseClient = app.get(CourseServiceClient);
    const tenant = app.get<TenantClient>(TENANT_CLIENT);

    // ---- Kiểm trước: không gọi I1/I2, không ghi dòng nào ----
    await assertDemoVideoProgressIdFree(prisma);
    const now = new Date();
    const courses = await readCourses(PLANS.map((plan) => plan.courseId));
    const pending: (DemoPlan & { course: CourseRow; assignedAt: Date })[] = [];

    for (const plan of PLANS) {
      const course = courses.get(plan.courseId);
      if (!course) {
        throw new SeedAbort(
          `course_db không có Course ${plan.courseId} của ORG_A; chạy npm run db:seed của course-service.`,
        );
      }

      const existingId = await enrollments.findIdByLearnerAndCourse(
        LEARNER_1,
        plan.courseId,
      );
      if (existingId === plan.enrollmentId) {
        console.log(`${plan.label}: đã có (${plan.enrollmentId}), bỏ qua.`);
        continue;
      }
      if (existingId) {
        throw new SeedAbort(
          `LEARNER_1 đã có Enrollment ${existingId} (không phải ID demo) trên ${plan.label}; không ghi đè.`,
        );
      }
      const idTaken = await prisma.enrollment.findFirst({
        where: { id: plan.enrollmentId },
        select: { id: true },
      });
      if (idTaken) {
        throw new SeedAbort(
          `ID ${plan.enrollmentId} của ${plan.label} đã thuộc một Enrollment khác; không ghi đè.`,
        );
      }

      const assignedAt = plan.overdueWithProgress
        ? new Date(
            now.getTime() - (course.expected_completion_days + 2) * DAY_MS,
          )
        : now;
      if (!course.published_at || assignedAt < course.published_at) {
        throw new SeedAbort(
          `${plan.label}: ngày phân công ${assignedAt.toISOString()} trước thời điểm Published ` +
            `${course.published_at?.toISOString() ?? '(chưa Published)'} (BR-70); không ghi gì.`,
        );
      }
      pending.push({ ...plan, course, assignedAt });
    }

    const videoCompletionPercent = await app
      .get(PlatformSettingsRepository)
      .getVideoCompletionPercent();
    if (videoCompletionPercent === null) {
      throw new SeedAbort(
        'learning_db thiếu platform_settings.video_completion_percent; chạy npm run db:seed của learning-service.',
      );
    }
    let timezone: string;
    try {
      timezone = (await tenant.getOrganizationAccess(ORGANIZER_A)).timezone;
    } catch (error) {
      throw new SeedAbort(
        `Tenant không trả múi giờ cho ORG_A: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!timezone) {
      throw new SeedAbort('Tenant trả múi giờ rỗng cho ORG_A.');
    }

    // ---- Gọi course-service: I1 (selfEnroll: false) rồi I2 ----
    const fetched: {
      plan: (typeof pending)[number];
      lock: LockedCourse;
      tree: CourseTree;
      material: CourseTreeMaterial | null;
    }[] = [];
    for (const plan of pending) {
      const lock = await courseClient.lockCourse(
        ORGANIZER_A,
        plan.courseId,
        false,
      );
      if (
        lock.expectedCompletionDays !== plan.course.expected_completion_days
      ) {
        throw new SeedAbort(
          `${plan.label}: I1 trả expectedCompletionDays ${lock.expectedCompletionDays}, course_db đọc được ` +
            `${plan.course.expected_completion_days}; dừng trước khi ghi learning_db.`,
        );
      }
      const tree = await courseClient.getCourseTree(ORGANIZER_A, plan.courseId);
      const material = plan.overdueWithProgress
        ? pickRequiredMaterial(tree)
        : null;
      if (plan.overdueWithProgress && !material) {
        throw new SeedAbort(
          `${plan.label}: không có học liệu bắt buộc còn hoạt động để ghi tiến độ.`,
        );
      }
      fetched.push({ plan, lock, tree, material });
    }

    // ---- Ghi trong một transaction ----
    await prisma.$transaction(async (tx) => {
      for (const { plan, lock, tree, material } of fetched) {
        if (!(await snapshots.existsForCourse(plan.courseId, ORG_A, tx))) {
          await snapshots.insertIgnoringConflicts(
            buildCourseSnapshotRows(lock, tree, new Date()),
            tx,
          );
        }
        const dueAt = await baseDueAt.computeBaseDueAt(
          plan.assignedAt,
          lock.expectedCompletionDays,
          timezone,
          tx,
        );
        const activityAt = new Date(plan.assignedAt.getTime() + DAY_MS);
        await enrollments.create(
          {
            id: plan.enrollmentId,
            organizationId: ORG_A,
            learnerId: LEARNER_1,
            courseId: plan.courseId,
            enrollmentType: 'Required',
            status: material ? 'InProgress' : 'NotStarted',
            enrolledAt: plan.assignedAt,
            assignedAt: plan.assignedAt,
            expectedCompletionDays: lock.expectedCompletionDays,
            baseDueAt: dueAt,
            dueAt,
            extensionSeconds: 0,
            videoCompletionPercent,
            firstActivityAt: material ? activityAt : null,
          },
          tx,
        );
        if (material) {
          // Reading chỉ có completed_at; Video thì đã xem trọn [0, duration_seconds)
          const duration =
            material.materialType === 'Video' ? material.durationSeconds : null;
          await tx.$executeRaw`
            INSERT INTO material_progress (id, organization_id, enrollment_id, material_id, watched_ranges, completed_at)
            VALUES (${DEMO_PROGRESS_02}::uuid, ${ORG_A}::uuid, ${plan.enrollmentId}::uuid, ${material.id}::uuid,
                    CASE WHEN ${duration}::int IS NULL THEN NULL
                         ELSE int4multirange(int4range(0, ${duration}::int)) END,
                    ${activityAt}::timestamptz)`;
        }
        console.log(`${plan.label}: đã tạo ${plan.enrollmentId}.`);
      }
    });

    await ensureDemoVideoProgress(prisma);

    await printResult(enrollments, courses, timezone);
  } finally {
    await app.close();
  }
}

/** ID tiến độ D50 chỉ được thuộc đúng (E-demo-2, Video L11); khác thì dừng trước khi ghi gì. */
async function assertDemoVideoProgressIdFree(
  prisma: PrismaService,
): Promise<void> {
  const row = await prisma.materialProgress.findFirst({
    where: { id: DEMO_VIDEO_PROGRESS_02 },
    select: { enrollmentId: true, materialId: true },
  });
  if (
    row &&
    (row.enrollmentId !== DEMO_ENROLLMENT_02 ||
      row.materialId !== DEMO_VIDEO_MATERIAL_02)
  ) {
    throw new SeedAbort(
      `ID tiến độ ${DEMO_VIDEO_PROGRESS_02} đã thuộc Enrollment ${row.enrollmentId}, học liệu ${row.materialId}; không ghi đè.`,
    );
  }
}

/**
 * D50: Video L11 của E-demo-2 hoàn thành. Ghi như luồng xem Video (thiết kế 3.3): watched_ranges phủ đủ
 * ⌈duration_seconds × video_completion_percent ÷ 100⌉ giây theo ngưỡng đã chép vào Enrollment, và completed_at.
 * Enrollment đã InProgress, có first_activity_at nên không cần cập nhật cột nào khác. Chạy lại không đổi gì.
 */
async function ensureDemoVideoProgress(prisma: PrismaService): Promise<void> {
  const label = 'Tiến độ Video L11 (E-demo-2)';
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: DEMO_ENROLLMENT_02,
      organizationId: ORG_A,
      learnerId: LEARNER_1,
      courseId: COURSE_AN_TOAN_V2,
    },
    select: {
      status: true,
      videoCompletionPercent: true,
      firstActivityAt: true,
    },
  });
  if (!enrollment || !enrollment.firstActivityAt) {
    throw new SeedAbort(
      `${label}: không thấy E-demo-2 ${DEMO_ENROLLMENT_02} có first_activity_at của LEARNER_1.`,
    );
  }

  const existing = await prisma.materialProgress.findFirst({
    where: {
      enrollmentId: DEMO_ENROLLMENT_02,
      materialId: DEMO_VIDEO_MATERIAL_02,
    },
    select: { id: true },
  });
  if (existing?.id === DEMO_VIDEO_PROGRESS_02) {
    console.log(`${label}: đã có (${DEMO_VIDEO_PROGRESS_02}), bỏ qua.`);
    return;
  }
  if (existing) {
    throw new SeedAbort(
      `${label}: đã có dòng tiến độ ${existing.id} (không phải ID demo); không ghi đè.`,
    );
  }

  const material = await prisma.materialSnapshot.findFirst({
    where: { materialId: DEMO_VIDEO_MATERIAL_02, organizationId: ORG_A },
    select: {
      courseId: true,
      lessonId: true,
      materialType: true,
      durationSeconds: true,
      disabledAt: true,
    },
  });
  if (
    !material ||
    material.courseId !== COURSE_AN_TOAN_V2 ||
    material.lessonId !== DEMO_VIDEO_LESSON_02 ||
    material.materialType !== 'Video' ||
    material.durationSeconds === null ||
    material.disabledAt !== null
  ) {
    throw new SeedAbort(
      `${label}: bản sao học liệu ${DEMO_VIDEO_MATERIAL_02} không phải Video còn hoạt động của L11 Course 02.`,
    );
  }

  const watchedSeconds = Math.ceil(
    (material.durationSeconds * enrollment.videoCompletionPercent) / 100,
  );
  await prisma.$executeRaw`
    INSERT INTO material_progress (id, organization_id, enrollment_id, material_id, watched_ranges, completed_at)
    VALUES (${DEMO_VIDEO_PROGRESS_02}::uuid, ${ORG_A}::uuid, ${DEMO_ENROLLMENT_02}::uuid, ${DEMO_VIDEO_MATERIAL_02}::uuid,
            int4multirange(int4range(0, ${watchedSeconds}::int)), ${enrollment.firstActivityAt}::timestamptz)`;
  console.log(
    `${label}: đã tạo ${DEMO_VIDEO_PROGRESS_02} (xem ${watchedSeconds}/${material.durationSeconds} giây, ngưỡng ${enrollment.videoCompletionPercent}%).`,
  );
}

async function printResult(
  enrollments: EnrollmentsRepository,
  courses: Map<string, CourseRow>,
  timezone: string,
): Promise<void> {
  const rows = await enrollments.findMinePage(LEARNER_1, ORG_A, 20, 0);
  const counts = await enrollments.countRequiredMaterials(
    rows.map((row) => row.id),
    ORG_A,
  );
  const format = new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    dateStyle: 'short',
    timeStyle: 'short',
  });
  console.log(
    `\nEnrollment của LEARNER_1 (thứ tự UC26, giờ tổ chức ${timezone}):`,
  );
  console.table(
    rows.map((row) => {
      const count = counts.get(row.id);
      return {
        enrollment: row.id,
        course: courses.get(row.courseId)?.name ?? row.courseId,
        loại: row.enrollmentType,
        'trạng thái': row.status,
        hạn: row.dueAt ? format.format(row.dueAt) : '—',
        'bắt buộc x/y': count ? `${count.completed}/${count.total}` : '—',
      };
    }),
  );
}

if (process.env.NODE_ENV === 'production') {
  console.error(
    'Refusing to seed: NODE_ENV=production. Demo data is for development only.',
  );
  process.exit(1);
}

run().catch((error: unknown) => {
  if (error instanceof SeedAbort) {
    console.error(
      `\nDừng seed:demo, không ghi gì vào learning_db: ${error.message}`,
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});
