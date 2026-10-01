/**
 * Test tích hợp CourseServiceClient với course-service thật đang chạy và dữ liệu seed.
 * Ca I1 (D17) ghi vào course_db: đọc locked_at trước khi gọi và luôn trả về đúng giá trị cũ.
 *
 * Chạy: npm run test:integration (cần course-service chạy tại COURSE_SERVICE_URL, đã db:seed)
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { Client } from 'pg';
import { CourseServiceClient } from '../../src/integrations/course-service/course-service.client';
import { readCourseServiceConfig } from '../../src/integrations/course-service/course-service.config';
import { CourseNotAvailableError } from '../../src/integrations/course-service/course-service.errors';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to course_db.',
  );
}

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const COURSE_AN_TOAN_V2 = '0199a000-0000-7000-8000-0e0000000002';
const COURSE_BAO_MAT = '0199a000-0000-7000-8000-0e0000000003';
const COURSE_NHAP_MON_ORG_B = '0199a000-0000-7000-8000-0e0000000006';
const LESSON_AN_TOAN_1 = '0199a000-0000-7000-8000-1b0000000011';

const LEARNER_1: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: ORG_A,
  role: 'LEARNER',
  isAuthenticated: true,
};

const client = new CourseServiceClient(
  readCourseServiceConfig((key) => process.env[key]),
);

/** course_db cùng máy chủ với learning_db; ghi đè bằng COURSE_DATABASE_URL nếu khác. */
function courseDatabaseUrl(): string {
  if (process.env.COURSE_DATABASE_URL) {
    return process.env.COURSE_DATABASE_URL;
  }
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/course_db';
  url.search = '';
  return url.toString();
}

const courseDb = new Client({ connectionString: courseDatabaseUrl() });
let courseDbConnected = false;

after(async () => {
  if (courseDbConnected) {
    await courseDb.end();
  }
});

void describe('CourseServiceClient với course-service thật (seed)', () => {
  void test('I2: cây 0e…02 đúng 2 module, thứ tự position, Video có durationSeconds', async () => {
    const tree = await client.getCourseTree(LEARNER_1, COURSE_AN_TOAN_V2);
    assert.equal(tree.courseId, COURSE_AN_TOAN_V2);
    assert.ok(tree.asOf instanceof Date);
    assert.deepEqual(
      tree.modules.map((m) => m.position),
      [1, 2],
    );
    const materials = tree.modules.flatMap((m) =>
      m.lessons.flatMap((l) => l.materials),
    );
    assert.equal(materials.length, 9);
    for (const material of materials) {
      if (material.materialType === 'Video') {
        assert.ok(Number.isInteger(material.durationSeconds));
      } else {
        assert.equal(material.durationSeconds, null);
      }
    }
  });

  void test('I2: Course của tổ chức khác → CourseNotAvailableError', async () => {
    await assert.rejects(
      client.getCourseTree(LEARNER_1, COURSE_NHAP_MON_ORG_B),
      (error: unknown) => {
        assert.ok(error instanceof CourseNotAvailableError);
        assert.equal(error.code, 'COURSE_NOT_FOUND');
        return true;
      },
    );
  });

  void test('I3: batch 0e…02 + 0e…03 trả đủ 2 Course theo thứ tự gửi', async () => {
    const items = await client.getCoursesBatch(LEARNER_1, [
      COURSE_AN_TOAN_V2,
      COURSE_BAO_MAT,
    ]);
    assert.deepEqual(
      items.map((item) => [item.courseId, item.name]),
      [
        [COURSE_AN_TOAN_V2, 'An toàn lao động'],
        [COURSE_BAO_MAT, 'Bảo mật thông tin'],
      ],
    );
  });

  void test('I4: một Lesson của 0e…02 có nội dung Markdown', async () => {
    const lesson = await client.getLesson(
      LEARNER_1,
      COURSE_AN_TOAN_V2,
      LESSON_AN_TOAN_1,
    );
    assert.equal(lesson.lessonId, LESSON_AN_TOAN_1);
    assert.equal(lesson.courseId, COURSE_AN_TOAN_V2);
    assert.match(lesson.content, /^## /);
    assert.equal(lesson.disabledAt, null);
  });

  void test('I1 (D17): gắn Locked 0e…03 với selfEnroll, gọi lại idempotent, rồi trả locked_at về đúng giá trị cũ', async () => {
    await courseDb.connect();
    courseDbConnected = true;

    // Đọc dạng text để giữ nguyên micro giây khi trả lại
    const readState = async () =>
      (
        await courseDb.query<{
          locked_at: string | null;
          updated_at: string;
          chain_id: string;
        }>(
          'SELECT locked_at::text, updated_at::text, chain_id::text FROM courses WHERE id = $1',
          [COURSE_BAO_MAT],
        )
      ).rows[0];

    const before = await readState();
    console.log(`locked_at của 0e…03 trước khi gọi I1: ${before.locked_at}`);

    try {
      const first = await client.lockCourse(LEARNER_1, COURSE_BAO_MAT, true);
      assert.equal(first.courseId, COURSE_BAO_MAT);
      assert.equal(first.organizationId, ORG_A);
      assert.equal(first.chainId, before.chain_id);
      assert.equal(first.expectedCompletionDays, 7);
      assert.equal(first.courseType, 'Public');
      assert.ok(first.lockedAt instanceof Date);

      const second = await client.lockCourse(LEARNER_1, COURSE_BAO_MAT, true);
      assert.equal(second.lockedAt.getTime(), first.lockedAt.getTime());
    } finally {
      await courseDb.query(
        'UPDATE courses SET locked_at = $1::timestamptz, updated_at = $2::timestamptz WHERE id = $3',
        [before.locked_at, before.updated_at, COURSE_BAO_MAT],
      );
      const restored = await readState();
      console.log(`locked_at của 0e…03 sau khi trả lại: ${restored.locked_at}`);
      assert.deepEqual(restored, before);
    }
  });
});
