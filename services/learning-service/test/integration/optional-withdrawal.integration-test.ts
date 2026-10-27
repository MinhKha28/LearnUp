import { closeAll, closeApp } from './deadlines';
import { courseStub } from './course-stub';
import { deadline, BARRIER_TIMEOUT_MS } from './deadlines';
import { testFetch as fetch } from './test-io';
import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from './test-runner';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { TestClient as Client } from './test-io';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  ASSESSMENT_CLIENT,
  type AssessmentClient,
} from '../../src/infrastructure/clients/assessment/assessment.client';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import {
  withdrawalLockSql,
  deleteOptionalEnrollmentSql,
  withdrawOptionalEnrollmentSql,
  restoreOptionalEnrollmentSql,
  type OptionalEnrollmentRow,
} from '../../src/modules/enrollments/optional-enrollment.repository';
import {
  databaseUrl,
  ENROLL_IT_ORG as ORG,
  ENROLL_IT_PUBLIC_COURSE as COURSE,
  ENROLL_IT_LEARNER_1 as USER,
  ENROLL_IT_ORGANIZER as ORGANIZER,
  resetEnrollFixture,
} from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing withdrawal tests in production.');
const db = new Client({ connectionString: databaseUrl() });
let app: NestExpressApplication;
let baseUrl: string;
let assessment: AssessmentClient;
let hasResult = false;
let assessmentError = false;
let assessmentHook: (() => Promise<void>) | null = null;
let connected = false;

async function call(path: string, body?: unknown, user = USER) {
  const response = await fetch(`${baseUrl}/api/v1/${path}`, {
    method: 'POST',
    headers: {
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
      'x-user-id': user.userId,
      'x-user-role': user.role,
      'x-organization-id': user.organizationId!,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      data: Record<string, any>;
      error?: Record<string, any>;
    },
  };
}
const enroll = () => call('enrollments', { courseId: COURSE });
const withdraw = (id: string, user = USER) =>
  call(`enrollments/${id}/withdrawal`, undefined, user);
async function clear() {
  await db.query('DELETE FROM outbox_events WHERE organization_id=$1', [ORG]);
  await resetEnrollFixture(db);
}
async function prepare(status = 'InProgress') {
  const result = await enroll();
  assert.equal(result.status, 201, JSON.stringify(result));
  assert.equal(result.body.data.restored, false);
  const id = result.body.data.id as string;
  const { rows: materials } = await db.query(
    'SELECT material_id FROM material_snapshots WHERE organization_id=$1 AND course_id=$2 LIMIT 1',
    [ORG, COURSE],
  );
  assert.ok(materials[0]);
  await db.query(
    "UPDATE enrollments SET status=$3, first_activity_at=CASE WHEN $3='NotStarted' THEN NULL ELSE now() END, completed_at=CASE WHEN $3='Completed' THEN now() ELSE NULL END WHERE id=$1 AND organization_id=$2",
    [id, ORG, status],
  );
  await db.query(
    'INSERT INTO material_progress (id,organization_id,enrollment_id,material_id,completed_at) VALUES ($1,$2,$3,$4,now())',
    [randomUUID(), ORG, id, materials[0].material_id],
  );
  await db.query(
    "INSERT INTO enrollment_status_intervals (id,organization_id,enrollment_id,kind,started_at,ended_at) VALUES ($1,$2,$3,'Halted',now(),now())",
    [randomUUID(), ORG, id],
  );
  return id;
}
async function state(id: string) {
  return (
    await db.query(
      'SELECT * FROM enrollments WHERE id=$1 AND organization_id=$2',
      [id, ORG],
    )
  ).rows[0];
}
async function counts(id: string) {
  return (
    await db.query(
      `SELECT
    (SELECT count(*)::int FROM material_progress WHERE enrollment_id=$1 AND organization_id=$2) AS progress,
    (SELECT count(*)::int FROM enrollment_status_intervals WHERE enrollment_id=$1 AND organization_id=$2) AS intervals,
    (SELECT count(*)::int FROM outbox_events WHERE aggregate_id=$1 AND organization_id=$2 AND event_type='LearnerWithdrew') AS events`,
      [id, ORG],
    )
  ).rows[0];
}

void describe('UC25.4 real database withdrawal and restoration', () => {
  before(async () => {
    await db.connect();
    connected = true;
    const previousLimit = process.env.ENROLLMENT_RATE_LIMIT_PER_MINUTE;
    process.env.ENROLLMENT_RATE_LIMIT_PER_MINUTE = '1000';
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    if (previousLimit === undefined)
      delete process.env.ENROLLMENT_RATE_LIMIT_PER_MINUTE;
    else process.env.ENROLLMENT_RATE_LIMIT_PER_MINUTE = previousLimit;
    configureApp(app);
    assessment = app.get<AssessmentClient>(ASSESSMENT_CLIENT);
    assessment.getActivity = async () => {
      await assessmentHook?.();
      if (assessmentError) throw new Error('assessment timeout');
      return {
        hasQuizAttempt: hasResult,
        hasSubmission: false,
        hasPeerReviewGiven: false,
      };
    };
    const tenant = app.get<TenantClient>(TENANT_CLIENT);
    tenant.lookupLearners = async (_user, ids) =>
      ids.map((userId) => ({
        userId,
        role: 'Learner',
        status: 'Active',
        deletedAt: null,
        activatedAt: null,
        fullName: 'Fixture',
        email: 'fixture@example.test',
      }));
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await clear();
    hasResult = false;
    assessmentError = false;
    assessmentHook = null;
  });
  after(async () => {
    try {
      if (connected) await clear();
    } finally {
      await closeAll(
        () => closeApp(app),
        () => db.end(),
      );
    }
  });

  test('DELETED cascades progress/intervals, keeps Locked/snapshot, reenrollment creates new id', async () => {
    const id = await prepare();
    const callsBeforeWithdrawal = structuredClone(courseStub.calls);
    assert.deepEqual(await withdraw(id), {
      status: 200,
      body: { statusCode: 200, message: '', data: { outcome: 'DELETED' } },
    });
    assert.equal(await state(id), undefined);
    assert.deepEqual(await counts(id), {
      progress: 0,
      intervals: 0,
      events: 0,
    });
    assert.deepEqual(
      courseStub.calls,
      callsBeforeWithdrawal,
      'withdrawal must not call Course or unlock it',
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM course_version_snapshots WHERE course_id=$1 AND organization_id=$2',
          [COURSE, ORG],
        )
      ).rows[0].n,
      1,
    );
    const again = await enroll();
    assert.equal(again.status, 201);
    assert.equal(again.body.data.restored, false);
    assert.notEqual(again.body.data.id, id);
  });
  for (const original of ['NotStarted', 'InProgress', 'Halted'])
    test(`WITHDRAWN ${original}: outbox and same id/progress/video threshold restored`, async () => {
      const id = await prepare(original);
      hasResult = true;
      const before = await state(id);
      assert.equal((await withdraw(id)).body.data.outcome, 'WITHDRAWN');
      const withdrawn = await state(id);
      assert.equal(withdrawn.status, 'Withdrawn');
      assert.equal(withdrawn.withdrawn_reason, 'LearnerWithdrew');
      assert.ok(withdrawn.withdrawn_at);
      const event = (
        await db.query(
          "SELECT * FROM outbox_events WHERE organization_id=$1 AND aggregate_id=$2 AND event_type='LearnerWithdrew'",
          [ORG, id],
        )
      ).rows[0];
      assert.equal(event.aggregate_type, 'Enrollment');
      assert.deepEqual(event.payload, {
        enrollmentId: id,
        organizationId: ORG,
        learnerId: USER.userId,
        courseId: COURSE,
        withdrawnAt: withdrawn.withdrawn_at.toISOString(),
      });
      const restored = await enroll();
      assert.equal(restored.status, 201);
      assert.equal(restored.body.data.restored, true);
      assert.equal(restored.body.data.id, id);
      const after = await state(id);
      assert.equal(
        after.status,
        original === 'NotStarted' ? 'NotStarted' : 'InProgress',
      );
      assert.equal(after.withdrawn_at, null);
      assert.equal(after.withdrawn_reason, null);
      assert.equal(
        after.video_completion_percent,
        before.video_completion_percent,
      );
      assert.equal(after.enrollment_type, 'Optional');
      assert.deepEqual(await counts(id), {
        progress: 1,
        intervals: 1,
        events: 1,
      });
      assert.equal((await withdraw(id)).status, 200);
    });
  test('Required, Completed, other learner/org, missing, withdrawn and role checks', async () => {
    const id = await prepare('Completed');
    const completed = await withdraw(id);
    assert.equal(completed.status, 409);
    assert.equal(completed.body.error?.reason, 'COMPLETED');
    assert.equal(completed.body.error?.code, 'ENROLLMENT_NOT_WITHDRAWABLE');
    await db.query(
      "UPDATE enrollments SET enrollment_type='Required', assigned_at=now(), expected_completion_days=1, base_due_at=now(), due_at=now(), completed_late=false WHERE id=$1 AND organization_id=$2",
      [id, ORG],
    );
    const required = await withdraw(id);
    assert.equal(required.status, 409);
    assert.equal(required.body.error?.reason, 'REQUIRED');
    for (const user of [
      { ...USER, userId: randomUUID() },
      { ...USER, organizationId: randomUUID() },
    ]) {
      const result = await withdraw(id, user);
      assert.equal(result.status, 404);
      assert.equal(result.body.error?.code, 'ENROLLMENT_NOT_FOUND');
    }
    assert.equal(
      (await withdraw(id, { ...USER, role: 'ORGANIZER' })).status,
      403,
    );
    assert.equal((await withdraw(randomUUID())).status, 404);
    await db.query(
      "UPDATE enrollments SET status='Withdrawn',completed_at=NULL,completed_late=NULL,withdrawn_at=now(),withdrawn_reason='LearnerWithdrew' WHERE id=$1 AND organization_id=$2",
      [id, ORG],
    );
    assert.equal((await withdraw(id)).status, 404);
  });
  for (const reason of ['AccountDeleted', 'HaltedClosed'])
    test(`D82 rejects ${reason}`, async () => {
      const id = await prepare();
      await db.query(
        "UPDATE enrollments SET status='Withdrawn',withdrawn_at=now(),withdrawn_reason=$3 WHERE id=$1 AND organization_id=$2",
        [id, ORG, reason],
      );
      const result = await enroll();
      assert.equal(result.status, 409);
      assert.equal(result.body.error?.code, 'ENROLLMENT_NOT_RESTORABLE');
      assert.equal(result.body.error?.reason, reason);
      assert.equal((await state(id)).status, 'Withdrawn');
    });
  test('assessment error returns 503 and leaves enrollment, progress, intervals and outbox unchanged', async () => {
    const id = await prepare();
    const before = await state(id);
    assessmentError = true;
    const result = await withdraw(id);
    assert.equal(result.status, 503);
    assert.equal(result.body.error?.code, 'ASSESSMENT_UNAVAILABLE');
    assert.deepEqual(await state(id), before);
    assert.deepEqual(await counts(id), {
      progress: 1,
      intervals: 1,
      events: 0,
    });
  });
  test('two restorations serialize: one restored, one ALREADY_ENROLLED', async () => {
    const id = await prepare();
    hasResult = true;
    await withdraw(id);
    const results = await Promise.all([enroll(), enroll()]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      results.find((r) => r.status === 201)!.body.data.restored,
      true,
    );
    assert.equal(
      results.find((r) => r.status === 409)!.body.error?.code,
      'ALREADY_ENROLLED',
    );
    assert.deepEqual(await counts(id), {
      progress: 1,
      intervals: 1,
      events: 1,
    });
  });
  test('UC24.2 CONVERT while assessment is pending: recheck REQUIRED and preserve progress', async () => {
    const id = await prepare();
    let entered!: () => void;
    let release!: () => void;
    const waiting = deadline(
      new Promise<void>((resolve) => {
        entered = resolve;
      }),
      'optional-withdrawal.integration-test: waiting',
      BARRIER_TIMEOUT_MS,
    );
    const gate = deadline(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
      'optional-withdrawal.integration-test: gate',
      BARRIER_TIMEOUT_MS,
    );
    assessmentHook = async () => {
      entered();
      await gate;
    };
    const withdrawing = withdraw(id);
    await waiting;
    try {
      const assigned = await call(
        'assignments',
        { courseId: COURSE, learnerIds: [USER.userId] },
        ORGANIZER,
      );
      assert.equal(assigned.status, 201, JSON.stringify(assigned));
      assert.equal(assigned.body.data.converted, 1);
    } finally {
      release();
    }
    const result = await withdrawing;
    assert.equal(result.status, 409);
    assert.equal(result.body.error?.reason, 'REQUIRED');
    assert.equal((await state(id)).enrollment_type, 'Required');
    assert.deepEqual(await counts(id), {
      progress: 1,
      intervals: 1,
      events: 0,
    });
  });
  test('EXPLAIN ANALYZE BUFFERS: 50,000 enrollments with progress and status intervals', async () => {
    const id = await prepare();
    const material = (
      await db.query(
        'SELECT material_id FROM material_progress WHERE organization_id=$1 AND enrollment_id=$2',
        [ORG, id],
      )
    ).rows[0].material_id;
    await db.query(
      `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent,first_activity_at)
      SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Optional','InProgress',80,now() FROM generate_series(1,50000)`,
      [ORG, COURSE],
    );
    await db.query('ANALYZE enrollments');
    await db.query(
      'INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,completed_at) SELECT gen_random_uuid(),organization_id,id,$2,now() FROM enrollments WHERE organization_id=$1 AND id<>$3',
      [ORG, material, id],
    );
    await db.query(
      "INSERT INTO enrollment_status_intervals(id,organization_id,enrollment_id,kind,started_at,ended_at) SELECT gen_random_uuid(),organization_id,id,'Halted',now(),now() FROM enrollments WHERE organization_id=$1 AND id<>$2",
      [ORG, id],
    );
    await db.query('ANALYZE enrollments');
    await db.query('ANALYZE material_progress');
    await db.query('ANALYZE enrollment_status_intervals');
    const row: OptionalEnrollmentRow = {
      id,
      learnerId: USER.userId,
      organizationId: ORG,
      courseId: COURSE,
      enrollmentType: 'Optional',
      status: 'InProgress',
      withdrawnReason: null,
    };
    const probes = [
      ['lock', withdrawalLockSql(id, USER.userId, ORG)],
      ['delete-cascade', deleteOptionalEnrollmentSql(row)],
      ['withdraw', withdrawOptionalEnrollmentSql(row)],
      ['restore', restoreOptionalEnrollmentSql(row)],
    ] as const;
    await db.query("LOAD 'auto_explain'");
    await db.query(
      "SET auto_explain.log_min_duration=0; SET auto_explain.log_analyze=on; SET auto_explain.log_buffers=on; SET auto_explain.log_nested_statements=on; SET auto_explain.log_format='json'; SET auto_explain.log_level='notice'",
    );
    const nested: any[] = [];
    const listener = (notice: { message?: string }) => {
      const message = notice.message ?? '';
      const start = message.indexOf('{');
      if (start >= 0) {
        try {
          nested.push(JSON.parse(message.slice(start)));
        } catch {}
      }
    };
    db.on('notice', listener);
    const scans = (node: any): string[] => [
      ...(String(node['Node Type']).includes('Scan')
        ? [
            `${node['Node Type']}:${node['Relation Name'] ?? node['Index Name']}`,
          ]
        : []),
      ...(node.Plans ?? []).flatMap(scans),
    ];
    try {
      for (const [name, query] of probes) {
        await db.query('BEGIN');
        try {
          if (name === 'restore')
            await db.query(
              "UPDATE enrollments SET status='Withdrawn',withdrawn_at=now(),withdrawn_reason='LearnerWithdrew' WHERE id=$1 AND organization_id=$2",
              [id, ORG],
            );
          const plan = (
            await db.query(
              `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`,
              query.values,
            )
          ).rows[0]['QUERY PLAN'][0];
          console.log(
            `UC25.4 EXPLAIN ${name} scans=${scans(plan.Plan).join(',')} execution_ms=${plan['Execution Time']} plan=${JSON.stringify(plan)}`,
          );
          assert.ok(
            !scans(plan.Plan).some((scan) => scan.startsWith('Seq Scan:')),
            `${name}: Seq Scan on business table`,
          );
        } finally {
          await db.query('ROLLBACK');
        }
      }
      for (const [name, sql, values] of [
        [
          'find-owned',
          'SELECT * FROM enrollments WHERE id=$1 AND learner_id=$2 AND organization_id=$3 LIMIT 1',
          [id, USER.userId, ORG],
        ],
        [
          'find-registration',
          'SELECT * FROM enrollments WHERE learner_id=$1 AND course_id=$2 AND organization_id=$3 LIMIT 1',
          [USER.userId, COURSE, ORG],
        ],
      ] as const) {
        const plan = (
          await db.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, [
            ...values,
          ])
        ).rows[0]['QUERY PLAN'][0];
        console.log(
          `UC25.4 EXPLAIN ${name} scans=${scans(plan.Plan).join(',')} execution_ms=${plan['Execution Time']} plan=${JSON.stringify(plan)}`,
        );
        assert.ok(
          !scans(plan.Plan).some((scan) => scan.startsWith('Seq Scan:')),
        );
      }
      const childPlans = nested.filter((p) =>
        /DELETE FROM ONLY.*(material_progress|enrollment_status_intervals)/i.test(
          p['Query Text'] ?? '',
        ),
      );
      assert.ok(childPlans.length >= 2, 'Missing actual nested CASCADE plans');
      for (const plan of childPlans) {
        console.log(`UC25.4 CASCADE ${JSON.stringify(plan)}`);
        assert.ok(
          !scans(plan.Plan).some((scan) => scan.startsWith('Seq Scan:')),
          'CASCADE child Seq Scan: CẦN QUYẾT ĐỊNH',
        );
      }
    } finally {
      db.off('notice', listener);
      await db.query('SET auto_explain.log_min_duration=-1');
    }
  });
});
