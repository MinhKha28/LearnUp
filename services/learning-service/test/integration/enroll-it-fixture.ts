/**
 * Fixture của test tích hợp đăng ký Course (D34): ORG_TEST và hai Course test do seed course_db tạo.
 * Test chỉ ghi và dọn dữ liệu của các Course này trong ORG_TEST, không đụng dữ liệu demo.
 */
import type { CurrentUser } from '@learnup/ts-common';
import type { Client } from 'pg';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. Integration fixtures write to learning_db and course_db.',
  );
}

export const ENROLL_IT_ORG = '0199a000-0000-7000-8000-0a00000000f2';
export const ENROLL_IT_PUBLIC_COURSE = '0199a000-0000-7000-8000-0e00000000f1';
export const ENROLL_IT_PRIVATE_COURSE = '0199a000-0000-7000-8000-0e00000000f2';
export const ENROLL_IT_COURSES = [
  ENROLL_IT_PUBLIC_COURSE,
  ENROLL_IT_PRIVATE_COURSE,
];

const learner = (userId: string): CurrentUser => ({
  userId,
  organizationId: ENROLL_IT_ORG,
  role: 'LEARNER',
  isAuthenticated: true,
});
export const ENROLL_IT_LEARNER_1 = learner(
  '0199a000-0000-7000-8000-0b00000000f1',
);
export const ENROLL_IT_LEARNER_2 = learner(
  '0199a000-0000-7000-8000-0b00000000f2',
);
/** Organizer của ORG_TEST: danh tính gọi I1 (selfEnroll: false) và I2 khi tạo Required như phân công. */
export const ENROLL_IT_ORGANIZER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0f00000000f1',
  organizationId: ENROLL_IT_ORG,
  role: 'ORGANIZER',
  isAuthenticated: true,
};

/** Bỏ ?schema=… của Prisma; pg không hiểu tham số này. */
export function databaseUrl(name: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${name}`;
  url.search = '';
  return url.toString();
}

/** course_db cùng máy chủ với learning_db; ghi đè bằng COURSE_DATABASE_URL nếu khác. */
export function courseDatabaseUrl(): string {
  return process.env.COURSE_DATABASE_URL ?? databaseUrl('course_db');
}

/** Dừng nếu Course test không có hoặc không thuộc ORG_TEST: khi đó không được xóa gì. */
export async function assertFixtureOwnership(courseDb: Client): Promise<void> {
  const { rows } = await courseDb.query<{
    id: string;
    organization_id: string;
  }>(
    'SELECT id::text, organization_id::text FROM courses WHERE id = ANY($1::uuid[])',
    [ENROLL_IT_COURSES],
  );
  for (const courseId of ENROLL_IT_COURSES) {
    const row = rows.find((r) => r.id === courseId);
    if (!row) {
      throw new Error(
        `course_db chưa có Course test ${courseId}; chạy npm run db:seed của course-service. Không dọn gì.`,
      );
    }
    if (row.organization_id !== ENROLL_IT_ORG) {
      throw new Error(
        `Course test ${courseId} thuộc tổ chức ${row.organization_id}, không phải ORG_TEST ${ENROLL_IT_ORG}. Không dọn gì.`,
      );
    }
  }
}

/** Đưa Course test về chưa Locked; updated_at giữ nguyên. */
export async function unlockFixtureCourses(courseDb: Client): Promise<void> {
  await assertFixtureOwnership(courseDb);
  await courseDb.query(
    'UPDATE courses SET locked_at = NULL WHERE id = ANY($1::uuid[]) AND organization_id = $2',
    [ENROLL_IT_COURSES, ENROLL_IT_ORG],
  );
}

/**
 * Xóa mọi dòng learning_db của Course test trong ORG_TEST (theo thứ tự khóa ngoại)
 * và các lần tạm khóa của ORG_TEST, rồi gỡ Locked trong course_db.
 */
export async function resetEnrollFixture(
  learningDb: Client,
  courseDb: Client,
): Promise<void> {
  await assertFixtureOwnership(courseDb);
  const params = [ENROLL_IT_COURSES, ENROLL_IT_ORG];
  for (const table of ['material_progress', 'enrollment_status_intervals']) {
    await learningDb.query(
      `DELETE FROM ${table} t USING enrollments e
        WHERE t.enrollment_id = e.id AND t.organization_id = $2
          AND e.course_id = ANY($1::uuid[]) AND e.organization_id = $2`,
      params,
    );
  }
  for (const table of [
    'enrollments',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ]) {
    await learningDb.query(
      `DELETE FROM ${table} WHERE course_id = ANY($1::uuid[]) AND organization_id = $2`,
      params,
    );
  }
  await learningDb.query(
    'DELETE FROM organization_suspensions WHERE organization_id = $1',
    [ENROLL_IT_ORG],
  );
  await unlockFixtureCourses(courseDb);
}
