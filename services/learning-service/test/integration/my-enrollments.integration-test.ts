import { closeAll, closeApp } from './deadlines';
import { testFetch as fetch } from './test-io';
/**
 * Test tích hợp UC26 (GET /enrollments/me) trên fixture ORG_TEST (D34), không dùng dữ liệu demo.
 * Optional tạo qua POST /enrollments; Required tạo như phân công bằng createRequiredEnrollment.
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
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { EnrollmentsRepository } from '../../src/modules/enrollments/enrollments.repository';
import {
  databaseUrl,
  ENROLL_IT_LEARNER_1,
  ENROLL_IT_LEARNER_2,
  ENROLL_IT_ORG,
  ENROLL_IT_PRIVATE_COURSE,
  ENROLL_IT_PUBLIC_COURSE,
  resetEnrollFixture,
} from './enroll-it-fixture';
import { createRequiredEnrollment } from './enroll-it-required';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to the isolated Learning database.',
  );
}

/** Học liệu và Lesson của Course test Public trong HTTP fixtures. */
const PUBLIC_REQUIRED_VIDEO = '0199a000-0000-7000-8000-1c00000000f1';
const PUBLIC_LESSON = '0199a000-0000-7000-8000-1b00000000f1';
/** Tổ chức demo chỉ dùng làm header, không ghi gì. */
const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const DAY_MS = 24 * 60 * 60 * 1000;

const learningDb = new Client({ connectionString: databaseUrl() });

let app: NestExpressApplication | null = null;
let baseUrl = '';
let connected = false;

interface MyItem {
  enrollmentId: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  dueAt: string | null;
  dueTimezone: string | null;
  requiredMaterials: { completed: number; total: number };
  course: Record<string, unknown> | null;
}
interface MyPage {
  meta: { current: number; pageSize: number; pages: number; total: number };
  items: MyItem[];
  dueTimezone: string | null;
}

async function request(
  user: CurrentUser,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: { data?: unknown; error?: unknown } }> {
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
    body: (await response.json()) as { data?: unknown; error?: unknown },
  };
}

async function myPage(user: CurrentUser, query = ''): Promise<MyPage> {
  const result = await request(user, 'GET', `/enrollments/me${query}`);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.data as MyPage;
}

async function createOptional(
  learner: CurrentUser,
  courseId: string,
): Promise<string> {
  const result = await request(learner, 'POST', '/enrollments', { courseId });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return (result.body.data as { id: string }).id;
}

const createRequired = (
  learner: CurrentUser,
  courseId: string,
  assignedAt: Date,
) => createRequiredEnrollment(app!, learner, courseId, assignedAt);

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

void describe('UC26 GET /enrollments/me (thật, fixture ORG_TEST)', () => {
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
      await closeAll(
        () => closeApp(app),
        () => learningDb.end(),
      );
    }
  });

  void test('role khác LEARNER → 403', async () => {
    for (const role of ['INSTRUCTOR', 'ORGANIZER', 'ADMIN'] as const) {
      const result = await request(
        { ...ENROLL_IT_LEARNER_1, role },
        'GET',
        '/enrollments/me',
      );
      assert.equal(result.status, 403, role);
    }
  });

  void test('Learner chưa có Enrollment → items rỗng, total 0, dueTimezone null', async () => {
    await resetEnrollFixture(learningDb);
    assert.deepEqual(await myPage(ENROLL_IT_LEARNER_1), {
      meta: { current: 1, pageSize: 20, pages: 0, total: 0 },
      items: [],
    });
  });

  void test('Withdrawn không hiện', async () => {
    await resetEnrollFixture(learningDb);
    const id = await createOptional(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
    );
    assert.equal((await myPage(ENROLL_IT_LEARNER_1)).meta.total, 1);

    await learningDb.query(
      `UPDATE enrollments
          SET status = 'Withdrawn', withdrawn_at = now(), withdrawn_reason = 'LearnerWithdrew'
        WHERE id = $1 AND organization_id = $2`,
      [id, ENROLL_IT_ORG],
    );
    const page = await myPage(ENROLL_IT_LEARNER_1);
    assert.deepEqual(page.items, []);
    assert.equal(page.meta.total, 0);
  });

  void test('Required quá hạn → Overdue; tạm khóa đang mở bắt đầu trước due_at → không Overdue; đóng tạm khóa → Overdue lại', async () => {
    await resetEnrollFixture(learningDb);
    const { id, dueAt } = await createRequired(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
      daysAgo(10),
    );
    const statusNow = async () => {
      const page = await myPage(ENROLL_IT_LEARNER_1);
      assert.equal(page.items[0].enrollmentId, id);
      return page;
    };

    const overdue = await statusNow();
    assert.equal(overdue.items[0].status, 'Overdue');
    assert.equal(overdue.items[0].dueAt, dueAt.toISOString());
    assert.equal(
      overdue.items[0].dueTimezone,
      process.env.TENANT_FAKE_TIMEZONE,
    );

    const suspensionId = randomUUID();
    await learningDb.query(
      `INSERT INTO organization_suspensions (id, organization_id, started_at)
       VALUES ($1, $2, $3::timestamptz - interval '1 day')`,
      [suspensionId, ENROLL_IT_ORG, dueAt],
    );
    assert.equal((await statusNow()).items[0].status, 'NotStarted');

    await learningDb.query(
      'UPDATE organization_suspensions SET ended_at = now() WHERE id = $1 AND organization_id = $2',
      [suspensionId, ENROLL_IT_ORG],
    );
    assert.equal((await statusNow()).items[0].status, 'Overdue');
  });

  void test('thứ tự D22: hai Required theo due_at tăng dần; Required chưa xong đứng trước Optional', async () => {
    await resetEnrollFixture(learningDb);
    // Tạo Required hạn sớm trước: id nhỏ hơn, nên chỉ đứng đầu nếu xếp theo due_at
    const earlier = await createRequired(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
      daysAgo(10),
    );
    const later = await createRequired(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PRIVATE_COURSE,
      new Date(),
    );
    assert.ok(earlier.dueAt < later.dueAt);
    assert.deepEqual(
      (await myPage(ENROLL_IT_LEARNER_1)).items.map((i) => i.enrollmentId),
      [earlier.id, later.id],
    );

    await resetEnrollFixture(learningDb);
    const required = await createRequired(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PRIVATE_COURSE,
      daysAgo(1),
    );
    // Optional đăng ký sau: mốc nhóm 2 mới hơn nhưng vẫn phải đứng sau Required
    const optional = await createOptional(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
    );
    const items = (await myPage(ENROLL_IT_LEARNER_1)).items;
    assert.deepEqual(
      items.map((i) => [i.enrollmentId, i.enrollmentType]),
      [
        [required.id, 'Required'],
        [optional, 'Optional'],
      ],
    );
  });

  void test('phân trang ổn định: repository limit 1 qua từng trang không lặp, không sót; page vượt int64 → 200 rỗng, total đúng', async () => {
    await resetEnrollFixture(learningDb);
    await createRequired(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PRIVATE_COURSE,
      new Date(),
    );
    await createOptional(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE);

    const repository = app!.get(EnrollmentsRepository);
    const learnerId = ENROLL_IT_LEARNER_1.userId;
    const all = await repository.findMinePage(learnerId, ENROLL_IT_ORG, 10, 0);
    assert.equal(all.length, 2);
    const paged: string[] = [];
    for (let offset = 0; offset < 3; offset += 1) {
      const rows = await repository.findMinePage(
        learnerId,
        ENROLL_IT_ORG,
        1,
        offset,
      );
      assert.ok(rows.length <= 1);
      paged.push(...rows.map((r) => r.id));
    }
    assert.deepEqual(
      paged,
      all.map((r) => r.id),
    );
    assert.equal(new Set(paged).size, paged.length);

    for (const page of ['1e20', '99999999999999999999999']) {
      const result = await myPage(ENROLL_IT_LEARNER_1, `?page=${page}`);
      assert.deepEqual(result.items, [], page);
      assert.equal(result.meta.total, 2, page);
    }
    const ignoredSize = await myPage(ENROLL_IT_LEARNER_1, '?size=1&foo=bar');
    assert.equal(ignoredSize.items.length, 2);
    assert.equal(ignoredSize.meta.pageSize, 20);
    for (const page of ['0', '-1', 'abc', '1.5']) {
      const result = await request(
        ENROLL_IT_LEARNER_1,
        'GET',
        `/enrollments/me?page=${page}`,
      );
      assert.equal(result.status, 400, page);
    }
  });

  void test('x/y: chỉ đếm học liệu bắt buộc còn hoạt động; hoàn thành → x tăng; vô hiệu hóa học liệu hoặc Lesson → y giảm', async () => {
    await resetEnrollFixture(learningDb);
    const enrollmentId = await createOptional(
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
    );
    const counts = async () =>
      (await myPage(ENROLL_IT_LEARNER_1)).items[0].requiredMaterials;

    // Course test có 1 Video bắt buộc và 1 Reading không bắt buộc
    assert.deepEqual(await counts(), { completed: 0, total: 1 });

    await learningDb.query(
      `INSERT INTO material_progress (id, organization_id, enrollment_id, material_id, watched_ranges, completed_at)
       VALUES ($1, $2, $3, $4, '{[0,300)}', now())`,
      [randomUUID(), ENROLL_IT_ORG, enrollmentId, PUBLIC_REQUIRED_VIDEO],
    );
    assert.deepEqual(await counts(), { completed: 1, total: 1 });

    await learningDb.query(
      'UPDATE material_snapshots SET disabled_at = now() WHERE material_id = $1 AND organization_id = $2',
      [PUBLIC_REQUIRED_VIDEO, ENROLL_IT_ORG],
    );
    assert.deepEqual(await counts(), { completed: 0, total: 0 });

    await learningDb.query(
      'UPDATE material_snapshots SET disabled_at = NULL WHERE material_id = $1 AND organization_id = $2',
      [PUBLIC_REQUIRED_VIDEO, ENROLL_IT_ORG],
    );
    assert.deepEqual(await counts(), { completed: 1, total: 1 });

    await learningDb.query(
      `INSERT INTO lesson_snapshots (lesson_id, organization_id, course_id, disabled_at, disabled_as_of)
       VALUES ($1, $2, $3, now(), now())`,
      [PUBLIC_LESSON, ENROLL_IT_ORG, ENROLL_IT_PUBLIC_COURSE],
    );
    assert.deepEqual(await counts(), { completed: 0, total: 0 });
  });

  void test('Rejects malformed or repeated filters at the HTTP boundary', async () => {
    for (const query of [
      'q=a&q=b',
      'type=Required&type=Required',
      'status=Halted&status=Completed',
      'type=required',
      'status=Withdrawn',
      `q=${'a'.repeat(201)}`,
    ]) {
      const result = await request(
        ENROLL_IT_LEARNER_1,
        'GET',
        `/enrollments/me?${query}`,
      );
      assert.equal(result.status, 400, query);
      assert.equal(
        (result.body.error as { code: string }).code,
        'VALIDATION_ERROR',
      );
    }
  });

  void test('Filters all displayed statuses exclusively in PostgreSQL', async (t) => {
    const learner = { ...ENROLL_IT_LEARNER_1, organizationId: randomUUID() };
    t.mock.method(
      app!.get(CourseServiceClient),
      'getCoursesBatch',
      async () => [],
    );
    const statuses = [
      'NotStarted',
      'InProgress',
      'Completed',
      'Overdue',
      'Exempted',
      'Halted',
      'Withdrawn',
    ];
    const expected = new Map<string, string[]>();
    for (const status of [...statuses, 'OverdueNotStarted']) {
      const courseId = randomUUID();
      const id = randomUUID();
      await learningDb.query(
        `INSERT INTO course_version_snapshots (course_id, organization_id, chain_id, tree_fetched_at, disabled_as_of)
         VALUES ($1, $2, $1, now(), now())`,
        [courseId, learner.organizationId],
      );
      await learningDb.query(
        `INSERT INTO enrollments (
           id, organization_id, learner_id, course_id, enrollment_type, status,
           assigned_at, expected_completion_days, due_at, base_due_at, due_timezone,
           first_activity_at, completed_at, withdrawn_at, withdrawn_reason, video_completion_percent
         ) VALUES (
           $1, $2, $3, $4,
           CASE WHEN $5 IN ('Exempted', 'Overdue', 'OverdueNotStarted') THEN 'Required' ELSE 'Optional' END,
           CASE $5 WHEN 'Overdue' THEN 'InProgress' WHEN 'OverdueNotStarted' THEN 'NotStarted' ELSE $5 END,
           CASE WHEN $5 IN ('Exempted', 'Overdue', 'OverdueNotStarted') THEN now() - interval '20 days' END,
           CASE WHEN $5 IN ('Exempted', 'Overdue', 'OverdueNotStarted') THEN 10 END,
           CASE WHEN $5 IN ('Exempted', 'Overdue', 'OverdueNotStarted') THEN now() - interval '10 days' END,
           CASE WHEN $5 IN ('Exempted', 'Overdue', 'OverdueNotStarted') THEN now() - interval '10 days' END,
           CASE WHEN $5 IN ('Exempted', 'Overdue', 'OverdueNotStarted') THEN 'Asia/Ho_Chi_Minh' END,
           CASE WHEN $5 IN ('InProgress', 'Overdue') THEN now() END,
           CASE WHEN $5 = 'Completed' THEN now() END,
           CASE WHEN $5 = 'Withdrawn' THEN now() END,
           CASE WHEN $5 = 'Withdrawn' THEN 'LearnerWithdrew' END,
           90
         )`,
        [id, learner.organizationId, learner.userId, courseId, status],
      );
      if (status === 'OverdueNotStarted') expected.get('Overdue')!.push(id);
      else expected.set(status, [id]);
    }
    for (const status of statuses.filter((status) => status !== 'Withdrawn')) {
      const result = await myPage(learner, `?status=${status}`);
      const ids = expected.get(status)!;
      assert.equal(result.meta.total, ids.length, status);
      assert.deepEqual(
        result.items.map((item) => item.enrollmentId).sort(),
        ids.sort(),
        status,
      );
      assert.ok(result.items.every((item) => item.status === status));
    }
    const all = await myPage(learner);
    assert.equal(all.meta.total, 7);
    assert.ok(all.items.every((item) => item.status !== 'Withdrawn'));
    await learningDb.query(
      `INSERT INTO organization_suspensions (id, organization_id, started_at)
       VALUES ($1, $2, now() - interval '30 days')`,
      [randomUUID(), learner.organizationId],
    );
    assert.equal((await myPage(learner, '?status=Overdue')).meta.total, 0);
    assert.equal(
      (await myPage(learner, '?status=InProgress&type=Required')).meta.total,
      1,
    );
    assert.equal(
      (await myPage(learner, '?status=NotStarted&type=Required')).meta.total,
      1,
    );
  });

  void test('Keyword pages cover tied rows once and combine with type and status', async (t) => {
    const learner = { ...ENROLL_IT_LEARNER_1, organizationId: randomUUID() };
    const learnerId = learner.userId;
    const ids = Array.from({ length: 25 }, () => randomUUID())
      .sort()
      .reverse();
    const courseIds = ids.map(() => randomUUID());
    await learningDb.query(
      `INSERT INTO course_version_snapshots (course_id, organization_id, chain_id, tree_fetched_at, disabled_as_of)
       SELECT course_id, $1, course_id, now(), now() FROM unnest($2::uuid[]) AS course_id`,
      [learner.organizationId, courseIds],
    );
    await learningDb.query(
      `INSERT INTO enrollments (id, organization_id, learner_id, course_id, enrollment_type,
                                status, enrolled_at, first_activity_at, video_completion_percent)
       SELECT id, $1, $2, course_id, 'Optional',
              CASE WHEN position <= 23 THEN 'NotStarted' ELSE 'InProgress' END, now(),
              CASE WHEN position > 23 THEN now() END, 90
       FROM unnest($3::uuid[], $4::uuid[]) WITH ORDINALITY AS rows(id, course_id, position)`,
      [learner.organizationId, learnerId, ids, courseIds],
    );
    t.mock.method(
      app!.get(CourseServiceClient),
      'getCoursesBatch',
      async (_: CurrentUser, batch: string[]) =>
        batch.map((courseId) => ({
          courseId,
          versionNumber: 1,
          coverFileId: null,
          name: courseId === courseIds[22] ? 'Khóa học khác' : 'Lập Trình',
        })),
    );
    const query = '?q=lap%20trinh&type=Optional&status=NotStarted';
    const first = await myPage(learner, `${query}&page=1`);
    const second = await myPage(learner, `${query}&page=2`);
    assert.equal(first.meta.total, 22);
    assert.equal(second.meta.total, 22);
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 2);
    assert.deepEqual(
      [...first.items, ...second.items].map((item) => item.enrollmentId),
      ids.slice(0, 22),
    );
    assert.equal(
      (await myPage(learner, '?q=lap%20trinh&type=Required&status=NotStarted'))
        .meta.total,
      0,
    );
  });

  void test('Learner khác và tổ chức khác không thấy Enrollment của nhau', async () => {
    await resetEnrollFixture(learningDb);
    await createOptional(ENROLL_IT_LEARNER_1, ENROLL_IT_PUBLIC_COURSE);

    assert.equal((await myPage(ENROLL_IT_LEARNER_1)).meta.total, 1);
    assert.equal((await myPage(ENROLL_IT_LEARNER_2)).meta.total, 0);
    const sameUserOtherOrg = { ...ENROLL_IT_LEARNER_1, organizationId: ORG_A };
    assert.deepEqual((await myPage(sameUserOtherOrg)).items, []);
  });
});
