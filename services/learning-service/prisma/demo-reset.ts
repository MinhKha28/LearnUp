/**
 * Trả dữ liệu demo UC25.3 về trạng thái đầu (D47). CHỈ DÙNG CHO DEV.
 *
 * Chạy: npm run demo:reset (lệnh demo inter1-demo.mjs gọi sau seed:demo).
 * Xóa Enrollment tự đăng ký của LEARNER_1, LEARNER_2 (ORG_A) và LEARNER_3 (ORG_B) trên Course 03,
 * kèm material_progress và enrollment_status_intervals của chúng, trong một transaction.
 * Mọi câu lệnh lọc learner_id, course_id và organization_id. Không xóa bản sao Course 03,
 * không chạm course_db, không gỡ Locked của Course 03.
 */
import 'dotenv/config';
import { Client } from 'pg';

export const DEMO_RESET_COURSE = '0199a000-0000-7000-8000-0e0000000003';

/** Cặp (learner_id, organization_id) của ba Learner demo. */
export const DEMO_RESET_LEARNERS: readonly [string, string][] = [
  [
    '0199a000-0000-7000-8000-0b0000000001',
    '0199a000-0000-7000-8000-0a0000000001',
  ],
  [
    '0199a000-0000-7000-8000-0b0000000002',
    '0199a000-0000-7000-8000-0a0000000001',
  ],
  [
    '0199a000-0000-7000-8000-0b0000000003',
    '0199a000-0000-7000-8000-0a0000000002',
  ],
];

export interface DemoResetResult {
  materialProgress: number;
  statusIntervals: number;
  enrollments: number;
}

/** Enrollment cần xóa: đúng Course 03 và đúng một trong ba cặp Learner–tổ chức. */
const TARGET_FILTER = `e.course_id = $1::uuid
   AND (e.learner_id, e.organization_id) IN (
     SELECT * FROM unnest($2::uuid[], $3::uuid[]))`;

export async function resetDemoSelfEnrollments(
  client: Client,
): Promise<DemoResetResult> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to reset: NODE_ENV=production. Demo data is for development only.',
    );
  }
  const params = [
    DEMO_RESET_COURSE,
    DEMO_RESET_LEARNERS.map(([learnerId]) => learnerId),
    DEMO_RESET_LEARNERS.map(([, organizationId]) => organizationId),
  ];
  await client.query('BEGIN');
  try {
    const progress = await client.query(
      `DELETE FROM material_progress p USING enrollments e
        WHERE p.enrollment_id = e.id AND p.organization_id = e.organization_id
          AND ${TARGET_FILTER}`,
      params,
    );
    const intervals = await client.query(
      `DELETE FROM enrollment_status_intervals i USING enrollments e
        WHERE i.enrollment_id = e.id AND i.organization_id = e.organization_id
          AND ${TARGET_FILTER}`,
      params,
    );
    const enrollments = await client.query(
      `DELETE FROM enrollments e WHERE ${TARGET_FILTER}`,
      params,
    );
    await client.query('COMMIT');
    return {
      materialProgress: progress.rowCount ?? 0,
      statusIntervals: intervals.rowCount ?? 0,
      enrollments: enrollments.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Bỏ ?schema=… của Prisma; pg không hiểu tham số này. */
function learningDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('Thiếu DATABASE_URL trong .env của learning-service.');
  }
  const url = new URL(raw);
  url.search = '';
  return url.toString();
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: learningDatabaseUrl() });
  await client.connect();
  try {
    const result = await resetDemoSelfEnrollments(client);
    console.log(
      `demo:reset Course 03: xóa ${result.enrollments} Enrollment, ` +
        `${result.materialProgress} material_progress, ${result.statusIntervals} enrollment_status_intervals.`,
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Refusing to reset: NODE_ENV=production. Demo data is for development only.',
    );
    process.exit(1);
  }
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
