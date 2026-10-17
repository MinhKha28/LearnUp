/**
 * Test tích hợp demo:reset (D47): tạo Enrollment Course 03 của LEARNER_1 bằng UC25.3 thật, ghi thêm
 * một dòng tiến độ, rồi reset hai lần liên tiếp. Enrollment của Course khác (E-demo-1, E-demo-2) phải còn nguyên.
 *
 * Chạy: npm run test:integration (cần course-service chạy tại COURSE_SERVICE_URL, cả hai DB đã seed)
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { HEADER_NAMES } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import {
  DEMO_RESET_COURSE,
  DEMO_RESET_LEARNERS,
  resetDemoSelfEnrollments,
} from '../../prisma/demo-reset';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { databaseUrl } from './enroll-it-fixture';
import { seedWithdrawalDemo } from '../../prisma/seed-withdrawal-demo';
import {
  WITHDRAWAL_DEMO_LEARNER,
  WITHDRAWAL_DEMO_PLANS,
} from '../../prisma/withdrawal-demo-fixture';
import {
  ASSESSMENT_CLIENT,
  type AssessmentClient,
} from '../../src/infrastructure/clients/assessment/assessment.client';
import { createAssessmentClient } from '../../src/infrastructure/clients/assessment/create-assessment-client';

const [LEARNER_1, ORG_A] = DEMO_RESET_LEARNERS[0];

const learningDb = new Client({ connectionString: databaseUrl('learning_db') });
let app: NestExpressApplication | null = null;
let baseUrl = '';
let connected = false;

/** Enrollment không thuộc Course 03: demo:reset không được chạm tới. */
async function otherEnrollments(): Promise<string[]> {
  const { rows } = await learningDb.query<{ id: string }>(
    'SELECT id::text FROM enrollments WHERE course_id <> $1::uuid ORDER BY id',
    [DEMO_RESET_COURSE],
  );
  return rows.map((row) => row.id);
}

async function course03EnrollmentsOfDemoLearners(): Promise<number> {
  const { rows } = await learningDb.query<{ n: string }>(
    `SELECT count(*) AS n FROM enrollments
      WHERE course_id = $1::uuid AND (learner_id, organization_id) IN (
        SELECT * FROM unnest($2::uuid[], $3::uuid[]))`,
    [
      DEMO_RESET_COURSE,
      DEMO_RESET_LEARNERS.map(([learnerId]) => learnerId),
      DEMO_RESET_LEARNERS.map(([, organizationId]) => organizationId),
    ],
  );
  return Number(rows[0].n);
}

before(async () => {
  await learningDb.connect();
  connected = true;
  await resetDemoSelfEnrollments(learningDb);

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
      await resetDemoSelfEnrollments(learningDb);
    }
  } finally {
    await app?.close();
    await learningDb.end().catch(() => undefined);
  }
});

void describe('D47 demo:reset (thật)', () => {
  void test('Học viên 4: seed idempotent, DELETED, WITHDRAWN, restored x/y unchanged, reset preserves other learners', async () => {
    const before = await otherEnrollments();
    const client = app!.get<AssessmentClient>(ASSESSMENT_CLIENT);
    const previous = client.getActivity;
    client.getActivity = createAssessmentClient(
      (key) =>
        ({
          ASSESSMENT_CLIENT_MODE: 'fake',
          ASSESSMENT_FAKE_RESULT_COURSE_IDS: WITHDRAWAL_DEMO_PLANS[1].courseId,
        })[key],
    ).getActivity;
    const headers = {
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
      'x-user-id': WITHDRAWAL_DEMO_LEARNER,
      'x-user-role': 'LEARNER',
      'x-organization-id': ORG_A,
      'content-type': 'application/json',
    };
    const call = async (path: string, body?: unknown) => {
      const response = await fetch(`${baseUrl}/api/v1/${path}`, {
        method: 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        body: (await response.json()) as {
          data: { id: string; outcome: string; restored: boolean };
        },
      };
    };
    const mine = async () => {
      const response = await fetch(`${baseUrl}/api/v1/enrollments/me`, {
        headers,
      });
      assert.equal(response.status, 200);
      return (
        (await response.json()) as {
          data: {
            items: {
              enrollmentId: string;
              requiredMaterials: { completed: number; total: number };
            }[];
          };
        }
      ).data.items;
    };
    try {
      await seedWithdrawalDemo(app!);
      await seedWithdrawalDemo(app!);
      const initial = await mine();
      assert.equal(initial.length, 2);
      assert.ok(
        initial.every(
          (row) =>
            row.requiredMaterials.completed === 1 &&
            row.requiredMaterials.total > 0,
        ),
      );
      const [deleted, withdrawn] = WITHDRAWAL_DEMO_PLANS;
      assert.equal(
        (await call(`enrollments/${deleted.enrollmentId}/withdrawal`)).body.data
          .outcome,
        'DELETED',
      );
      assert.equal(
        (await call(`enrollments/${withdrawn.enrollmentId}/withdrawal`)).body
          .data.outcome,
        'WITHDRAWN',
      );
      const restored = await call('enrollments', {
        courseId: withdrawn.courseId,
      });
      assert.equal(restored.status, 201);
      assert.equal(restored.body.data.restored, true);
      assert.equal(restored.body.data.id, withdrawn.enrollmentId);
      const after = await mine();
      assert.equal(after.length, 1);
      assert.deepEqual(
        after[0].requiredMaterials,
        initial.find((row) => row.enrollmentId === withdrawn.enrollmentId)!
          .requiredMaterials,
      );
      const reset = await resetDemoSelfEnrollments(learningDb);
      assert.deepEqual(reset, {
        enrollments: 1,
        materialProgress: 1,
        statusIntervals: 0,
      });
      assert.deepEqual(await otherEnrollments(), before);
      await seedWithdrawalDemo(app!);
      assert.deepEqual(await resetDemoSelfEnrollments(learningDb), {
        enrollments: 2,
        materialProgress: 2,
        statusIntervals: 0,
      });
    } finally {
      client.getActivity = previous;
      await resetDemoSelfEnrollments(learningDb);
    }
  });
  void test('xóa Enrollment Course 03 của Learner demo kèm tiến độ; chạy lại không lỗi; Course khác còn nguyên', async () => {
    const before = await otherEnrollments();

    const response = await fetch(`${baseUrl}/api/v1/enrollments`, {
      method: 'POST',
      headers: {
        [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
        [HEADER_NAMES.USER_ID]: LEARNER_1,
        [HEADER_NAMES.USER_ROLE]: 'LEARNER',
        [HEADER_NAMES.ORGANIZATION_ID]: ORG_A,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ courseId: DEMO_RESET_COURSE }),
    });
    const body = (await response.json()) as { data: { id: string } };
    assert.equal(response.status, 201, JSON.stringify(body));

    const { rows: materials } = await learningDb.query<{ material_id: string }>(
      `SELECT material_id::text FROM material_snapshots
        WHERE course_id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [DEMO_RESET_COURSE, ORG_A],
    );
    assert.equal(materials.length, 1, 'Course 03 phải có bản sao học liệu');
    await learningDb.query(
      `INSERT INTO material_progress (id, organization_id, enrollment_id, material_id, completed_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())`,
      [randomUUID(), ORG_A, body.data.id, materials[0].material_id],
    );
    assert.equal(await course03EnrollmentsOfDemoLearners(), 1);

    assert.deepEqual(await resetDemoSelfEnrollments(learningDb), {
      materialProgress: 1,
      statusIntervals: 0,
      enrollments: 1,
    });
    assert.deepEqual(await resetDemoSelfEnrollments(learningDb), {
      materialProgress: 0,
      statusIntervals: 0,
      enrollments: 0,
    });

    assert.equal(await course03EnrollmentsOfDemoLearners(), 0);
    const { rows: snapshot } = await learningDb.query<{ n: string }>(
      'SELECT count(*) AS n FROM course_version_snapshots WHERE course_id = $1::uuid',
      [DEMO_RESET_COURSE],
    );
    assert.equal(Number(snapshot[0].n), 1, 'không xóa bản sao Course 03');
    assert.deepEqual(await otherEnrollments(), before);
  });
});
