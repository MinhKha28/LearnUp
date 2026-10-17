import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { before, after, beforeEach, describe, test } from 'node:test';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { Prisma } from '../../generated/prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { OrganizationTimezoneService } from '../../src/infrastructure/clients/tenant/organization-timezone.service';
import {
  AssignmentReadsRepository,
  assignmentCountSql,
  assignmentDetailSql,
  assignmentPageSql,
} from '../../src/modules/assignments/assignment-reads.repository';
import { databaseUrl } from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing UC24 integration tests in production.');
const ORG = '0199a000-0024-7000-8000-0a00000000f1';
const OTHER = '0199a000-0024-7000-8000-0a00000000f2';
const COURSE = '0199a000-0024-7000-8000-0e00000000f1';
const OTHER_COURSE = '0199a000-0024-7000-8000-0e00000000f2';
const MATERIAL = '0199a000-0024-7000-8000-1c00000000f1';
const LESSON = '0199a000-0024-7000-8000-1b00000000f1';
const user: CurrentUser = {
  userId: randomUUID(),
  organizationId: ORG,
  role: 'ORGANIZER',
  isAuthenticated: true,
};
const db = new Client({ connectionString: databaseUrl('learning_db') });
let app: NestExpressApplication;
let url: string;
let connected = false;
let tenantCalls = 0;
let courseCalls = 0;
let tenantFails = false;
let courseFails = false;
let accessCalls = 0;
let timezoneFails = false;
let timezoneService: OrganizationTimezoneService;
let getTimezone: OrganizationTimezoneService['getTimezone'];
type Item = {
  enrollmentId: string;
  status: string;
  learner: {
    id: string;
    fullName: string;
    email: string;
    status: string;
    activatedAt: string | null;
    deletedAt: string | null;
  } | null;
  course: { id: string; title: string; versionNumber: number } | null;
  requiredCompleted: number;
  requiredTotal: number;
  [key: string]: unknown;
};
type Page = {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  organizationTimezone: string | null;
};
async function cleanup() {
  for (const table of [
    'enrollments',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
    'organization_suspensions',
  ]) {
    await db.query(
      `DELETE FROM ${table} WHERE organization_id = ANY($1::uuid[])`,
      [[ORG, OTHER]],
    );
  }
}
async function seed() {
  for (const [org, course] of [
    [ORG, COURSE],
    [OTHER, OTHER_COURSE],
  ]) {
    await db.query(
      `INSERT INTO course_version_snapshots (course_id, organization_id, chain_id, tree_fetched_at, disabled_as_of)
      VALUES ($1,$2,$1,now(),now())`,
      [course, org],
    );
  }
  await db.query(
    `INSERT INTO lesson_snapshots (lesson_id,organization_id,course_id,disabled_as_of) VALUES ($1,$2,$3,now())`,
    [LESSON, ORG, COURSE],
  );
  await db.query(
    `INSERT INTO material_snapshots (material_id,organization_id,course_id,lesson_id,material_type,is_required,disabled_as_of)
    VALUES ($1,$2,$3,$4,'Reading',true,now())`,
    [MATERIAL, ORG, COURSE, LESSON],
  );
}
async function enrollment(
  status = 'NotStarted',
  day = -1,
  optional = false,
  org = ORG,
  completedDay = -1,
) {
  const id = randomUUID();
  const dueAt = new Date(Date.UTC(2026, 0, 10 + day));
  await db.query(
    `INSERT INTO enrollments (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,
    expected_completion_days,base_due_at,due_at,video_completion_percent,first_activity_at,completed_at,completed_late,withdrawn_at,withdrawn_reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,80,$10,$11,$12,$13,$14)`,
    [
      id,
      org,
      randomUUID(),
      org === ORG ? COURSE : OTHER_COURSE,
      optional ? 'Optional' : 'Required',
      status,
      optional ? null : new Date('2025-12-01Z'),
      optional ? null : 30,
      optional ? null : dueAt,
      status === 'NotStarted' ? null : new Date('2025-12-02Z'),
      status === 'Completed'
        ? new Date(Date.UTC(2026, 0, 10 + completedDay))
        : null,
      status === 'Completed' && !optional ? true : null,
      status === 'Withdrawn' ? new Date('2026-01-01Z') : null,
      status === 'Withdrawn' ? 'AccountDeleted' : null,
    ],
  );
  return id;
}
async function call(path = '', role = 'ORGANIZER') {
  const response = await fetch(`${url}/api/v1/assignments${path}`, {
    headers: {
      [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
      [HEADER_NAMES.USER_ID]: user.userId,
      [HEADER_NAMES.USER_ROLE]: role,
      [HEADER_NAMES.ORGANIZATION_ID]: ORG,
    },
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      data: Page & Item;
      error: { code: string };
    },
  };
}
async function page(query = '') {
  const result = await call(query);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.data as Page;
}

describe('UC24 / UC24.1 assignment reads, isolated fixture', () => {
  before(async () => {
    await db.connect();
    connected = true;
    await cleanup();
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    configureApp(app);
    timezoneService = app.get(OrganizationTimezoneService);
    getTimezone = timezoneService.getTimezone.bind(timezoneService);
    app.get<TenantClient>(TENANT_CLIENT).getOrganizationAccess = async () => {
      accessCalls++;
      if (timezoneFails) throw new Error('Timezone timeout');
      return {
        subscriptionStatus: 'Active',
        readOnlyEndsAt: null,
        timezone: 'Asia/Ho_Chi_Minh',
      };
    };
    app.get<TenantClient>(TENANT_CLIENT).lookupLearners = async (
      _user,
      ids,
    ) => {
      tenantCalls++;
      if (tenantFails) throw new Error('Tenant timeout');
      return ids.map((userId) => ({
        userId,
        role: 'Learner',
        status: 'Pending',
        fullName: 'Fixture',
        email: 'fixture@example.test',
        activatedAt: null,
        deletedAt: null,
      }));
    };
    app.get(CourseServiceClient).getCoursesBatch = async (_user, ids) => {
      courseCalls++;
      if (courseFails) throw new Error('Course timeout');
      return ids.map((courseId) => ({
        courseId,
        chainId: courseId,
        versionNumber: 2,
        name: 'Fixture course',
        courseType: 'Private',
        status: 'Published',
        coverFileId: null,
      }));
    };
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await cleanup();
    await seed();
    tenantCalls = courseCalls = 0;
    tenantFails = courseFails = false;
    accessCalls = 0;
    timezoneFails = false;
    const fresh = new OrganizationTimezoneService(
      app.get<TenantClient>(TENANT_CLIENT),
    );
    timezoneService.getTimezone = fresh.getTimezone.bind(fresh);
  });
  after(async () => {
    try {
      if (connected) await cleanup();
    } finally {
      if (timezoneService) timezoneService.getTimezone = getTimezone;
      await app?.close();
      await db.end();
    }
  });

  test('mixed statuses, id DESC ties, Completed newest last group, exactly one lookup per page', async () => {
    const unfinished: { id: string; day: number }[] = [];
    for (let n = 0; n < 23; n++)
      unfinished.push({
        id: await enrollment(
          ['NotStarted', 'InProgress', 'Exempted', 'Halted', 'Withdrawn'][
            n % 5
          ],
          n % 4,
        ),
        day: n % 4,
      });
    const old = await enrollment('Completed', -100, false, ORG, -3);
    const recent = await enrollment('Completed', -100, false, ORG, -1);
    unfinished.sort((a, b) => a.day - b.day || b.id.localeCompare(a.id));
    const expected = [...unfinished.map((r) => r.id), recent, old];
    await enrollment('NotStarted', -10, true);
    await enrollment('NotStarted', -10, false, OTHER);
    const first = await page();
    assert.equal(first.total, 25);
    assert.equal(first.pageSize, 20);
    assert.equal(first.page, 1);
    assert.equal(first.organizationTimezone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual(
      first.items.map((r) => r.enrollmentId),
      expected.slice(0, 20),
    );
    assert.equal(tenantCalls, 1);
    assert.equal(courseCalls, 1);
    assert.deepEqual(first.items[0].course, {
      id: COURSE,
      title: 'Fixture course',
      versionNumber: 2,
    });
    assert.equal(first.items[0].learner?.status, 'Pending');
    const last = await page('?page=2');
    assert.deepEqual(
      last.items.map((r) => r.enrollmentId),
      expected.slice(20),
    );
    assert.equal(tenantCalls, 2);
    assert.equal(courseCalls, 2);
    assert.equal(last.organizationTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(accessCalls, 1);
    for (const row of [...first.items, ...last.items]) {
      assert.equal(row.requiredCompleted, 0);
      assert.equal(row.requiredTotal, 1);
      assert.ok(
        ['Overdue', 'Exempted', 'Halted', 'Withdrawn', 'Completed'].includes(
          row.status,
        ),
      );
    }
  });

  test('past due NotStarted/InProgress are Overdue; terminal statuses retain status; suspension uses D23', async () => {
    const id = await enrollment();
    await enrollment('InProgress');
    for (const status of ['Exempted', 'Halted', 'Withdrawn', 'Completed'])
      await enrollment(status);
    assert.deepEqual((await page()).items.map((r) => r.status).sort(), [
      'Completed',
      'Exempted',
      'Halted',
      'Overdue',
      'Overdue',
      'Withdrawn',
    ]);
    await db.query(
      `INSERT INTO organization_suspensions (id,organization_id,started_at) VALUES ($1,$2,'2025-01-01Z')`,
      [randomUUID(), ORG],
    );
    assert.equal((await call(`/${id}`)).body.data.status, 'NotStarted');
  });

  test('overflow pages skip page SQL and remote calls; invalid page is 400', async () => {
    await enrollment();
    const repo = app.get(AssignmentReadsRepository);
    const original = repo.page;
    repo.page = () => {
      throw new Error('Must not query overflow offset');
    };
    try {
      for (const query of ['?page=2', '?page=1e20', '?page=1e308'])
        assert.deepEqual(await page(query), {
          items: [],
          page: Number(query.split('=')[1]),
          pageSize: 20,
          total: 1,
          organizationTimezone: null,
        });
      assert.equal(tenantCalls, 0);
      assert.equal(courseCalls, 0);
      assert.equal(accessCalls, 0);
    } finally {
      repo.page = original;
    }
    for (const value of ['0', '-1', '1.5', 'abc', 'Infinity'])
      assert.equal((await call(`?page=${value}`)).status, 400);
  });

  test('tenant failure returns learner null on list and detail, still 200', async () => {
    const id = await enrollment();
    tenantFails = true;
    assert.equal((await page()).items[0].learner, null);
    const result = await call(`/${id}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.learner, null);
    assert.ok(result.body.data.course);
    assert.equal(tenantCalls, 2);
    assert.equal(courseCalls, 2);
  });
  test('timezone failure keeps list and detail 200, null is not cached', async () => {
    const id = await enrollment();
    timezoneFails = true;
    const list = await page();
    assert.equal(list.organizationTimezone, null);
    assert.equal(list.items.length, 1);
    const detail = await call(`/${id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.organizationTimezone, null);
    assert.ok(detail.body.data.learner);
    assert.ok(detail.body.data.course);
    assert.equal(accessCalls, 2);
    timezoneFails = false;
    assert.equal(
      (await call(`/${id}`)).body.data.organizationTimezone,
      'Asia/Ho_Chi_Minh',
    );
    assert.equal((await page()).organizationTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(accessCalls, 3);
  });
  test('empty list includes null timezone without tenant access', async () => {
    assert.deepEqual(await page(), {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      organizationTimezone: null,
    });
    assert.equal(accessCalls, 0);
  });
  test('course failure returns course null on list and detail, still 200', async () => {
    const id = await enrollment();
    courseFails = true;
    assert.equal((await page()).items[0].course, null);
    const result = await call(`/${id}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.course, null);
    assert.ok(result.body.data.learner);
  });
  test('detail includes ordered intervals, deadline and actual D25 counts', async () => {
    const id = await enrollment('Completed');
    await db.query(
      `INSERT INTO material_progress (id,organization_id,enrollment_id,material_id,completed_at) VALUES ($1,$2,$3,$4,now())`,
      [randomUUID(), ORG, id, MATERIAL],
    );
    for (const [kind, date] of [
      ['Halted', '2026-01-03Z'],
      ['Exempted', '2026-01-01Z'],
    ])
      await db.query(
        `INSERT INTO enrollment_status_intervals (id,organization_id,enrollment_id,kind,started_at,ended_at,reason) VALUES ($1,$2,$3,$4,$5,$5::timestamptz+interval '1 day',CASE WHEN $4 = 'Exempted' THEN 'Fixture' ELSE NULL END)`,
        [randomUUID(), ORG, id, kind, date],
      );
    const result = await call(`/${id}`);
    assert.equal(result.status, 200);
    const item = result.body.data;
    assert.equal(item.requiredCompleted, 1);
    assert.equal(item.requiredTotal, 1);
    assert.equal(item.extensionSeconds, 0);
    assert.equal(item.organizationTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(item.completedLate, true);
    assert.equal(item.baseDueAt, item.dueAt);
    assert.ok(item.firstActivityAt);
    assert.ok(item.completedAt);
    assert.equal(item.withdrawnAt, null);
    assert.equal(item.withdrawnReason, null);
    assert.deepEqual(
      (item.intervals as { kind: string }[]).map((i) => i.kind),
      ['Exempted', 'Halted'],
    );
    assert.equal(tenantCalls, 1);
    assert.equal(courseCalls, 1);
  });
  test('missing, Optional and other organization detail share 404 code', async () => {
    for (const id of [
      randomUUID(),
      await enrollment('NotStarted', -1, true),
      await enrollment('NotStarted', -1, false, OTHER),
    ]) {
      const result = await call(`/${id}`);
      assert.equal(result.status, 404);
      assert.equal(result.body.error.code, 'ASSIGNMENT_NOT_FOUND');
    }
    assert.equal(tenantCalls, 0);
    assert.equal(courseCalls, 0);
  });
  test('only Organizer can read list and detail', async () => {
    const id = await enrollment();
    for (const role of ['LEARNER', 'INSTRUCTOR', 'ADMIN']) {
      assert.equal((await call('', role)).status, 403);
      assert.equal((await call(`/${id}`, role)).status, 403);
    }
  });

  test('EXPLAIN ANALYZE count, first and last page with 2,000 Required', async () => {
    await db.query(
      `INSERT INTO enrollments (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,expected_completion_days,base_due_at,due_at,video_completion_percent)
      SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Required','NotStarted',now(),30,now()+g*interval '1 day',now()+g*interval '1 day',80 FROM generate_series(1,2000) g`,
      [ORG, COURSE],
    );
    const id = (
      await db.query(
        'SELECT id FROM enrollments WHERE organization_id=$1 LIMIT 1',
        [ORG],
      )
    ).rows[0].id as string;
    for (const [label, sql] of [
      ['count', assignmentCountSql(ORG)],
      ['page1', assignmentPageSql(ORG, 0)],
      ['page100', assignmentPageSql(ORG, 1980)],
      ['detail', assignmentDetailSql(ORG, id)],
      [
        'intervals',
        Prisma.sql`SELECT kind, started_at, ended_at, reason FROM enrollment_status_intervals WHERE organization_id=${ORG}::uuid AND enrollment_id=${id}::uuid ORDER BY started_at ASC, id ASC`,
      ],
    ] as const) {
      const plan = (
        await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql.text}`, sql.values)
      ).rows[0]['QUERY PLAN'][0];
      console.log(`UC24 EXPLAIN ${label} ${JSON.stringify(plan)}`);
    }
  });
});
