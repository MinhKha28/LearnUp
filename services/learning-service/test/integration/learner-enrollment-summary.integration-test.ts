import { closeAll, closeApp } from './deadlines';
import { testFetch as fetch } from './test-io';
import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from './test-runner';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { TestClient as Client } from './test-io';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { learnerEnrollmentSummarySql } from '../../src/modules/enrollments/learner-enrollment-summary.repository';
import { databaseUrl } from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing UC13 tests in production.');
const ORG = '0199a000-0013-7000-8000-0a00000000f1';
const OTHER = '0199a000-0013-7000-8000-0a00000000f2';
const SUSPENSION_ORGS = [
  ORG,
  ...Array.from(
    { length: 999 },
    (_, i) =>
      `0199a000-0013-7000-8000-aa${(i + 1).toString(16).padStart(10, '0')}`,
  ),
];
const LEARNER = randomUUID();
const db = new Client({ connectionString: databaseUrl() });
let app: NestExpressApplication;
let url: string;
let connected = false;

async function cleanup() {
  for (const table of [
    'enrollments',
    'course_version_snapshots',
    'organization_suspensions',
  ]) {
    await db.query(
      `DELETE FROM ${table} WHERE organization_id = ANY($1::uuid[])`,
      [
        table === 'organization_suspensions'
          ? [...SUSPENSION_ORGS, OTHER]
          : [ORG, OTHER],
      ],
    );
  }
}

async function enrollment(
  status: string,
  type = 'Required',
  overdue = true,
  org = ORG,
) {
  const course = randomUUID();
  await db.query(
    `INSERT INTO course_version_snapshots
    (course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES ($1,$2,$1,now(),now())`,
    [course, org],
  );
  const required = type === 'Required';
  const due = new Date(Date.now() + (overdue ? -86400000 : 86400000));
  await db.query(
    `INSERT INTO enrollments
    (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,expected_completion_days,
     base_due_at,due_at,video_completion_percent,first_activity_at,completed_at,completed_late,withdrawn_at,withdrawn_reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,80,$10,$11,$12,$13,$14)`,
    [
      randomUUID(),
      org,
      LEARNER,
      course,
      type,
      status,
      required ? new Date() : null,
      required ? 1 : null,
      required ? due : null,
      status === 'InProgress' ? new Date() : null,
      status === 'Completed' ? new Date() : null,
      status === 'Completed' && required ? false : null,
      status === 'Withdrawn' ? new Date() : null,
      status === 'Withdrawn' ? 'LearnerWithdrew' : null,
    ],
  );
}

async function request(learnerIds: string[], key = true) {
  return fetch(`${url}/api/v1/internal/enrollments/summary-by-learners`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': LEARNER,
      'x-user-role': 'ORGANIZER',
      'x-organization-id': ORG,
      ...(key ? { 'x-internal-key': process.env.INTERNAL_SERVICE_KEY! } : {}),
    },
    body: JSON.stringify({ learnerIds }),
  });
}

describe('UC13 learner enrollment summary', () => {
  before(async () => {
    await db.connect();
    connected = true;
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(cleanup);
  after(async () => {
    try {
      if (connected) await cleanup();
    } finally {
      await closeAll(() => closeApp(app), () => db.end());
    }
  });

  test('counts each status and Optional, excludes another organization, returns zero for missing learner', async () => {
    for (const status of [
      'NotStarted',
      'InProgress',
      'Completed',
      'Exempted',
      'Halted',
      'Withdrawn',
    ]) {
      await enrollment(status);
      if (status !== 'Exempted') await enrollment(status, 'Optional');
    }
    await enrollment('NotStarted', 'Required', false);
    await enrollment('InProgress', 'Required', false);
    await enrollment('NotStarted', 'Required', true, OTHER);
    const missing = randomUUID();
    const response = await request([LEARNER, missing]);
    assert.equal(response.status, 200);
    const body = (await response.json()) as any;
    assert.equal(body.statusCode, 200);
    assert.equal(typeof body.message, 'string');
    assert.deepEqual(body.data, {
      summaries: {
        [LEARNER]: { activeCourseCount: 6, overdueCourseCount: 2 },
        [missing]: { activeCourseCount: 0, overdueCourseCount: 0 },
      },
    });
  });

  test('open organization suspension before due date suppresses Overdue only', async () => {
    await enrollment('NotStarted');
    await db.query(
      `INSERT INTO organization_suspensions (id,organization_id,started_at)
      VALUES ($1,$2,now()-interval '2 days')`,
      [randomUUID(), ORG],
    );
    const body = (await (await request([LEARNER])).json()) as any;
    assert.deepEqual(body.data.summaries[LEARNER], {
      activeCourseCount: 1,
      overdueCourseCount: 0,
    });
  });

  test('missing internal key is rejected', async () => {
    assert.equal((await request([LEARNER], false)).status, 401);
  });

  test('preserves an uppercase UUID key in the response', async () => {
    await enrollment('NotStarted');
    const requested = LEARNER.toUpperCase();
    const response = await request([requested]);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        summaries: Record<
          string,
          { activeCourseCount: number; overdueCourseCount: number }
        >;
      };
    };
    assert.deepEqual(body.data.summaries, {
      [requested]: { activeCourseCount: 1, overdueCourseCount: 1 },
    });
  });

  test('EXPLAIN with 100 learnerIds on 50,000 enrollments', async () => {
    await db.query(
      `INSERT INTO organization_suspensions (id, organization_id, started_at, ended_at)
       SELECT gen_random_uuid(), org, now() - (10 - g) * interval '1 day',
         CASE WHEN g < 5 THEN now() - (10 - g) * interval '1 day' + interval '1 hour' END
       FROM unnest($1::uuid[]) AS org CROSS JOIN generate_series(1,5) AS g`,
      [SUSPENSION_ORGS],
    );
    const suspensionCounts = (
      await db.query(
        'SELECT count(*)::integer AS rows, count(DISTINCT organization_id)::integer AS organizations FROM organization_suspensions WHERE organization_id = ANY($1::uuid[])',
        [SUSPENSION_ORGS],
      )
    ).rows[0];
    assert.deepEqual(suspensionCounts, { rows: 5000, organizations: 1000 });
    const course = randomUUID();
    await db.query(
      `INSERT INTO course_version_snapshots
      (course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES ($1,$2,$1,now(),now())`,
      [course, ORG],
    );
    await db.query(
      `INSERT INTO enrollments
      (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,expected_completion_days,
       base_due_at,due_at,video_completion_percent)
      SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Required','NotStarted',now(),1,
        now()-interval '1 day',now()-interval '1 day',80 FROM generate_series(1,50000)`,
      [ORG, course],
    );
    await db.query('ANALYZE enrollments');
    await db.query('ANALYZE organization_suspensions');
    const ids = (
      await db.query(
        'SELECT learner_id FROM enrollments WHERE organization_id=$1 LIMIT 100',
        [ORG],
      )
    ).rows.map((r) => r.learner_id as string);
    const sql = learnerEnrollmentSummarySql(ORG, ids);
    const plan = (
      await db.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql.text}`,
        sql.values,
      )
    ).rows[0]['QUERY PLAN'][0];
    console.log(`UC13 EXPLAIN ${JSON.stringify(plan)}`);
    const nodes: any[] = [];
    const visit = (node: any) => {
      nodes.push(node);
      for (const child of node.Plans ?? []) visit(child);
    };
    visit(plan.Plan);
    console.log(
      `UC13 EXPLAIN summary ${JSON.stringify({
        executionMs: plan['Execution Time'],
        scans: nodes
          .filter((n) => n['Relation Name'] || n['Index Name'])
          .map((n) => ({
            type: n['Node Type'],
            table: n['Relation Name'],
            index: n['Index Name'],
            loops: n['Actual Loops'],
          })),
      })}`,
    );
    assert.equal(
      nodes.some(
        (n) =>
          n['Node Type'] === 'Seq Scan' && n['Relation Name'] === 'enrollments',
      ),
      false,
      'CẦN QUYẾT ĐỊNH: Seq Scan on enrollments',
    );
    assert.equal(
      nodes.some(
        (n) =>
          n['Node Type'] === 'Seq Scan' &&
          n['Relation Name'] === 'organization_suspensions',
      ),
      false,
      'CẦN QUYẾT ĐỊNH: Seq Scan on organization_suspensions',
    );
  });
});
