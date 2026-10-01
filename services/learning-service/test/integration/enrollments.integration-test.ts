/**
 * Test tích hợp UC25.3 + D20: learning-service chạy thật trong tiến trình (cấu hình như main.ts),
 * gọi course-service thật với fixture ORG_TEST của seed course_db (D34).
 * Chỉ ghi dữ liệu của Course test; dọn ở đầu, đầu các ca cần "Enrollment đầu tiên" và cuối lần chạy (D17).
 *
 * Chạy: npm run test:integration (cần course-service chạy tại COURSE_SERVICE_URL, cả hai DB đã seed)
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CourseServiceClient } from '../../src/integrations/course-service/course-service.client';
import { readCourseServiceConfig } from '../../src/integrations/course-service/course-service.config';
import {
  courseDatabaseUrl,
  databaseUrl,
  ENROLL_IT_LEARNER_1,
  ENROLL_IT_LEARNER_2,
  ENROLL_IT_ORG,
  ENROLL_IT_PRIVATE_COURSE,
  ENROLL_IT_PUBLIC_COURSE,
  resetEnrollFixture,
} from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to learning_db and course_db.',
  );
}

/** Course demo của ORG_B: chỉ đọc, kiểm I1 không gắn Locked khi khác tổ chức. */
const COURSE_NHAP_MON_ORG_B = '0199a000-0000-7000-8000-0e0000000006';
const TEST_LEARNERS = [ENROLL_IT_LEARNER_1.userId, ENROLL_IT_LEARNER_2.userId];

const learningDb = new Client({ connectionString: databaseUrl('learning_db') });
const courseDb = new Client({ connectionString: courseDatabaseUrl() });
const courseClient = new CourseServiceClient(
  readCourseServiceConfig((key) => process.env[key]),
);

let app: NestExpressApplication | null = null;
let baseUrl = '';
let connected = false;

interface HttpResult {
  status: number;
  body: {
    data?: Record<string, unknown> | EnrolledCourseRef[];
    error?: Record<string, unknown>;
  };
}

async function call(
  user: CurrentUser,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
      [HEADER_NAMES.USER_ID]: user.userId,
      [HEADER_NAMES.USER_ROLE]: user.role,
      [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId!,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as HttpResult['body'],
  };
}

const enroll = (user: CurrentUser, courseId: string) =>
  call(user, 'POST', '/enrollments', { courseId });

interface EnrolledCourseRef {
  courseId: string;
  enrollmentId: string;
}

async function courseIdsOf(user: CurrentUser): Promise<EnrolledCourseRef[]> {
  const result = await call(user, 'GET', '/enrollments/me/course-ids');
  assert.equal(result.status, 200);
  return result.body.data as EnrolledCourseRef[];
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await learningDb.query<{ n: string }>(sql, params);
  return Number(rows[0].n);
}

async function snapshotCounts(courseId: string) {
  const countIn = (table: string) =>
    count(
      `SELECT count(*) AS n FROM ${table} WHERE course_id = $1 AND organization_id = $2`,
      [courseId, ENROLL_IT_ORG],
    );
  return {
    courses: await countIn('course_version_snapshots'),
    materials: await countIn('material_snapshots'),
    lessons: await countIn('lesson_snapshots'),
  };
}

/** Số dòng bản sao mong đợi, tính từ I2 (I2 không gắn Locked). */
async function expectedSnapshotCounts(courseId: string) {
  const tree = await courseClient.getCourseTree(ENROLL_IT_LEARNER_1, courseId);
  const lessons = tree.modules.flatMap((m) => m.lessons);
  return {
    courses: 1,
    materials: lessons.reduce((sum, l) => sum + l.materials.length, 0),
    lessons: lessons.filter((l) => l.disabledAt !== null).length,
  };
}

/** Đưa fixture về chưa có Enrollment, chưa có bản sao, chưa Locked. */
async function resetToNoEnrollment(): Promise<void> {
  await resetEnrollFixture(learningDb, courseDb);
  assert.deepEqual(await snapshotCounts(ENROLL_IT_PUBLIC_COURSE), {
    courses: 0,
    materials: 0,
    lessons: 0,
  });
}

/** locked_at, updated_at dạng text (giữ micro giây). */
async function readLockedState(courseId: string) {
  const { rows } = await courseDb.query<{
    locked_at: string | null;
    updated_at: string;
  }>('SELECT locked_at::text, updated_at::text FROM courses WHERE id = $1', [
    courseId,
  ]);
  return rows[0];
}

before(async () => {
  await learningDb.connect();
  await courseDb.connect();
  connected = true;
  await resetEnrollFixture(learningDb, courseDb);

  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'],
  });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  try {
    if (connected) {
      await resetEnrollFixture(learningDb, courseDb);
    }
  } finally {
    await app?.close();
    await learningDb.end().catch(() => undefined);
    await courseDb.end().catch(() => undefined);
  }
});

void describe('UC25.3 POST /enrollments + D20 GET /enrollments/me/course-ids (thật)', () => {
  void test('đăng ký Course test → 201; bản sao đủ theo I2; Enrollment đúng cột; course-ids có { Course test, Enrollment vừa tạo }', async () => {
    await resetToNoEnrollment();

    const result = await enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const data = result.body.data as Record<string, unknown>;
    assert.deepEqual(Object.keys(data).sort(), [
      'courseId',
      'enrolledAt',
      'enrollmentType',
      'id',
      'status',
    ]);
    assert.equal(data.courseId, ENROLL_IT_PUBLIC_COURSE);
    assert.equal(data.enrollmentType, 'Optional');
    assert.equal(data.status, 'NotStarted');

    assert.deepEqual(
      await snapshotCounts(ENROLL_IT_PUBLIC_COURSE),
      await expectedSnapshotCounts(ENROLL_IT_PUBLIC_COURSE),
    );

    const { rows } = await learningDb.query<Record<string, unknown>>(
      `SELECT e.enrollment_type, e.status, e.assigned_at, e.expected_completion_days,
              e.base_due_at, e.due_at, e.extension_seconds::int AS extension_seconds,
              e.video_completion_percent = p.video_completion_percent AS pct_matches,
              e.organization_id::text AS organization_id
         FROM enrollments e CROSS JOIN platform_settings p WHERE e.id = $1`,
      [data.id],
    );
    assert.deepEqual(rows[0], {
      enrollment_type: 'Optional',
      status: 'NotStarted',
      assigned_at: null,
      expected_completion_days: null,
      base_due_at: null,
      due_at: null,
      extension_seconds: 0,
      pct_matches: true,
      organization_id: ENROLL_IT_ORG,
    });

    assert.deepEqual(await courseIdsOf(ENROLL_IT_LEARNER_1), [
      { courseId: ENROLL_IT_PUBLIC_COURSE, enrollmentId: data.id },
    ]);
    // Learner thứ hai cùng tổ chức không thấy Enrollment của Learner thứ nhất
    assert.deepEqual(await courseIdsOf(ENROLL_IT_LEARNER_2), []);
  });

  void test('Enrollment chuyển Withdrawn → không còn trong course-ids (D3, D20)', async () => {
    await resetToNoEnrollment();
    const created = await enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const enrollmentId = (created.body.data as Record<string, unknown>).id;
    assert.deepEqual(await courseIdsOf(ENROLL_IT_LEARNER_1), [
      { courseId: ENROLL_IT_PUBLIC_COURSE, enrollmentId },
    ]);

    await learningDb.query(
      `UPDATE enrollments
          SET status = 'Withdrawn', withdrawn_at = now(), withdrawn_reason = 'LearnerWithdrew'
        WHERE id = $1 AND organization_id = $2`,
      [enrollmentId, ENROLL_IT_ORG],
    );

    assert.deepEqual(await courseIdsOf(ENROLL_IT_LEARNER_1), []);
  });

  void test('đăng ký lại Course test → 409 ALREADY_ENROLLED, enrollmentId trùng lần 201', async () => {
    await resetToNoEnrollment();
    const created = await enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const result = await enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE);
    assert.equal(result.status, 409);
    assert.equal(result.body.error?.code, 'ALREADY_ENROLLED');
    assert.equal(result.body.error?.message, 'Bạn đã đăng ký Course này');
    assert.equal(
      result.body.error?.enrollmentId,
      (created.body.data as Record<string, unknown>).id,
    );
  });

  void test('SONG SONG cùng Learner, Course chưa có bản sao → đúng một 201, một 409 mang id vừa tạo, đúng 1 dòng', async () => {
    await resetToNoEnrollment();

    const results = await Promise.all([
      enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE),
      enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE),
    ]);
    assert.deepEqual(
      results.map((r) => r.status).sort(),
      [201, 409],
      JSON.stringify(results.map((r) => r.body)),
    );
    const created = results.find((r) => r.status === 201)!;
    const conflict = results.find((r) => r.status === 409)!;
    assert.equal(conflict.body.error?.code, 'ALREADY_ENROLLED');
    assert.equal(
      conflict.body.error?.enrollmentId,
      (created.body.data as Record<string, unknown>).id,
    );
    assert.equal(
      await count(
        'SELECT count(*) AS n FROM enrollments WHERE learner_id = $1 AND course_id = $2',
        [ENROLL_IT_LEARNER_1.userId, ENROLL_IT_PUBLIC_COURSE],
      ),
      1,
    );
  });

  void test('SONG SONG hai Learner, Course chưa có bản sao → cả hai 201, bản sao chỉ một bộ', async () => {
    await resetToNoEnrollment();

    const results = await Promise.all([
      enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE),
      enroll(ENROLL_IT_LEARNER_2, ENROLL_IT_PUBLIC_COURSE),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [201, 201],
      JSON.stringify(results.map((r) => r.body)),
    );
    assert.deepEqual(
      await snapshotCounts(ENROLL_IT_PUBLIC_COURSE),
      await expectedSnapshotCounts(ENROLL_IT_PUBLIC_COURSE),
    );
    assert.equal(
      await count(
        'SELECT count(*) AS n FROM enrollments WHERE course_id = $1 AND learner_id = ANY($2::uuid[])',
        [ENROLL_IT_PUBLIC_COURSE, TEST_LEARNERS],
      ),
      2,
    );
    assert.deepEqual(await courseIdsOf(ENROLL_IT_LEARNER_2), [
      {
        courseId: ENROLL_IT_PUBLIC_COURSE,
        enrollmentId: (results[1].body.data as Record<string, unknown>).id,
      },
    ]);
  });

  void test('Course test Private → 404 COURSE_NOT_AVAILABLE, locked_at vẫn NULL', async () => {
    await resetEnrollFixture(learningDb, courseDb);
    assert.equal(
      (await readLockedState(ENROLL_IT_PRIVATE_COURSE)).locked_at,
      null,
    );

    const result = await enroll(ENROLL_IT_LEARNER_1, ENROLL_IT_PRIVATE_COURSE);
    assert.equal(result.status, 404);
    assert.equal(result.body.error?.code, 'COURSE_NOT_AVAILABLE');
    assert.equal(result.body.error?.message, 'Course không còn trong danh mục');
    assert.equal(
      (await readLockedState(ENROLL_IT_PRIVATE_COURSE)).locked_at,
      null,
    );
  });

  void test('0e…06 (org B) → 404 COURSE_NOT_AVAILABLE, locked_at và updated_at của 0e…06 không đổi', async () => {
    const before = await readLockedState(COURSE_NHAP_MON_ORG_B);
    assert.ok(
      before,
      `course_db không có Course ${COURSE_NHAP_MON_ORG_B} (org B); chạy npm run db:seed của course-service.`,
    );

    const result = await enroll(ENROLL_IT_LEARNER_1, COURSE_NHAP_MON_ORG_B);
    assert.equal(result.status, 404);
    assert.equal(result.body.error?.code, 'COURSE_NOT_AVAILABLE');
    assert.deepEqual(await readLockedState(COURSE_NHAP_MON_ORG_B), before);
  });

  void test('courseId không phải UUID → 400', async () => {
    const result = await call(ENROLL_IT_LEARNER_1, 'POST', '/enrollments', {
      courseId: 'abc',
    });
    assert.equal(result.status, 400);
  });

  void test('sai role → 403 ở cả 2 endpoint', async () => {
    const instructor: CurrentUser = {
      ...ENROLL_IT_LEARNER_1,
      role: 'INSTRUCTOR',
    };
    assert.equal(
      (await enroll(instructor, ENROLL_IT_PUBLIC_COURSE)).status,
      403,
    );
    assert.equal(
      (await call(instructor, 'GET', '/enrollments/me/course-ids')).status,
      403,
    );
  });
});
