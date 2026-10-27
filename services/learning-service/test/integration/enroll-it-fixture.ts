import { courseStub } from './course-stub';
/**
 * Fixture của test tích hợp đăng ký Course (D34): ORG_TEST và hai Course test do HTTP fixtures tạo.
 * Test chỉ ghi và dọn dữ liệu của các Course này trong ORG_TEST, không đụng dữ liệu demo.
 */
import type { CurrentUser } from '@learnup/ts-common';
import type { Client } from 'pg';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. Integration fixtures write to the isolated test database.',
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

/** Keep raw pg and Prisma on the exact same disposable target. */
export function databaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !/^learning_it_[a-f0-9]{32}$/.test(
      process.env.LEARNING_IT_DATABASE ?? '',
    ) ||
    url.pathname !== `/${process.env.LEARNING_IT_DATABASE}`
  ) {
    throw new Error(
      'Use npm run test:integration; refusing a non-isolated database',
    );
  }
  url.searchParams.delete('schema');
  return url.toString();
}

/**
 * Xóa mọi dòng learning_db của Course test trong ORG_TEST (theo thứ tự khóa ngoại)
 * và các lần tạm khóa của ORG_TEST.
 */
export async function resetEnrollFixture(learningDb: Client): Promise<void> {
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
  courseStub.reset();
}
