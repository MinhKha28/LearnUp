/**
 * UC28.1 (GET /enrollments/:id/assessment-results) on the fixture ORG_TEST: who may read the results, what is asked of
 * assessment-service (the Course of the Enrollment, never one the caller names), the answer when it cannot be asked,
 * and that reading writes nothing. assessment-service itself is replaced by the client of the app, as in the UC28 tests.
 *
 * Run: npm run test:integration (isolated PostgreSQL and local HTTP stub)
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import type { AddressInfo } from 'node:net';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  ASSESSMENT_RESULTS_CLIENT,
  AssessmentResultsUnavailableError,
  type AssessmentResultItem,
  type AssessmentResultsClient,
} from '../../src/infrastructure/clients/assessment/assessment-results.client';
import type { AssessmentResultsView } from '../../src/modules/curriculum/assessment-results.service';
import { randomUUID } from 'node:crypto';
import { closeAll, closeApp } from './deadlines';
import {
  databaseUrl,
  ENROLL_IT_LEARNER_1,
  ENROLL_IT_LEARNER_2,
  ENROLL_IT_ORG,
  ENROLL_IT_PUBLIC_COURSE,
  resetEnrollFixture,
} from './enroll-it-fixture';
import { createRequiredEnrollment } from './enroll-it-required';
import { after, before, describe, test } from './test-runner';
import { TestClient as Client, testFetch as fetch } from './test-io';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. This test writes to the isolated Learning database.',
  );
}

const learningDb = new Client({ connectionString: databaseUrl() });
let app: NestExpressApplication | null = null;
let baseUrl = '';
let connected = false;

const A1 = '0199a000-0000-7000-8000-3a0000000001';
const A2 = '0199a000-0000-7000-8000-3a0000000002';
const A3 = '0199a000-0000-7000-8000-3a0000000003';
const NOW = '2026-11-05T10:00:00.000Z';

const quiz = (
  over: Partial<AssessmentResultItem> = {},
): AssessmentResultItem => ({
  assessmentId: A1,
  kind: 'QUIZ',
  title: 'Quiz an toàn',
  isRequired: true,
  disabled: false,
  passingScore: 70,
  status: 'Completed',
  recordedScore: 85,
  passed: true,
  attemptCount: 1,
  lastActivityAt: NOW,
  quiz: {
    bestAttemptNumber: 1,
    attempts: [
      {
        attemptNumber: 1,
        score: 85,
        submittedAt: NOW,
        submissionKind: 'Manual',
      },
    ],
  },
  assignment: null,
  ...over,
});
const assignment = (
  over: Partial<AssessmentResultItem> = {},
): AssessmentResultItem => ({
  assessmentId: A2,
  kind: 'ASSIGNMENT',
  title: 'Bài luận',
  isRequired: true,
  disabled: false,
  passingScore: 60,
  status: 'AwaitingResult',
  recordedScore: null,
  passed: null,
  attemptCount: 1,
  lastActivityAt: NOW,
  quiz: null,
  assignment: {
    latestSubmissionNumber: 1,
    gradingStatus: 'AwaitingInstructor',
  },
  ...over,
});

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

/** What the database holds about the Enrollment, to see that reading changes nothing (BR-307). */
async function learningState(enrollmentId: string) {
  const { rows } = await learningDb.query<Record<string, unknown>>(
    `SELECT e.status, e.first_activity_at::text, e.updated_at::text,
            (SELECT count(*) FROM material_progress p WHERE p.organization_id = $2) AS progress,
            (SELECT count(*) FROM enrollments x WHERE x.organization_id = $2) AS enrollments,
            (SELECT count(*) FROM completion_evaluation_requests r WHERE r.organization_id = $2) AS evaluations,
            (SELECT count(*) FROM outbox_events o WHERE o.organization_id = $2) AS outbox
       FROM enrollments e WHERE e.id = $1 AND e.organization_id = $2`,
    [enrollmentId, ENROLL_IT_ORG],
  );
  return rows[0];
}

const client = () =>
  app!.get<AssessmentResultsClient>(ASSESSMENT_RESULTS_CLIENT);
const enroll = async () => {
  await resetEnrollFixture(learningDb);
  return (
    await createRequiredEnrollment(
      app!,
      ENROLL_IT_LEARNER_1,
      ENROLL_IT_PUBLIC_COURSE,
      new Date(),
    )
  ).id;
};
const path = (id: string) => `/enrollments/${id}/assessment-results`;

void describe('UC28.1 kết quả Assessment (thật, fixture ORG_TEST)', () => {
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
      if (connected) await resetEnrollFixture(learningDb);
    } finally {
      await closeAll(
        () => closeApp(app),
        () => learningDb.end(),
      );
    }
  });

  void test('trả điểm của Course của Enrollment, kèm tóm tắt so với điểm đạt; hỏi đúng Course, không ghi gì', async () => {
    const id = await enroll();
    const spy = mock.method(
      client(),
      'getResults',
      async (_user: CurrentUser, courseId: string) => ({
        courseId,
        items: [quiz(), assignment()],
      }),
    );
    try {
      const before = await learningState(id);
      const response = await get(ENROLL_IT_LEARNER_1, path(id));
      assert.equal(response.status, 200, JSON.stringify(response));
      const data = response.data as unknown as AssessmentResultsView;
      assert.equal(data.state, 'ok');
      assert.equal(data.enrollment.id, id);
      assert.equal(data.enrollment.courseId, ENROLL_IT_PUBLIC_COURSE);
      assert.deepEqual(data.summary, {
        total: 2,
        passed: 1,
        notPassed: 0,
        pending: 1,
      });
      assert.deepEqual(
        data.items?.map((i) => [
          i.assessmentId,
          i.kind,
          i.recordedScore,
          i.passed,
          i.passingScore,
        ]),
        [
          [A1, 'QUIZ', 85, true, 70],
          [A2, 'ASSIGNMENT', null, null, 60],
        ],
      );
      assert.equal(spy.mock.callCount(), 1);
      const [user, courseId] = spy.mock.calls[0].arguments;
      assert.equal(user.userId, ENROLL_IT_LEARNER_1.userId);
      assert.equal(courseId, ENROLL_IT_PUBLIC_COURSE);
      // reading twice changes nothing
      await get(ENROLL_IT_LEARNER_1, path(id));
      assert.deepEqual(await learningState(id), before);
    } finally {
      spy.mock.restore();
    }
  });

  void test('điểm 0 và chưa đạt được tính là chưa đạt; mục bị vô hiệu hóa không nằm trong tóm tắt', async () => {
    const id = await enroll();
    const spy = mock.method(
      client(),
      'getResults',
      async (_u: CurrentUser, courseId: string) => ({
        courseId,
        items: [
          quiz({ recordedScore: 0, passed: false }),
          assignment({
            assessmentId: A3,
            status: 'Completed',
            recordedScore: 90,
            passed: true,
            disabled: true,
          }),
        ],
      }),
    );
    try {
      const data = (await get(ENROLL_IT_LEARNER_1, path(id)))
        .data as unknown as AssessmentResultsView;
      assert.deepEqual(data.summary, {
        total: 1,
        passed: 0,
        notPassed: 1,
        pending: 0,
      });
      assert.equal(
        data.items?.length,
        2,
        'the disabled one is still shown, with its score',
      );
      assert.equal(data.items?.[1].disabled, true);
    } finally {
      spy.mock.restore();
    }
  });

  void test('Course chưa làm gì: danh sách rỗng, không phải lỗi', async () => {
    const id = await enroll();
    const spy = mock.method(
      client(),
      'getResults',
      async (_u: CurrentUser, courseId: string) => ({ courseId, items: [] }),
    );
    try {
      const response = await get(ENROLL_IT_LEARNER_1, path(id));
      assert.equal(response.status, 200);
      assert.deepEqual(response.data.items, []);
      assert.deepEqual(response.data.summary, {
        total: 0,
        passed: 0,
        notPassed: 0,
        pending: 0,
      });
    } finally {
      spy.mock.restore();
    }
  });

  void test('assessment-service không trả lời được: 200 với state unavailable, không có danh sách, không ghi gì', async () => {
    const id = await enroll();
    for (const reason of [
      'UNREACHABLE',
      'HTTP_ERROR',
      'INVALID_RESPONSE',
    ] as const) {
      const spy = mock.method(client(), 'getResults', async () => {
        throw new AssessmentResultsUnavailableError(reason, 500);
      });
      try {
        const before = await learningState(id);
        const response = await get(ENROLL_IT_LEARNER_1, path(id));
        assert.equal(response.status, 200, reason);
        assert.equal(response.data.state, 'unavailable', reason);
        assert.equal(response.data.items, undefined);
        assert.equal(response.data.summary, undefined);
        assert.deepEqual(await learningState(id), before);
      } finally {
        spy.mock.restore();
      }
    }
  });

  void test('một lỗi không phải của assessment-service không bị che thành "không có dữ liệu" (500)', async () => {
    const id = await enroll();
    const spy = mock.method(client(), 'getResults', async () => {
      throw new Error('bug');
    });
    try {
      assert.equal((await get(ENROLL_IT_LEARNER_1, path(id))).status, 500);
    } finally {
      spy.mock.restore();
    }
  });

  void test('Enrollment của người khác, không có, id sai: 404 như các màn hình khác; assessment-service không bị hỏi', async () => {
    const id = await enroll();
    const spy = mock.method(client(), 'getResults', async () => ({
      courseId: '',
      items: [],
    }));
    try {
      for (const [user, target] of [
        [ENROLL_IT_LEARNER_2, path(id)],
        [ENROLL_IT_LEARNER_1, path(randomUUID())],
        [ENROLL_IT_LEARNER_1, '/enrollments/invalid/assessment-results'],
      ] as const) {
        const response = await get(user, target);
        assert.equal(response.status, 404, target);
        assert.equal(response.error?.code, 'ENROLLMENT_NOT_FOUND', target);
      }
      assert.equal(spy.mock.callCount(), 0);
    } finally {
      spy.mock.restore();
    }
  });

  void test('chỉ Learner xem được (403 cho vai trò khác); Withdrawn là 404, Halted là 403', async () => {
    const id = await enroll();
    const spy = mock.method(
      client(),
      'getResults',
      async (_u: CurrentUser, courseId: string) => ({ courseId, items: [] }),
    );
    try {
      for (const role of ['INSTRUCTOR', 'ORGANIZER', 'ADMIN'] as const) {
        assert.equal(
          (await get({ ...ENROLL_IT_LEARNER_1, role }, path(id))).status,
          403,
          role,
        );
      }
      for (const [status, http, code] of [
        ['Halted', 403, 'CONTENT_UNAVAILABLE'],
        ['Withdrawn', 404, 'ENROLLMENT_NOT_FOUND'],
      ] as const) {
        await learningDb.query(
          `UPDATE enrollments SET status=$1,withdrawn_at=CASE WHEN $1='Withdrawn' THEN now() ELSE NULL END,withdrawn_reason=CASE WHEN $1='Withdrawn' THEN 'HaltedClosed' ELSE NULL END WHERE id=$2 AND organization_id=$3`,
          [status, id, ENROLL_IT_ORG],
        );
        const response = await get(ENROLL_IT_LEARNER_1, path(id));
        assert.equal(response.status, http, status);
        assert.equal(response.error?.code, code, status);
      }
      assert.equal(spy.mock.callCount(), 0);
    } finally {
      spy.mock.restore();
    }
  });

  void test('Enrollment đã Completed vẫn xem được kết quả (lịch sử)', async () => {
    const id = await enroll();
    await learningDb.query(
      `UPDATE enrollments SET status='Completed',completed_at=now(),completed_late=false WHERE id=$1 AND organization_id=$2`,
      [id, ENROLL_IT_ORG],
    );
    const spy = mock.method(
      client(),
      'getResults',
      async (_u: CurrentUser, courseId: string) => ({
        courseId,
        items: [quiz()],
      }),
    );
    try {
      const before = await learningState(id);
      const response = await get(ENROLL_IT_LEARNER_1, path(id));
      assert.equal(response.status, 200);
      assert.equal(
        (response.data.enrollment as { status: string }).status,
        'Completed',
      );
      assert.equal(response.data.state, 'ok');
      assert.equal(spy.mock.callCount(), 1);
      assert.deepEqual(await learningState(id), before);
    } finally {
      spy.mock.restore();
    }
  });
});
