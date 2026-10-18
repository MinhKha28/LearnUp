/**
 * LearnUP learning_db DEV integration seed (Identity + Tenant + Course, branch develop).
 * Save as learning-service/prisma/seed-enrollments.ts. CREATE-ONLY: never deletes/overwrites Enrollment.
 * Prerequisites: tenant account-management and course seed are installed in their DBs.
 * Does not simulate Kafka delivery, Course locking, or instructor assignment side effects.
 * Execute from services/learning-service: npx ts-node -P tsconfig.seed.json prisma/seed-enrollments.ts.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { Client } from 'pg';

const ORG = '01900000-0000-7000-8000-00000000a001';
const LEARNER_AN = '01900000-0000-7000-8000-00000000a201';
const LEARNER_BINH = '01900000-0000-7000-8000-00000000a202';
const LEARNER_CUONG = '01900000-0000-7000-8000-00000000a203';
const PLATFORM_SETTINGS_ID = '0199a000-0000-7000-8000-1f0000000002';
const VIDEO_PERCENT = 90;
// Matches course-service/prisma/seed.ts fixtureId(0xc002, chain*10 + version).
const courseId = (chain: number, version = 1) =>
  `01900000-0000-7000-8000-c002${(chain * 10 + version).toString(16).padStart(8, '0')}`;
const enrollmentId = (n: number) =>
  `01900000-0000-7000-8000-e001${n.toString(16).padStart(8, '0')}`;
const date = (day: string) => new Date(`${day}T08:00:00.000Z`);
const plusDays = (from: Date, days: number) => new Date(from.getTime() + days * 86_400_000);

type Plan = {
  code: string;
  id: string;
  learnerId: string;
  courseId: string;
  enrollmentType: 'Required' | 'Optional';
  status: 'NotStarted' | 'InProgress' | 'Completed' | 'Withdrawn';
  assignedAt: Date | null;
  enrolledAt: Date;
  completedAt?: Date;
  withdrawnAt?: Date;
  firstActivityAt?: Date;
};

// Archived V1: assigned before archived (2026-09-11); organization created 2026-08-25.
// Locked Course 11: published 2026-08-29, locked 2026-09-03.
// Course 11: used for both NotStarted and Completed Required examples by two learners.
// Course 15: Published Public (2026-09-06); learner An deliberately NOT enrolled,
// so you can test POST /api/v1/enrollments via real JWT.
// Course 12: Published Public, material disabled; useful for progress-count testing.
const PLANS: Plan[] = [
  { code: 'ARCHIVED_REQUIRED', id: enrollmentId(1), learnerId: LEARNER_AN,
    courseId: courseId(9, 1), enrollmentType: 'Required', status: 'InProgress',
    assignedAt: date('2026-09-02'), enrolledAt: date('2026-09-02'), firstActivityAt: date('2026-09-03') },
  { code: 'REQUIRED_NOT_STARTED', id: enrollmentId(2), learnerId: LEARNER_AN,
    courseId: courseId(11), enrollmentType: 'Required', status: 'NotStarted',
    assignedAt: date('2026-09-05'), enrolledAt: date('2026-09-05') },
  { code: 'REQUIRED_COMPLETED', id: enrollmentId(3), learnerId: LEARNER_BINH,
    courseId: courseId(11), enrollmentType: 'Required', status: 'Completed',
    assignedAt: date('2026-09-06'), enrolledAt: date('2026-09-06'), firstActivityAt: date('2026-09-07'), completedAt: date('2026-09-09') },
  { code: 'OPTIONAL_IN_PROGRESS', id: enrollmentId(4), learnerId: LEARNER_BINH,
    courseId: courseId(15), enrollmentType: 'Optional', status: 'InProgress',
    assignedAt: null, enrolledAt: date('2026-09-10'), firstActivityAt: date('2026-09-11') },
  { code: 'OPTIONAL_WITHDRAWN', id: enrollmentId(5), learnerId: LEARNER_CUONG,
    courseId: courseId(15), enrollmentType: 'Optional', status: 'Withdrawn',
    assignedAt: null, enrolledAt: date('2026-09-10'), withdrawnAt: date('2026-09-12') },
  { code: 'DISABLED_MATERIALS', id: enrollmentId(6), learnerId: LEARNER_CUONG,
    courseId: courseId(12), enrollmentType: 'Optional', status: 'NotStarted',
    assignedAt: null, enrolledAt: date('2026-09-14') },
];

type CourseRow = {
  id: string; organization_id: string; chain_id: string; status: string;
  published_at: Date | null; archived_at: Date | null; disabled_at: Date | null;
  locked_at: Date | null; expected_completion_days: number;
};
type MaterialRow = {
  material_id: string; lesson_id: string; material_type: string;
  is_required: boolean; duration_seconds: number | null;
  material_disabled_at: Date | null; lesson_disabled_at: Date | null;
};
type LessonRow = { lesson_id: string; disabled_at: Date | null };

type Resolved = { plan: Plan; course: CourseRow; materials: MaterialRow[]; lessons: LessonRow[] };

function dbUrl(envKey: string, target: string): string {
  const raw = process.env[envKey];
  if (!raw) throw new Error(`Missing ${envKey}.`);
  const url = new URL(raw);
  if (url.pathname !== `/${target}`) {
    throw new Error(`${envKey} must target ${target}, got ${url.pathname}`);
  }
  url.searchParams.delete('schema'); // node-postgres doesn't use Prisma ?schema=public.
  return url.toString();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production');
  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
  const learningUrl = dbUrl('DATABASE_URL', 'learning_db');
  // Explicit COURSE_DATABASE_URL prevents accidentally reading the wrong remote host/DB.
  const courseUrl = dbUrl('COURSE_DATABASE_URL', 'course_db');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: learningUrl }) });
  const courseDb = new Client({ connectionString: courseUrl });

  try {
    await courseDb.connect();
    // Preflight all cross-DB references before inserting the first Enrollment.
    const prepared: Resolved[] = [];
    for (const plan of PLANS) {
      const cr = await courseDb.query<CourseRow>(
        `SELECT id::text, organization_id::text, chain_id::text, status,
                published_at, archived_at, disabled_at, locked_at, expected_completion_days
         FROM courses WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [plan.courseId, ORG],
      );
      const course = cr.rows[0];
      if (!course) throw new Error(`Missing Course for ${plan.code}: ${plan.courseId}. Run course seed first.`);
      if (!course.published_at || !['Published', 'Archived'].includes(course.status) || course.disabled_at) {
        throw new Error(`${plan.code}: Course is not Published/Archived or is Disabled (${course.status}).`);
      }
      if (plan.enrolledAt < course.published_at || (plan.assignedAt && plan.assignedAt < course.published_at)) {
        throw new Error(`${plan.code}: Enrollment before course publication.`);
      }
      if (course.archived_at && plan.enrolledAt >= course.archived_at) {
        throw new Error(`${plan.code}: New Enrollment on Archived Course is invalid.`);
      }
      if (plan.enrollmentType === 'Required' && (!plan.assignedAt || !course.locked_at)) {
        throw new Error(`${plan.code}: Required fixture needs assignedAt and already Locked Course.`);
      }
      if (plan.enrollmentType === 'Optional' && plan.assignedAt) {
        throw new Error(`${plan.code}: Optional must not have assignedAt.`);
      }
      if (plan.firstActivityAt && plan.firstActivityAt < plan.enrolledAt) {
        throw new Error(`${plan.code}: firstActivityAt before enrolledAt.`);
      }
      if (plan.completedAt && (!plan.firstActivityAt || plan.completedAt < plan.firstActivityAt)) {
        throw new Error(`${plan.code}: invalid completion timeline.`);
      }
      if ((plan.status === 'Withdrawn') !== Boolean(plan.withdrawnAt)) {
        throw new Error(`${plan.code}: Withdrawn requires withdrawnAt, other statuses must not have it.`);
      }
      if ((plan.status === 'Completed') !== Boolean(plan.completedAt)) {
        throw new Error(`${plan.code}: Completed requires completedAt, other statuses must not have it.`);
      }
      if (plan.status === 'NotStarted' && plan.firstActivityAt) {
        throw new Error(`${plan.code}: NotStarted cannot have firstActivityAt.`);
      }
      if (plan.status === 'InProgress' && !plan.firstActivityAt) {
        throw new Error(`${plan.code}: InProgress requires firstActivityAt.`);
      }
      if (plan.withdrawnAt && plan.withdrawnAt < plan.enrolledAt) {
        throw new Error(`${plan.code}: invalid withdrawal timeline.`);
      }
      const [mr, lr] = await Promise.all([
        courseDb.query<MaterialRow>(
          `SELECT m.id::text AS material_id, l.id::text AS lesson_id,
                  m.material_type, m.is_required, f.duration_seconds,
                  m.disabled_at AS material_disabled_at, l.disabled_at AS lesson_disabled_at
           FROM modules mo JOIN lessons l ON l.module_id = mo.id
           JOIN materials m ON m.lesson_id = l.id
           JOIN media_files f ON f.id = m.file_id
           WHERE mo.course_id = $1::uuid AND mo.organization_id = $2::uuid
           ORDER BY mo.position, l.position, m.position`,
          [plan.courseId, ORG],
        ),
        courseDb.query<LessonRow>(
          `SELECT l.id::text AS lesson_id, l.disabled_at
           FROM modules mo JOIN lessons l ON l.module_id = mo.id
           WHERE mo.course_id = $1::uuid AND mo.organization_id = $2::uuid`,
          [plan.courseId, ORG],
        ),
      ]);
      prepared.push({ plan, course, materials: mr.rows, lessons: lr.rows });
    }

    const existing = await prisma.enrollment.findMany({
      where: { OR: PLANS.map(p => ({ learnerId: p.learnerId, courseId: p.courseId })) },
      select: { id: true, learnerId: true, courseId: true },
    });
    for (const row of existing) {
      const plan = PLANS.find(p => p.learnerId === row.learnerId && p.courseId === row.courseId);
      if (!plan || row.id !== plan.id) {
        throw new Error(`Existing Enrollment ${row.id} conflicts with deterministic demo fixture. No changes made.`);
      }
    }

    await prisma.$transaction(async tx => {
      await tx.platformSetting.upsert({
        where: { id: PLATFORM_SETTINGS_ID },
        create: { id: PLATFORM_SETTINGS_ID, videoCompletionPercent: VIDEO_PERCENT, sourceAsOf: date('2026-10-01') },
        update: {}, // Preserve settings previously configured by operator.
      });
      for (const { plan, course, materials, lessons } of prepared) {
        const existingEnrollment = await tx.enrollment.findUnique({
          where: { learnerId_courseId: { learnerId: plan.learnerId, courseId: plan.courseId } },
          select: { id: true },
        });
        if (existingEnrollment) {
          if (existingEnrollment.id !== plan.id) throw new Error(`Conflicting Enrollment for ${plan.code}`);
          continue; // Create-only; never overwrite progress made by real API calls.
        }
        const asOf = date('2026-10-01');
        await tx.courseVersionSnapshot.upsert({
          where: { courseId: course.id },
          create: {
            courseId: course.id, organizationId: ORG, chainId: course.chain_id,
            treeFetchedAt: asOf, disabledAt: course.disabled_at, disabledAsOf: asOf,
          }, update: {},
        });
        for (const lesson of lessons) {
          if (!lesson.disabled_at) continue; // sparse lesson snapshot table.
          await tx.lessonSnapshot.upsert({
            where: { lessonId: lesson.lesson_id },
            create: { lessonId: lesson.lesson_id, organizationId: ORG, courseId: course.id,
              disabledAt: lesson.disabled_at, disabledAsOf: asOf },
            update: {},
          });
        }
        for (const mat of materials) {
          await tx.materialSnapshot.upsert({
            where: { materialId: mat.material_id },
            create: {
              materialId: mat.material_id, organizationId: ORG, courseId: course.id,
              lessonId: mat.lesson_id, materialType: mat.material_type,
              isRequired: mat.is_required,
              durationSeconds: mat.material_type === 'Video' ? mat.duration_seconds : null,
              durationAsOf: mat.material_type === 'Video' ? asOf : null,
              disabledAt: mat.material_disabled_at, disabledAsOf: asOf,
            }, update: {},
          });
        }
        const required = plan.enrollmentType === 'Required';
        const baseDueAt = required ? plusDays(plan.assignedAt!, course.expected_completion_days) : null;
        await tx.enrollment.create({
          data: {
            id: plan.id, organizationId: ORG, learnerId: plan.learnerId,
            courseId: course.id, enrollmentType: plan.enrollmentType,
            status: plan.status, enrolledAt: plan.enrolledAt, assignedAt: plan.assignedAt,
            expectedCompletionDays: required ? course.expected_completion_days : null,
            baseDueAt, dueAt: baseDueAt, extensionSeconds: BigInt(0),
            videoCompletionPercent: VIDEO_PERCENT,
            firstActivityAt: plan.firstActivityAt ?? null,
            completedAt: plan.completedAt ?? null,
            completedLate: plan.completedAt && baseDueAt ? plan.completedAt > baseDueAt : null,
            withdrawnAt: plan.withdrawnAt ?? null,
            withdrawnReason: plan.status === 'Withdrawn' ? 'LearnerWithdrew' : null,
          },
        });
        // Progress: Completed fixture has all active required materials completed.
        // InProgress fixtures have only the first eligible required material complete.
        const active = materials.filter(m => m.is_required && !m.material_disabled_at &&
          !lessons.some(l => l.lesson_id === m.lesson_id && l.disabled_at));
        const chosen = plan.status === 'Completed' ? active :
          plan.status === 'InProgress' ? active.slice(0, 1) : [];
        for (let i = 0; i < chosen.length; i++) {
          const m = chosen[i];
          const at = plan.completedAt ?? plan.firstActivityAt ?? plan.enrolledAt;
          const progressId = `01900000-0000-7000-8000-e002${(parseInt(plan.id.slice(-8), 16) * 100 + i + 1).toString(16).padStart(8, '0')}`;
          // watchedRanges is Unsupported(int4multirange), so Prisma cannot set it normally.
          if (m.material_type === 'Video' && m.duration_seconds && m.duration_seconds > 0) {
            const seconds = Math.ceil(m.duration_seconds * VIDEO_PERCENT / 100);
            await tx.$executeRaw`
              INSERT INTO material_progress (id, organization_id, enrollment_id, material_id, watched_ranges, completed_at)
              VALUES (${progressId}::uuid, ${ORG}::uuid, ${plan.id}::uuid,
                      ${m.material_id}::uuid, int4multirange(int4range(0, ${seconds}::int)),
                      ${at}::timestamptz)`;
          } else {
            await tx.materialProgress.create({
              data: { id: progressId, organizationId: ORG, enrollmentId: plan.id,
                materialId: m.material_id, completedAt: at },
            });
          }
        }
      }
    });
    console.table(PLANS.map(p => ({ case: p.code, learner: p.learnerId.slice(-4), course: p.courseId.slice(-12), status: p.status })));
    console.log('learning_db seeded successfully; existing Enrollments were not overwritten.');
    console.log('NOTE: dueAt here uses UTC day arithmetic (not tenant timezone rules); use real assignment API to test exact deadlines.');
  } finally {
    await courseDb.end().catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
