import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';
import { HEADER_NAMES } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { BaseDueAtRepository } from '../../src/modules/enrollments/base-due-at.repository';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { databaseUrl } from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing assignment change tests in production.');
const ORG = '0199a000-2450-7000-8000-0a00000000f1';
const OTHER = '0199a000-2450-7000-8000-0a00000000f2';
const COURSE = '0199a000-2450-7000-8000-0e00000000f1';
const ACTOR = randomUUID();
const db = new Client({ connectionString: databaseUrl('learning_db') });
let app: NestExpressApplication;
let url: string;
let today: string;
let subscriptionStatus = 'Active';
let timezone = 'Asia/Ho_Chi_Minh';
let accessCalls = 0;
async function cleanup() {
  for (const table of [
    'outbox_events',
    'enrollments',
    'course_version_snapshots',
  ])
    await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [ORG]);
}
async function seed(status = 'InProgress', optional = false) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO enrollments
    (id, organization_id, learner_id, course_id, enrollment_type, status, assigned_at, expected_completion_days,
     base_due_at, due_at, video_completion_percent, first_activity_at, completed_at, completed_late, withdrawn_at, withdrawn_reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,80,$10,$11,$12,$13,$14)`,
    [
      id,
      ORG,
      randomUUID(),
      COURSE,
      optional ? 'Optional' : 'Required',
      status,
      optional ? null : new Date('2025-01-01Z'),
      optional ? null : 30,
      optional ? null : new Date('2025-02-01Z'),
      status === 'NotStarted' ? null : new Date('2025-01-02Z'),
      status === 'Completed' ? new Date('2025-01-03Z') : null,
      status === 'Completed' && !optional ? true : null,
      status === 'Withdrawn' ? new Date('2025-01-03Z') : null,
      status === 'Withdrawn' ? 'AccountDeleted' : null,
    ],
  );
  return id;
}
async function call(
  id: string,
  action = '',
  body?: unknown,
  org = ORG,
  role = 'ORGANIZER',
) {
  const response = await fetch(
    `${url}/api/v1/assignments/${id}${action ? '/' + action : ''}`,
    {
      method: action === 'due-date' ? 'PATCH' : action ? 'POST' : 'GET',
      headers: {
        [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
        [HEADER_NAMES.USER_ID]: ACTOR,
        [HEADER_NAMES.ORGANIZATION_ID]: org,
        [HEADER_NAMES.USER_ROLE]: role,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  return {
    status: response.status,
    body: (await response.json()) as {
      data: Record<string, any>;
      error: { code: string };
    },
  };
}
async function eventCount() {
  return (
    await db.query(
      'SELECT count(*)::int AS n FROM outbox_events WHERE organization_id=$1',
      [ORG],
    )
  ).rows[0].n;
}
function plusDays(days: number) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
describe('UC24.3 / UC24.5 real DB, stub tenant, isolated organization', () => {
  before(async () => {
    await db.connect();
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    configureApp(app);
    const tenant = app.get<TenantClient>(TENANT_CLIENT);
    tenant.getOrganizationAccess = async () => {
      accessCalls++;
      return { subscriptionStatus, timezone, readOnlyEndsAt: null };
    };
    tenant.lookupLearners = async (_user, ids) =>
      ids.map((userId) => ({
        userId,
        role: 'Learner',
        status: 'Active',
        fullName: 'Fixture',
        email: 'fixture@example.test',
        activatedAt: null,
        deletedAt: null,
      }));
    app.get(CourseServiceClient).getCoursesBatch = async () => [];
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    today = (
      await db.query(
        "SELECT to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS today",
      )
    ).rows[0].today;
  });
  beforeEach(async () => {
    await cleanup();
    subscriptionStatus = 'Active';
    timezone = 'Asia/Ho_Chi_Minh';
    accessCalls = 0;
    await db.query(
      'INSERT INTO course_version_snapshots (course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES ($1,$2,$1,now(),now())',
      [COURSE, ORG],
    );
  });
  after(async () => {
    try {
      await cleanup();
    } finally {
      await app?.close();
      await db.end();
    }
  });
  test('two extensions accumulate and UC24/UC24.1 no longer display Overdue', async () => {
    const id = await seed();
    assert.equal((await call(id)).body.data.status, 'Overdue');
    const first = await call(id, 'due-date', {
      newDueDate: today,
      reason: '  ',
    });
    assert.equal(first.status, 200);
    const second = await call(id, 'due-date', {
      newDueDate: plusDays(1),
      reason: '  kéo\ndài  ',
    });
    assert.equal(second.status, 200);
    const row = (
      await db.query(
        'SELECT * FROM enrollments WHERE id=$1 AND organization_id=$2',
        [id, ORG],
      )
    ).rows[0];
    assert.equal(
      BigInt(row.extension_seconds),
      BigInt((row.due_at.getTime() - row.base_due_at.getTime()) / 1000),
    );
    assert.equal(second.body.data.status, 'InProgress');
    assert.equal(
      (await call('')).body.data.items.find(
        (item: { enrollmentId: string }) => item.enrollmentId === id,
      ).status,
      'InProgress',
    );
    assert.deepEqual(second.body.data, (await call(id)).body.data);
    const events = (
      await db.query(
        'SELECT payload FROM outbox_events WHERE organization_id=$1 ORDER BY occurred_at,id',
        [ORG],
      )
    ).rows;
    assert.equal(events.length, 2);
    assert.equal(events[0].payload.reason, null);
    assert.equal(events[1].payload.reason, 'kéo\ndài');
    assert.equal(events[1].payload.actorId, ACTOR);
  });
  for (const status of ['NotStarted', 'Exempted', 'Halted'])
    test(`extend ${status}`, async () =>
      assert.equal(
        (await call(await seed(status), 'due-date', { newDueDate: today }))
          .status,
        200,
      ));
  for (const action of ['due-date', 'exemption']) {
    test(`${action} reuses access timezone without another tenant call`, async () => {
      const id = await seed();
      timezone = 'America/New_York';
      const result = await call(
        id,
        action,
        action === 'due-date'
          ? { newDueDate: plusDays(1) }
          : { reason: 'Miễn' },
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.data.organizationTimezone, timezone);
      assert.equal(accessCalls, 1);
    });
  }
  for (const status of ['Completed', 'Withdrawn'])
    test(`extension ${status} 409`, async () => {
      const r = await call(await seed(status), 'due-date', {
        newDueDate: today,
      });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'ENROLLMENT_NOT_EXTENDABLE');
      assert.equal(await eventCount(), 0);
    });
  for (const action of ['due-date', 'exemption']) {
    test(`${action}: Optional and other organization 404`, async () => {
      const body =
        action === 'due-date' ? { newDueDate: today } : { reason: 'Miễn' };
      for (const [id, org] of [
        [await seed('InProgress', true), ORG],
        [await seed(), OTHER],
      ]) {
        const r = await call(id, action, body, org);
        assert.equal(r.status, 404);
        assert.equal(r.body.error.code, 'ASSIGNMENT_NOT_FOUND');
      }
      assert.equal(await eventCount(), 0);
    });
    test(`${action}: Organizer and Active access required`, async () => {
      const id = await seed();
      const body =
        action === 'due-date' ? { newDueDate: today } : { reason: 'Miễn' };
      assert.equal((await call(id, action, body, ORG, 'LEARNER')).status, 403);
      subscriptionStatus = 'Expired';
      assert.equal((await call(id, action, body)).status, 403);
      assert.equal(await eventCount(), 0);
    });
  }
  test('extension date errors 422; invalid DTO 400; no outbox', async () => {
    const id = await seed();
    for (const [date, code] of [
      ['2025-01-01', 'DUE_DATE_NOT_LATER'],
      [plusDays(-1), 'DUE_DATE_IN_PAST'],
      [plusDays(366), 'DUE_DATE_TOO_FAR'],
    ]) {
      const r = await call(id, 'due-date', { newDueDate: date });
      assert.equal(r.status, 422);
      assert.equal(r.body.error.code, code);
    }
    for (const newDueDate of ['2026-02-30', 'bad'])
      assert.equal((await call(id, 'due-date', { newDueDate })).status, 400);
    assert.equal(await eventCount(), 0);
  });
  test('today +365 allowed', async () =>
    assert.equal(
      (await call(await seed(), 'due-date', { newDueDate: plusDays(365) }))
        .status,
      200,
    ));
  test('exemption writes one interval and event; preserves deadline; detail reused', async () => {
    const id = await seed();
    const previous = (await call(id)).body.data.dueAt;
    const result = await call(id, 'exemption', { reason: '  miễn\nhọc  ' });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, 'Exempted');
    assert.equal(
      (await call('')).body.data.items.find(
        (item: { enrollmentId: string }) => item.enrollmentId === id,
      ).status,
      'Exempted',
    );
    assert.equal(result.body.data.dueAt, previous);
    assert.deepEqual(result.body.data, (await call(id)).body.data);
    const intervals = (
      await db.query(
        'SELECT * FROM enrollment_status_intervals WHERE organization_id=$1 AND enrollment_id=$2',
        [ORG, id],
      )
    ).rows;
    assert.equal(intervals.length, 1);
    assert.equal(intervals[0].reason, 'miễn\nhọc');
    assert.equal(intervals[0].ended_at, null);
    const event = (
      await db.query('SELECT * FROM outbox_events WHERE organization_id=$1', [
        ORG,
      ])
    ).rows[0];
    assert.equal(await eventCount(), 1);
    assert.equal(event.event_type, 'EnrollmentExempted');
    assert.equal(event.payload.actorId, ACTOR);
    assert.equal(
      event.payload.exemptedAt,
      intervals[0].started_at.toISOString(),
    );
  });
  test('two concurrent exemptions: one 200, one 409, one interval and event', async () => {
    const id = await seed();
    const results = await Promise.all([
      call(id, 'exemption', { reason: 'Miễn' }),
      call(id, 'exemption', { reason: 'Miễn' }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      results.find((r) => r.status === 409)!.body.error.code,
      'ENROLLMENT_NOT_EXEMPTIBLE',
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM enrollment_status_intervals WHERE organization_id=$1',
          [ORG],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(await eventCount(), 1);
  });
  for (const status of [
    'NotStarted',
    'Exempted',
    'Halted',
    'Completed',
    'Withdrawn',
  ])
    test(`exemption ${status} rejected without outbox`, async () => {
      const r = await call(await seed(status), 'exemption', { reason: 'Miễn' });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'ENROLLMENT_NOT_EXEMPTIBLE');
      assert.equal(await eventCount(), 0);
    });
  test('invalid exemption reasons 400', async () => {
    const id = await seed();
    for (const reason of [null, ' \n ', 'x'.repeat(1001)])
      assert.equal((await call(id, 'exemption', { reason })).status, 400);
    assert.equal(await eventCount(), 0);
  });
  test('BR-300 shares calendar-end conversion for positive and negative timezones', async () => {
    for (const [zone, expected] of [
      ['Asia/Ho_Chi_Minh', '2026-10-16T17:00:00.000Z'],
      ['America/New_York', '2026-10-17T04:00:00.000Z'],
    ]) {
      const due = await app
        .get(PrismaService)
        .$transaction((tx) =>
          app
            .get(BaseDueAtRepository)
            .computeDueAtForDate('2026-10-16', zone, tx),
        );
      assert.equal(due.toISOString(), expected);
    }
  });
  test('P2002 open-interval conflict maps 409 and rolls back status/outbox', async () => {
    const id = await seed();
    await db.query(
      "INSERT INTO enrollment_status_intervals (id,organization_id,enrollment_id,kind,started_at) VALUES ($1,$2,$3,'Halted',now())",
      [randomUUID(), ORG, id],
    );
    const r = await call(id, 'exemption', { reason: 'Miễn' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'ENROLLMENT_NOT_EXEMPTIBLE');
    assert.equal(
      (
        await db.query(
          'SELECT status FROM enrollments WHERE organization_id=$1 AND id=$2',
          [ORG, id],
        )
      ).rows[0].status,
      'InProgress',
    );
    assert.equal(await eventCount(), 0);
  });
  test('EXPLAIN ANALYZE BUFFERS lock and updates on 50000 enrollments use primary key', async () => {
    await db.query(
      `INSERT INTO enrollments
      (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,expected_completion_days,base_due_at,due_at,video_completion_percent,first_activity_at)
      SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Required','InProgress',now(),30,now()+interval '30 days',now()+interval '30 days',80,now()
      FROM generate_series(1,50000)`,
      [ORG, COURSE],
    );
    await db.query('ANALYZE enrollments');
    const id = (
      await db.query(
        'SELECT id FROM enrollments WHERE organization_id=$1 LIMIT 1',
        [ORG],
      )
    ).rows[0].id;
    await db.query('BEGIN');
    try {
      for (const [label, sql] of [
        [
          'FOR UPDATE',
          "SELECT id,learner_id,course_id,status,due_at FROM enrollments WHERE id=$1 AND organization_id=$2 AND enrollment_type='Required' FOR UPDATE",
        ],
        [
          'UPDATE due date',
          "UPDATE enrollments SET due_at=due_at+interval '1 day',extension_seconds=extension_seconds+86400,updated_at=now() WHERE id=$1 AND organization_id=$2 AND enrollment_type='Required'",
        ],
        [
          'UPDATE exemption',
          "UPDATE enrollments SET status='Exempted',updated_at=now() WHERE id=$1 AND organization_id=$2",
        ],
      ]) {
        const result = await db.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, [
          id,
          ORG,
        ]);
        const plan = result.rows.map((row) => row['QUERY PLAN']).join('\n');
        console.log(`UC24.3/UC24.5 ${label}, fixture 50000:\n${plan}`);
        assert.match(
          plan,
          /Index Scan using enrollments_id_organization_id_key on enrollments/,
        );
      }
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
