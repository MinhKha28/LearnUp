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
import { databaseUrl } from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing L17 tests in production.');
const ORG = '0199a000-0017-7000-8000-0a00000000f1';
const OTHER = '0199a000-0017-7000-8000-0a00000000f2';
const LEARNER = randomUUID();
const db = new Client({ connectionString: databaseUrl() });
let app: NestExpressApplication;
let url: string;
let connected = false;

async function cleanup() {
  for (const table of ['enrollments', 'course_version_snapshots']) {
    await db.query(
      `DELETE FROM ${table} WHERE organization_id = ANY($1::uuid[])`,
      [[ORG, OTHER]],
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
     base_due_at,due_at,video_completion_percent,first_activity_at,completed_at,completed_late,withdrawn_at,withdrawn_reason,due_timezone)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,80,$10,$11,$12,$13,$14,CASE WHEN ($9)::timestamptz IS NULL THEN NULL ELSE 'Asia/Ho_Chi_Minh' END )`,
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
  return course;
}

async function request(query: string, overrides: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    'x-user-id': LEARNER,
    'x-user-role': 'ORGANIZER',
    'x-organization-id': ORG,
    'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
    ...overrides,
  };
  for (const key of Object.keys(headers))
    if (headers[key] === '') delete headers[key];
  return fetch(
    `${url}/api/v1/internal/enrollments/assessment-access?${query}`,
    { headers },
  );
}
describe('L17 assessment access HTTP / PostgreSQL', () => {
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
  for (const [status, access] of Object.entries({
    NotStarted: 'Full',
    InProgress: 'Full',
    Exempted: 'Full',
    Completed: 'ReadOnly',
    Halted: 'None',
    Withdrawn: 'None',
  })) {
    test(`${status} maps to ${access}, including past due dates`, async () => {
      const course = await enrollment(status);
      const response = await request(`learnerId=${LEARNER}&courseId=${course}`);
      assert.equal(response.status, 200);
      const body: any = await response.json();
      const row = (
        await db.query(
          'SELECT id FROM enrollments WHERE learner_id=$1 AND course_id=$2',
          [LEARNER, course],
        )
      ).rows[0];
      assert.deepEqual(body.data, { enrollmentId: row.id, status, access });
      const links = await fetch(`${url}/api/v1/enrollments/me/course-ids`, {
        headers: {
          'x-user-id': LEARNER,
          'x-user-role': 'LEARNER',
          'x-organization-id': ORG,
          'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
        },
      });
      assert.equal(links.status, 200);
      const data: any = await links.json();
      assert.deepEqual(
        data.data,
        status === 'Withdrawn'
          ? []
          : [{ courseId: course, enrollmentId: row.id, status }],
      );
    });
  }
  test('missing and cross-organization Enrollment are indistinguishable', async () => {
    const course = await enrollment('NotStarted', 'Required', true, OTHER);
    for (const id of [course, randomUUID()]) {
      const response = await request(`learnerId=${LEARNER}&courseId=${id}`);
      assert.equal(response.status, 404);
      const body: any = await response.json();
      assert.equal(body.error.code, 'ENROLLMENT_NOT_FOUND');
    }
  });
  for (const query of [
    '',
    `learnerId=${LEARNER}`,
    `learnerId=&courseId=${LEARNER}`,
    `learnerId=no&courseId=${LEARNER}`,
    `learnerId=${LEARNER}&courseId=no`,
    `learnerId=${LEARNER}&courseId=${LEARNER}&extra=1`,
    `learnerId=${LEARNER}&learnerId=${LEARNER}&courseId=${LEARNER}`,
    `learnerId=${LEARNER}&courseId=${LEARNER}&courseId=${LEARNER}`,
  ]) {
    test(`reject malformed query ${query}`, async () => {
      const response = await request(query);
      assert.equal(response.status, 422);
      const body: any = await response.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });
  }
  for (const headers of [
    { 'x-internal-key': '' },
    { 'x-internal-key': 'invalid-l17-test-only' },
    { 'x-user-id': '' },
    { 'x-organization-id': '' },
    { 'x-user-role': '' },
  ] as Record<string, string>[]) {
    test(`reject invalid auth ${Object.keys(headers)[0]} ${Object.values(headers)[0]}`, async () => {
      const response = await request(
        `learnerId=${LEARNER}&courseId=${LEARNER}`,
        headers,
      );
      assert.equal(response.status, 401);
      const body: any = await response.json();
      assert.equal(body.error.code, undefined);
    });
  }
});
