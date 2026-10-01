/**
 * Test tích hợp UC25.3 + D20: learning-service chạy thật trong tiến trình (cấu hình như main.ts),
 * gọi course-service thật với dữ liệu seed. Ghi vào learning_db và course_db (locked_at);
 * after() xóa mọi dòng test tạo và trả locked_at về đúng giá trị cũ (D17).
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

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to learning_db and course_db.',
  );
}

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const COURSE_AN_TOAN_V2 = '0199a000-0000-7000-8000-0e0000000002';
const COURSE_BAO_MAT = '0199a000-0000-7000-8000-0e0000000003';
const COURSE_QUY_TRINH_PRIVATE = '0199a000-0000-7000-8000-0e0000000004';
const COURSE_NHAP_MON_ORG_B = '0199a000-0000-7000-8000-0e0000000006';
const TEST_COURSES = [
  COURSE_AN_TOAN_V2,
  COURSE_BAO_MAT,
  COURSE_QUY_TRINH_PRIVATE,
  COURSE_NHAP_MON_ORG_B,
];

const learner = (userId: string): CurrentUser => ({
  userId,
  organizationId: ORG_A,
  role: 'LEARNER',
  isAuthenticated: true,
});
const LEARNER_1 = learner('0199a000-0000-7000-8000-0b0000000001');
const LEARNER_2 = learner('0199a000-0000-7000-8000-0b0000000002');
const TEST_LEARNERS = [LEARNER_1.userId, LEARNER_2.userId];

/** Bỏ ?schema=… của Prisma; pg không hiểu tham số này. */
function databaseUrl(name: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${name}`;
  url.search = '';
  return url.toString();
}

const learningDb = new Client({ connectionString: databaseUrl('learning_db') });
const courseDb = new Client({
  connectionString: process.env.COURSE_DATABASE_URL ?? databaseUrl('course_db'),
});
const courseClient = new CourseServiceClient(
  readCourseServiceConfig((key) => process.env[key]),
);

let app: NestExpressApplication | null = null;
let baseUrl = '';
let connected = false;
/** locked_at, updated_at dạng text (giữ micro giây) trước khi test chạy. */
const lockedBefore = new Map<
  string,
  { locked_at: string | null; updated_at: string }
>();

interface HttpResult {
  status: number;
  body: {
    data?: Record<string, unknown> | string[];
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

async function courseIdsOf(user: CurrentUser): Promise<string[]> {
  const result = await call(user, 'GET', '/enrollments/me/course-ids');
  assert.equal(result.status, 200);
  return result.body.data as string[];
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await learningDb.query<{ n: string }>(sql, params);
  return Number(rows[0].n);
}

async function snapshotCounts(courseId: string) {
  return {
    courses: await count(
      'SELECT count(*) AS n FROM course_version_snapshots WHERE course_id = $1',
      [courseId],
    ),
    materials: await count(
      'SELECT count(*) AS n FROM material_snapshots WHERE course_id = $1',
      [courseId],
    ),
    lessons: await count(
      'SELECT count(*) AS n FROM lesson_snapshots WHERE course_id = $1',
      [courseId],
    ),
  };
}

/** Số dòng bản sao mong đợi, tính từ I2 (I2 không gắn Locked). */
async function expectedSnapshotCounts(courseId: string) {
  const tree = await courseClient.getCourseTree(LEARNER_1, courseId);
  const lessons = tree.modules.flatMap((m) => m.lessons);
  return {
    courses: 1,
    materials: lessons.reduce((sum, l) => sum + l.materials.length, 0),
    lessons: lessons.filter((l) => l.disabledAt !== null).length,
  };
}

/** Xóa Enrollment và bản sao của các Course test, theo thứ tự khóa ngoại. */
async function deleteTestRows(courseIds: string[]): Promise<void> {
  await learningDb.query(
    'DELETE FROM enrollments WHERE learner_id = ANY($1::uuid[]) AND course_id = ANY($2::uuid[])',
    [TEST_LEARNERS, courseIds],
  );
  for (const table of [
    'lesson_snapshots',
    'material_snapshots',
    'course_version_snapshots',
  ]) {
    await learningDb.query(
      `DELETE FROM ${table} WHERE course_id = ANY($1::uuid[])`,
      [courseIds],
    );
  }
}

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

  // Không đụng dữ liệu có sẵn: cleanup chỉ an toàn khi các dòng này do test tạo
  const leftovers =
    (await count(
      'SELECT count(*) AS n FROM enrollments WHERE learner_id = ANY($1::uuid[]) AND course_id = ANY($2::uuid[])',
      [TEST_LEARNERS, TEST_COURSES],
    )) +
    (await count(
      'SELECT count(*) AS n FROM course_version_snapshots WHERE course_id = ANY($1::uuid[])',
      [TEST_COURSES],
    ));
  if (leftovers > 0) {
    connected = false;
    throw new Error(
      `learning_db đã có ${leftovers} Enrollment/bản sao trên các Course test; dọn tay trước khi chạy test.`,
    );
  }

  for (const courseId of TEST_COURSES) {
    const state = await readLockedState(courseId);
    lockedBefore.set(courseId, state);
    console.log(
      `locked_at trước test ${courseId.slice(-4)}: ${state.locked_at}`,
    );
  }

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
      await deleteTestRows(TEST_COURSES);
      for (const [courseId, state] of lockedBefore) {
        await courseDb.query(
          'UPDATE courses SET locked_at = $1::timestamptz, updated_at = $2::timestamptz WHERE id = $3',
          [state.locked_at, state.updated_at, courseId],
        );
        const restored = await readLockedState(courseId);
        console.log(
          `locked_at sau khi trả lại ${courseId.slice(-4)}: ${restored.locked_at}`,
        );
        assert.deepEqual(restored, state);
      }
    }
  } finally {
    await app?.close();
    await learningDb.end().catch(() => undefined);
    await courseDb.end().catch(() => undefined);
  }
});

void describe('UC25.3 POST /enrollments + D20 GET /enrollments/me/course-ids (thật)', () => {
  let firstEnrollmentId = '';

  void test('đăng ký 0e…03 → 201; bản sao đủ theo I2; Enrollment đúng cột; course-ids có 0e…03', async () => {
    const result = await enroll(LEARNER_1, COURSE_BAO_MAT);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const data = result.body.data as Record<string, unknown>;
    assert.deepEqual(Object.keys(data).sort(), [
      'courseId',
      'enrolledAt',
      'enrollmentType',
      'id',
      'status',
    ]);
    assert.equal(data.courseId, COURSE_BAO_MAT);
    assert.equal(data.enrollmentType, 'Optional');
    assert.equal(data.status, 'NotStarted');
    firstEnrollmentId = data.id as string;

    assert.deepEqual(
      await snapshotCounts(COURSE_BAO_MAT),
      await expectedSnapshotCounts(COURSE_BAO_MAT),
    );

    const { rows } = await learningDb.query<Record<string, unknown>>(
      `SELECT e.enrollment_type, e.status, e.assigned_at, e.expected_completion_days,
              e.base_due_at, e.due_at, e.extension_seconds::int AS extension_seconds,
              e.video_completion_percent = p.video_completion_percent AS pct_matches,
              e.organization_id::text AS organization_id
         FROM enrollments e CROSS JOIN platform_settings p WHERE e.id = $1`,
      [firstEnrollmentId],
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
      organization_id: ORG_A,
    });

    assert.ok((await courseIdsOf(LEARNER_1)).includes(COURSE_BAO_MAT));
  });

  void test('đăng ký lại 0e…03 → 409 ALREADY_ENROLLED, enrollmentId trùng lần 201', async () => {
    assert.ok(firstEnrollmentId, 'cần ca 201 ở trên chạy trước');
    const result = await enroll(LEARNER_1, COURSE_BAO_MAT);
    assert.equal(result.status, 409);
    assert.equal(result.body.error?.code, 'ALREADY_ENROLLED');
    assert.equal(result.body.error?.message, 'Bạn đã đăng ký Course này');
    assert.equal(result.body.error?.enrollmentId, firstEnrollmentId);
  });

  void test('SONG SONG cùng Learner trên 0e…02 → đúng một 201, một 409 mang id vừa tạo, đúng 1 dòng', async () => {
    const results = await Promise.all([
      enroll(LEARNER_1, COURSE_AN_TOAN_V2),
      enroll(LEARNER_1, COURSE_AN_TOAN_V2),
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
        [LEARNER_1.userId, COURSE_AN_TOAN_V2],
      ),
      1,
    );
  });

  void test('SONG SONG LEARNER_1 và LEARNER_2, Course chưa có bản sao → cả hai 201, bản sao chỉ một bộ', async () => {
    // Đưa 0e…02 về trạng thái chưa có bản sao (dữ liệu của ca trước)
    await deleteTestRows([COURSE_AN_TOAN_V2]);
    assert.deepEqual(await snapshotCounts(COURSE_AN_TOAN_V2), {
      courses: 0,
      materials: 0,
      lessons: 0,
    });

    const results = await Promise.all([
      enroll(LEARNER_1, COURSE_AN_TOAN_V2),
      enroll(LEARNER_2, COURSE_AN_TOAN_V2),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [201, 201],
      JSON.stringify(results.map((r) => r.body)),
    );
    assert.deepEqual(
      await snapshotCounts(COURSE_AN_TOAN_V2),
      await expectedSnapshotCounts(COURSE_AN_TOAN_V2),
    );
    assert.equal(
      await count(
        'SELECT count(*) AS n FROM enrollments WHERE course_id = $1 AND learner_id = ANY($2::uuid[])',
        [COURSE_AN_TOAN_V2, TEST_LEARNERS],
      ),
      2,
    );
    assert.ok((await courseIdsOf(LEARNER_2)).includes(COURSE_AN_TOAN_V2));
  });

  void test('0e…04 (Private) → 404 COURSE_NOT_AVAILABLE, locked_at vẫn NULL', async () => {
    const result = await enroll(LEARNER_1, COURSE_QUY_TRINH_PRIVATE);
    assert.equal(result.status, 404);
    assert.equal(result.body.error?.code, 'COURSE_NOT_AVAILABLE');
    assert.equal(result.body.error?.message, 'Course không còn trong danh mục');
    assert.equal(
      lockedBefore.get(COURSE_QUY_TRINH_PRIVATE)?.locked_at,
      null,
      'seed: 0e…04 chưa Locked',
    );
    assert.equal(
      (await readLockedState(COURSE_QUY_TRINH_PRIVATE)).locked_at,
      null,
    );
  });

  void test('0e…06 (org B) → 404 COURSE_NOT_AVAILABLE', async () => {
    const result = await enroll(LEARNER_1, COURSE_NHAP_MON_ORG_B);
    assert.equal(result.status, 404);
    assert.equal(result.body.error?.code, 'COURSE_NOT_AVAILABLE');
    assert.equal(
      (await readLockedState(COURSE_NHAP_MON_ORG_B)).locked_at,
      lockedBefore.get(COURSE_NHAP_MON_ORG_B)?.locked_at,
    );
  });

  void test('courseId không phải UUID → 400', async () => {
    const result = await call(LEARNER_1, 'POST', '/enrollments', {
      courseId: 'abc',
    });
    assert.equal(result.status, 400);
  });

  void test('sai role → 403 ở cả 2 endpoint', async () => {
    const instructor: CurrentUser = { ...LEARNER_1, role: 'INSTRUCTOR' };
    assert.equal((await enroll(instructor, COURSE_BAO_MAT)).status, 403);
    assert.equal(
      (await call(instructor, 'GET', '/enrollments/me/course-ids')).status,
      403,
    );
  });
});
