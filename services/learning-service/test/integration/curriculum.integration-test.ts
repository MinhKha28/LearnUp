import { closeAll, closeApp } from './deadlines';
import { testFetch as fetch } from './test-io';
/**
 * Test tích hợp UC27 (GET /enrollments/:id/curriculum) và UC27.1 (GET /enrollments/:id/lessons/:lessonId)
 * trên fixture ORG_TEST (D34), không dùng dữ liệu demo. Mọi câu ghi trong test lọc theo ENROLL_IT_ORG.
 * Mỗi ca tự dọn ở đầu; dọn lần cuối khi kết thúc (D17).
 *
 * Chạy: npm run test:integration (isolated PostgreSQL and local HTTP stub)
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from './test-runner';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { TestClient as Client } from './test-io';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  databaseUrl,
  ENROLL_IT_LEARNER_1,
  ENROLL_IT_LEARNER_2,
  ENROLL_IT_ORG,
  ENROLL_IT_PUBLIC_COURSE,
  resetEnrollFixture,
} from './enroll-it-fixture';
import { createRequiredEnrollment } from './enroll-it-required';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to the isolated Learning database.',
  );
}

/** Cây của Course test Public và Lesson của Course test Private trong HTTP fixtures. */
const PUBLIC_MODULE = '0199a000-0000-7000-8000-1a00000000f1';
const PUBLIC_LESSON = '0199a000-0000-7000-8000-1b00000000f1';
const PUBLIC_REQUIRED_VIDEO = '0199a000-0000-7000-8000-1c00000000f1';
const PUBLIC_OPTIONAL_READING = '0199a000-0000-7000-8000-1c00000000f2';
const PRIVATE_LESSON = '0199a000-0000-7000-8000-1b00000000f2';
/** Tổ chức demo chỉ dùng làm header, không ghi gì. */
const ORG_A = '0199a000-0000-7000-8000-0a0000000001';

const learningDb = new Client({ connectionString: databaseUrl() });

let app: NestExpressApplication | null = null;
let baseUrl = '';
let connected = false;

interface ApiResult {
  status: number;
  data: Record<string, unknown>;
  error: { code?: string; message?: string } | undefined;
}

async function get(user: CurrentUser, path: string): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: {
      [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
      [HEADER_NAMES.USER_ID]: user.userId,
      [HEADER_NAMES.USER_ROLE]: user.role,
      [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId!,
    },
  });
  const body = (await response.json()) as {
    data?: Record<string, unknown>;
    error?: ApiResult['error'];
  };
  return { status: response.status, data: body.data ?? {}, error: body.error };
}

const curriculumPath = (enrollmentId: string) =>
  `/enrollments/${enrollmentId}/curriculum`;
const lessonPath = (enrollmentId: string, lessonId: string) =>
  `/enrollments/${enrollmentId}/lessons/${lessonId}`;

async function curriculum(user: CurrentUser, enrollmentId: string) {
  const result = await get(user, curriculumPath(enrollmentId));
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.data as {
    requiredMaterials: { completed: number; total: number };
    modules: {
      moduleId: string;
      isRequired: boolean;
      completed: boolean | null;
      lessons: {
        lessonId: string;
        isRequired: boolean;
        completed: boolean | null;
      }[];
    }[];
  } & Record<string, unknown>;
}

async function lesson(
  user: CurrentUser,
  enrollmentId: string,
  lessonId: string,
) {
  const result = await get(user, lessonPath(enrollmentId, lessonId));
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.data as {
    lesson: Record<string, unknown>;
    materials: Record<string, unknown>[];
    previousLesson: unknown;
    nextLesson: unknown;
  } & Record<string, unknown>;
}

async function expectError(
  user: CurrentUser,
  path: string,
  status: number,
  code: string,
): Promise<void> {
  const result = await get(user, path);
  assert.equal(result.status, status, `${path}: ${JSON.stringify(result)}`);
  assert.equal(result.error?.code, code, path);
}

async function createOptional(learner: CurrentUser): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/enrollments`, {
    method: 'POST',
    headers: {
      [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
      [HEADER_NAMES.USER_ID]: learner.userId,
      [HEADER_NAMES.USER_ROLE]: learner.role,
      [HEADER_NAMES.ORGANIZATION_ID]: learner.organizationId!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ courseId: ENROLL_IT_PUBLIC_COURSE }),
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as { data: { id: string } }).data.id;
}

async function completeRequiredVideo(enrollmentId: string): Promise<void> {
  await learningDb.query(
    `INSERT INTO material_progress (id, organization_id, enrollment_id, material_id, watched_ranges, completed_at)
     VALUES ($1, $2, $3, $4, '{[0,300)}', now())`,
    [randomUUID(), ENROLL_IT_ORG, enrollmentId, PUBLIC_REQUIRED_VIDEO],
  );
}

/** Trạng thái learning_db liên quan, để kiểm GET không ghi gì (BR-307). */
async function learningState(enrollmentId: string) {
  const { rows } = await learningDb.query<Record<string, unknown>>(
    `SELECT e.status, e.first_activity_at::text, e.updated_at::text,
            (SELECT count(*) FROM material_progress p WHERE p.organization_id = $2) AS progress,
            (SELECT count(*) FROM material_snapshots m WHERE m.organization_id = $2) AS materials,
            (SELECT count(*) FROM lesson_snapshots l WHERE l.organization_id = $2) AS lessons,
            (SELECT count(*) FROM course_version_snapshots c WHERE c.organization_id = $2) AS versions,
            (SELECT count(*) FROM enrollments x WHERE x.organization_id = $2) AS enrollments
       FROM enrollments e WHERE e.id = $1 AND e.organization_id = $2`,
    [enrollmentId, ENROLL_IT_ORG],
  );
  return rows[0];
}

void describe('UC27, UC27.1 (thật, fixture ORG_TEST)', () => {
  before(async () => {
    await learningDb.connect();
    connected = true;
    await resetEnrollFixture(learningDb);

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
        await resetEnrollFixture(learningDb);
      }
    } finally {
      await closeAll(() => closeApp(app), () => learningDb.end());
    }
  });

  void test('role khác LEARNER → 403 ở cả hai endpoint', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(ENROLL_IT_LEARNER_1);
    for (const role of ['INSTRUCTOR', 'ORGANIZER', 'ADMIN'] as const) {
      const user = { ...ENROLL_IT_LEARNER_1, role };
      for (const path of [curriculumPath(id), lessonPath(id, PUBLIC_LESSON)]) {
        assert.equal((await get(user, path)).status, 403, `${role} ${path}`);
      }
    }
  });

  void test('Optional trên Course Public: 1 Module, 1 Lesson bắt buộc chưa xong, x/y 0/1; hoàn thành Video bắt buộc → true, 1/1', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(ENROLL_IT_LEARNER_1);

    const before = await curriculum(ENROLL_IT_LEARNER_1, id);
    assert.deepEqual(Object.keys(before).sort(), [
      'course',
      'courseId',
      'dueAt',
      'dueTimezone',
      'enrollmentId',
      'enrollmentType',
      'modules',
      'requiredMaterials',
      'status',
    ]);
    assert.equal(before.enrollmentType, 'Optional');
    assert.equal(before.status, 'NotStarted');
    assert.equal(before.dueAt, null);
    assert.equal(before.dueTimezone, null);
    assert.deepEqual(before.course, {
      name: 'Course kiểm thử tích hợp (không dùng cho demo)',
      versionNumber: 1,
    });
    assert.deepEqual(before.requiredMaterials, { completed: 0, total: 1 });
    assert.deepEqual(before.modules, [
      {
        moduleId: PUBLIC_MODULE,
        title: 'Module kiểm thử',
        position: 1,
        isRequired: true,
        completed: false,
        lessons: [
          {
            lessonId: PUBLIC_LESSON,
            title: 'Lesson kiểm thử',
            position: 1,
            isRequired: true,
            completed: false,
          },
        ],
      },
    ]);

    await completeRequiredVideo(id);
    const after = await curriculum(ENROLL_IT_LEARNER_1, id);
    assert.equal(after.modules[0].completed, true);
    assert.equal(after.modules[0].lessons[0].completed, true);
    assert.deepEqual(after.requiredMaterials, { completed: 1, total: 1 });
  });

  void test('Required: status, dueAt và dueTimezone theo tổ chức', async () => {
    await resetEnrollFixture(learningDb);
    const { id, dueAt } = await createRequiredEnrollment(
      app!,
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
      new Date(),
    );
    const result = await curriculum(ENROLL_IT_LEARNER_1, id);
    assert.equal(result.enrollmentType, 'Required');
    assert.equal(result.status, 'NotStarted');
    assert.equal(result.dueAt, dueAt.toISOString());
    assert.equal(result.dueTimezone, process.env.TENANT_FAKE_TIMEZONE);
  });

  void test('404 ENROLLMENT_NOT_FOUND: Learner khác, tổ chức khác, id ngẫu nhiên, id không phải UUID, Withdrawn', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(ENROLL_IT_LEARNER_1);
    const cases: [CurrentUser, string][] = [
      [ENROLL_IT_LEARNER_2, id],
      [{ ...ENROLL_IT_LEARNER_1, organizationId: ORG_A }, id],
      [ENROLL_IT_LEARNER_1, randomUUID()],
      [ENROLL_IT_LEARNER_1, 'abc'],
    ];
    for (const [user, enrollmentId] of cases) {
      for (const path of [
        curriculumPath(enrollmentId),
        lessonPath(enrollmentId, PUBLIC_LESSON),
      ]) {
        await expectError(user, path, 404, 'ENROLLMENT_NOT_FOUND');
      }
    }

    await learningDb.query(
      `UPDATE enrollments
          SET status = 'Withdrawn', withdrawn_at = now(), withdrawn_reason = 'AccountDeleted'
        WHERE id = $1 AND organization_id = $2`,
      [id, ENROLL_IT_ORG],
    );
    for (const path of [curriculumPath(id), lessonPath(id, PUBLIC_LESSON)]) {
      await expectError(ENROLL_IT_LEARNER_1, path, 404, 'ENROLLMENT_NOT_FOUND');
    }
  });

  void test('Halted → 403 CONTENT_UNAVAILABLE; bản sao phiên bản có disabled_at → 403 với Enrollment không Halted', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(ENROLL_IT_LEARNER_1);
    await learningDb.query(
      `UPDATE enrollments SET status = 'Halted' WHERE id = $1 AND organization_id = $2`,
      [id, ENROLL_IT_ORG],
    );
    for (const path of [curriculumPath(id), lessonPath(id, PUBLIC_LESSON)]) {
      await expectError(ENROLL_IT_LEARNER_1, path, 403, 'CONTENT_UNAVAILABLE');
    }

    await resetEnrollFixture(learningDb);
    const active = await createOptional(ENROLL_IT_LEARNER_1);
    await learningDb.query(
      `UPDATE course_version_snapshots SET disabled_at = now()
        WHERE course_id = $1 AND organization_id = $2`,
      [ENROLL_IT_PUBLIC_COURSE, ENROLL_IT_ORG],
    );
    for (const path of [
      curriculumPath(active),
      lessonPath(active, PUBLIC_LESSON),
    ]) {
      await expectError(ENROLL_IT_LEARNER_1, path, 403, 'CONTENT_UNAVAILABLE');
    }
  });

  void test('học liệu bắt buộc bị vô hiệu hóa trong bản sao → biến khỏi UC27.1, Lesson tính lại, x/y giảm; Lesson bị vô hiệu hóa → UC27 ẩn Lesson và Module, UC27.1 403', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(ENROLL_IT_LEARNER_1);
    await completeRequiredVideo(id);
    assert.deepEqual(
      (await curriculum(ENROLL_IT_LEARNER_1, id)).requiredMaterials,
      { completed: 1, total: 1 },
    );

    await learningDb.query(
      'UPDATE material_snapshots SET disabled_at = now() WHERE material_id = $1 AND organization_id = $2',
      [PUBLIC_REQUIRED_VIDEO, ENROLL_IT_ORG],
    );
    const detail = await lesson(ENROLL_IT_LEARNER_1, id, PUBLIC_LESSON);
    assert.deepEqual(
      detail.materials.map((m) => m.materialId),
      [PUBLIC_OPTIONAL_READING],
    );
    // Chỉ còn Reading không bắt buộc, chưa hoàn thành
    assert.equal(detail.lesson.isRequired, false);
    assert.equal(detail.lesson.completed, false);
    const tree = await curriculum(ENROLL_IT_LEARNER_1, id);
    assert.deepEqual(tree.requiredMaterials, { completed: 0, total: 0 });
    assert.equal(tree.modules[0].lessons[0].isRequired, false);
    assert.equal(tree.modules[0].isRequired, false);

    await learningDb.query(
      `INSERT INTO lesson_snapshots (lesson_id, organization_id, course_id, disabled_at, disabled_as_of)
       VALUES ($1, $2, $3, now(), now())`,
      [PUBLIC_LESSON, ENROLL_IT_ORG, ENROLL_IT_PUBLIC_COURSE],
    );
    assert.deepEqual((await curriculum(ENROLL_IT_LEARNER_1, id)).modules, []);
    await expectError(
      ENROLL_IT_LEARNER_1,
      lessonPath(id, PUBLIC_LESSON),
      403,
      'LESSON_DISABLED',
    );
  });

  void test('UC27.1: Lesson của Course khác hoặc ngẫu nhiên hoặc không phải UUID → 404 LESSON_NOT_FOUND; Lesson hợp lệ trả nội dung, 2 học liệu, không có trước/sau', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(ENROLL_IT_LEARNER_1);
    for (const lessonId of [PRIVATE_LESSON, randomUUID(), 'abc']) {
      await expectError(
        ENROLL_IT_LEARNER_1,
        lessonPath(id, lessonId),
        404,
        'LESSON_NOT_FOUND',
      );
    }

    const detail = await lesson(ENROLL_IT_LEARNER_1, id, PUBLIC_LESSON);
    assert.deepEqual(detail, {
      enrollmentId: id,
      lesson: {
        lessonId: PUBLIC_LESSON,
        title: 'Lesson kiểm thử',
        content: '## Lesson kiểm thử\n\nNội dung cố định cho test tích hợp.',
        isRequired: true,
        completed: false,
      },
      materials: [
        {
          materialId: PUBLIC_REQUIRED_VIDEO,
          title: 'Video kiểm thử (bắt buộc)',
          materialType: 'Video',
          isRequired: true,
          durationSeconds: 300,
          completed: false,
        },
        {
          materialId: PUBLIC_OPTIONAL_READING,
          title: 'Reading kiểm thử (không bắt buộc)',
          materialType: 'Reading',
          isRequired: false,
          durationSeconds: null,
          completed: false,
        },
      ],
      previousLesson: null,
      nextLesson: null,
    });
  });

  void test('BR-307: xem UC27, UC27.1 nhiều lần không đổi Enrollment, tiến độ hay bản sao', async () => {
    await resetEnrollFixture(learningDb);
    const { id } = await createRequiredEnrollment(
      app!,
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
      new Date(),
    );
    const before = await learningState(id);
    for (let i = 0; i < 3; i += 1) {
      await curriculum(ENROLL_IT_LEARNER_1, id);
      await lesson(ENROLL_IT_LEARNER_1, id, PUBLIC_LESSON);
    }
    assert.deepEqual(await learningState(id), before);
    assert.equal(before.status, 'NotStarted');
    assert.equal(before.first_activity_at, null);
  });
});
