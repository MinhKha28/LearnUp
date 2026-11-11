import { closeAll, closeApp } from './deadlines';
import { testFetch as fetch } from './test-io';
import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { AssignmentKeywordSearch } from '../../src/modules/assignments/assignment-keyword-search.service';
import type { AddressInfo } from 'node:net';
import { before, after, beforeEach, describe, test } from './test-runner';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { TestClient as Client } from './test-io';
import { Prisma } from '../../generated/prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import {
  AssignmentReadsRepository,
  type AssignmentFilters,
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
const db = new Client({ connectionString: databaseUrl() });
let app: NestExpressApplication;
let url: string;
let connected = false;
let tenantCalls = 0;
let courseCalls = 0;
let tenantFails = false;
let courseFails = false;
let accessCalls = 0;
let timezoneFails = false;
const searches = {
  learner: {
    ids: [] as string[],
    calls: [] as URLSearchParams[],
    failed: false,
  },
  course: {
    ids: [] as string[],
    calls: [] as URLSearchParams[],
    failed: false,
  },
};
const searchServer = createServer((request, response) => {
  const url = new URL(request.url!, 'http://localhost');
  const learner = url.pathname === '/api/v1/users/learners';
  if (
    (!learner && url.pathname !== '/api/v1/courses/organization') ||
    request.headers[HEADER_NAMES.INTERNAL_KEY] !==
      process.env.INTERNAL_SERVICE_KEY ||
    request.headers[HEADER_NAMES.USER_ID] !== user.userId ||
    request.headers[HEADER_NAMES.USER_ROLE] !== user.role ||
    request.headers[HEADER_NAMES.ORGANIZATION_ID] !== ORG
  ) {
    response.writeHead(403).end('{}');
    return;
  }
  const search = searches[learner ? 'learner' : 'course'];
  search.calls.push(url.searchParams);
  const size = learner ? 50 : 100;
  const page = Number(url.searchParams.get(learner ? 'page' : 'current'));
  const items = search.ids
    .slice((page - 1) * size, page * size)
    .map((id) => ({ id }));
  response.writeHead(search.failed ? 500 : 200, {
    'content-type': 'application/json',
  });
  response.end(
    JSON.stringify(
      search.failed
        ? { error: { code: 'STUB_FAILURE' } }
        : {
            data: {
              [learner ? 'items' : 'result']: items,
              meta: { total: search.ids.length },
            },
          },
    ),
  );
});
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
    expected_completion_days,base_due_at,due_at,video_completion_percent,first_activity_at,completed_at,completed_late,withdrawn_at,withdrawn_reason,due_timezone)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,80,$10,$11,$12,$13,$14,CASE WHEN ($9)::timestamptz IS NULL THEN NULL ELSE 'Asia/Ho_Chi_Minh' END )`,
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
    await new Promise<void>((resolve) =>
      searchServer.listen(0, '127.0.0.1', resolve),
    );
    const searchUrl =
      'http://127.0.0.1:' + (searchServer.address() as AddressInfo).port;
    const searchClient = new AssignmentKeywordSearch(
      new ConfigService({
        TENANT_SERVICE_URL: searchUrl,
        COURSE_SERVICE_URL: searchUrl,
      }),
    );
    app.get(AssignmentKeywordSearch).ids = searchClient.ids.bind(searchClient);
    app.get<TenantClient>(TENANT_CLIENT).getOrganizationAccess = async () => {
      accessCalls++;
      if (timezoneFails) throw new Error('Timezone timeout');
      return {
        subscriptionStatus: 'Active',
        organizationStatus: 'Active',
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
    for (const search of Object.values(searches)) {
      search.ids = [];
      search.calls = [];
      search.failed = false;
    }
  });
  after(async () => {
    try {
      if (connected) await cleanup();
    } finally {
      await closeAll(
        () => closeApp(app),
        () =>
          new Promise<void>((resolve, reject) => {
            if (!searchServer.listening) return resolve();
            searchServer.close((error) => (error ? reject(error) : resolve()));
          }),
        () => db.end(),
      );
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
    assert.equal(first.items[0].dueTimezone, 'Asia/Ho_Chi_Minh');
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
    assert.equal(last.items[0].dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(accessCalls, 0);
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
  test('list skips access; detail degrades to null on timezone timeout', async () => {
    const id = await enrollment();
    timezoneFails = true;
    const list = await page();
    assert.equal(list.items[0].dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.ok(!('organizationTimezone' in list));
    const detail = await call(`/${id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(detail.body.data.organizationTimezone, null);
    assert.equal(accessCalls, 1);
  });
  test('empty list includes null timezone without tenant access', async () => {
    assert.deepEqual(await page(), {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
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
    assert.equal(item.dueTimezone, 'Asia/Ho_Chi_Minh');
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

  test('searches both keyword endpoints with scoped identity and combines filters before pagination', async () => {
    const matching = await enrollment();
    const completed = await enrollment('Completed');
    await enrollment('Halted');
    await enrollment('NotStarted', -1, true);
    const other = await enrollment('NotStarted', -1, false, OTHER);
    const learnerFor = async (id: string) =>
      (await db.query('SELECT learner_id FROM enrollments WHERE id=$1', [id]))
        .rows[0].learner_id as string;
    const learner = await learnerFor(matching);
    await db.query('UPDATE enrollments SET learner_id=$1 WHERE id=$2', [
      learner,
      other,
    ]);
    searches.learner.ids = [
      ...Array.from({ length: 50 }, () => randomUUID()),
      learner,
      await learnerFor(completed),
    ];
    searches.course.ids = [
      ...Array.from({ length: 100 }, () => randomUUID()),
      COURSE,
      OTHER_COURSE,
    ];
    const byLearner = await page('?learner=%20Ha%CC%80o%20');
    assert.equal(byLearner.total, 2);
    assert.deepEqual(
      byLearner.items.map((item) => item.enrollmentId),
      [matching, completed],
    );
    assert.deepEqual(
      searches.learner.calls.map((q) => q.toString()),
      [
        'keyword=H%C3%A0o&pageSize=50&page=1',
        'keyword=H%C3%A0o&pageSize=50&page=2',
      ],
    );
    assert.equal(searches.course.calls.length, 0);
    assert.equal((await page('?course=Fixture')).total, 3);
    assert.deepEqual(
      searches.course.calls.map((q) => q.toString()),
      [
        'search=Fixture&pageSize=100&current=1',
        'search=Fixture&pageSize=100&current=2',
      ],
    );
    assert.equal(
      (await page('?status=Completed')).items[0].enrollmentId,
      completed,
    );
    const combined =
      '&learner=H%C3%A0o&course=Fixture&status=Overdue&dueFrom=2026-01-09&dueTo=2026-01-09';
    const result = await page('?' + combined.slice(1));
    assert.equal(result.total, 1);
    assert.deepEqual(
      result.items.map((item) => item.enrollmentId),
      [matching],
    );
    assert.deepEqual(await page('?page=2' + combined), {
      items: [],
      page: 2,
      pageSize: 20,
      total: 1,
    });
  });

  test('returns a filtered total and preserves order across pages', async () => {
    const ids = [];
    for (let i = 0; i < 23; i++) ids.push(await enrollment('Halted', i));
    await enrollment('Completed');
    await enrollment('Halted', -1, false, OTHER);
    const first = await page('?status=Halted');
    const second = await page('?status=Halted&page=2');
    assert.equal(first.total, 23);
    assert.equal(second.total, 23);
    assert.equal(first.items.length, 20);
    assert.deepEqual(
      [...first.items, ...second.items].map((item) => item.enrollmentId),
      ids,
    );
  });

  test('shared deadline fixture matches inclusive SQL filters on the displayed date', async () => {
    const cases = JSON.parse(
      readFileSync(
        '../../tests/fixtures/assignment-displayed-dates.json',
        'utf8',
      ),
    ) as { timezone: string; dueAt: string; date: string }[];
    const ids = new Map<string, string[]>();
    for (const { timezone, dueAt, date } of cases) {
      const id = await enrollment();
      await db.query(
        'UPDATE enrollments SET due_at=$1, base_due_at=$1, due_timezone=$2 WHERE id=$3',
        [dueAt, timezone, id],
      );
      ids.set(date, [...(ids.get(date) ?? []), id]);
    }
    for (const [date, expected] of ids) {
      const result = await page('?dueFrom=' + date + '&dueTo=' + date);
      assert.equal(result.total, expected.length);
      assert.deepEqual(
        result.items.map((item) => item.enrollmentId).sort(),
        expected.sort(),
      );
    }
    assert.equal((await page('?dueFrom=2026-03-07')).total, 5);
    assert.equal((await page('?dueTo=2026-01-01')).total, 4);
  });

  test('status filter switches to Overdue at the exact database deadline', async () => {
    const id = await enrollment();
    await db.query('BEGIN');
    try {
      for (const [offset, expected] of [
        ['1 millisecond', 'NotStarted'],
        ['0 milliseconds', 'Overdue'],
        ['-1 millisecond', 'Overdue'],
      ] as const) {
        await db.query(
          'UPDATE enrollments SET due_at=now()+$1::interval, base_due_at=now()+$1::interval WHERE id=$2',
          [offset, id],
        );
        for (const status of ['NotStarted', 'Overdue'] as const) {
          const sql = assignmentPageSql(ORG, 0, { status });
          const { rows } = await db.query(sql.text, sql.values);
          assert.equal(rows.length, status === expected ? 1 : 0);
          if (rows.length) assert.equal(rows[0].status, expected);
        }
      }
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('empty matches return an empty page; the cap permits 1000 and rejects the 1001st ID', async () => {
    await enrollment();
    assert.deepEqual(await page('?learner=missing&page=3'), {
      items: [],
      page: 3,
      pageSize: 20,
      total: 0,
    });
    assert.equal(tenantCalls + courseCalls, 0);
    for (const [kind, lastPage] of [
      ['learner', 21],
      ['course', 11],
    ] as const) {
      const search = searches[kind];
      search.ids = Array.from({ length: 1000 }, () => randomUUID());
      assert.equal((await page('?' + kind + '=limit')).total, 0);
      search.ids.push(randomUUID(), randomUUID());
      search.calls = [];
      const response = await call('?' + kind + '=limit');
      assert.equal(response.status, 422);
      assert.equal(response.body.error.code, 'SEARCH_TOO_BROAD');
      assert.equal(search.calls.length, lastPage);
    }
  });

  test('upstream failures affect only requests using the corresponding keyword', async () => {
    const id = await enrollment();
    searches.learner.failed = searches.course.failed = true;
    tenantFails = courseFails = true;
    const result = await page();
    assert.equal(result.items[0].enrollmentId, id);
    assert.equal(result.items[0].learner, null);
    assert.equal(result.items[0].course, null);
    assert.equal(
      searches.learner.calls.length + searches.course.calls.length,
      0,
    );
    const learner = await call('?learner=H%C3%A0o');
    assert.equal(learner.status, 503);
    assert.equal(learner.body.error.code, 'LEARNER_SEARCH_UNAVAILABLE');
    assert.equal(searches.course.calls.length, 0);
    const course = await call('?course=Fixture');
    assert.equal(course.status, 503);
    assert.equal(course.body.error.code, 'COURSE_SEARCH_UNAVAILABLE');
    assert.equal(searches.learner.calls.length, 1);
  });

  test('rejects invalid dates, statuses and keyword shapes before upstream work', async () => {
    for (const query of [
      'dueFrom=2026-02-29',
      'dueTo=2026-01-01T00%3A00%3A00Z',
      'dueFrom=0000-01-01',
      'status=overdue',
      'status=Completed&status=Halted',
      'learner=%20',
      'course=a&course=b',
      'learner=' + 'a'.repeat(101),
    ])
      assert.equal((await call('?' + query)).status, 400, query);
    const reversed = await call(
      '?dueFrom=2026-03-09&dueTo=2026-03-08&learner=Fixture',
    );
    assert.equal(reversed.status, 400);
    assert.equal(reversed.body.error.code, 'INVALID_DUE_DATE_RANGE');
    assert.equal(searches.learner.calls.length, 0);
  });

  test('UC24.7 EXPLAIN ANALYZE for 50,000 Required assignments', async () => {
    const ids = Array.from({ length: 1000 }, () => randomUUID());
    await db.query(
      `INSERT INTO enrollments (id, organization_id, learner_id, course_id, enrollment_type, status,
        assigned_at, expected_completion_days, base_due_at, due_at, video_completion_percent, due_timezone)
      SELECT gen_random_uuid(), $1, CASE WHEN g <= 1000 THEN ($3::uuid[])[g] ELSE gen_random_uuid() END,
        $2, 'Required', 'NotStarted', '2025-01-01Z', 30,
        deadline, deadline, 80, 'Asia/Ho_Chi_Minh'
      FROM generate_series(1,50000) g
      CROSS JOIN LATERAL (SELECT '2025-01-01 17:00Z'::timestamptz + (g % 365) * interval '1 day' AS deadline) d`,
      [ORG, COURSE, ids],
    );
    await db.query('ANALYZE enrollments');
    const cases: [string, AssignmentFilters][] = [
      ['none', {}],
      ['status', { status: 'Overdue' }],
      ['learner-1000', { learnerIds: ids }],
      ['date-range', { dueFrom: '2025-07-01', dueTo: '2025-07-07' }],
    ];
    for (const [label, filters] of cases) {
      const measurements = [];
      for (let run = 0; run < 3; run++) {
        const results = [];
        for (const sql of [
          assignmentCountSql(ORG, filters),
          assignmentPageSql(ORG, 0, filters),
        ]) {
          const result = await db.query(
            'EXPLAIN (ANALYZE, FORMAT JSON) ' + sql.text,
            sql.values,
          );
          const plan = result.rows[0]['QUERY PLAN'][0];
          results.push({ ms: plan['Execution Time'], plan: plan.Plan });
        }
        measurements.push(results);
      }
      const median = (values: number[]) => values.sort((a, b) => a - b)[1];
      console.log(
        'UC24.7 EXPLAIN',
        label,
        JSON.stringify({
          countMs: median(measurements.map(([count]) => count.ms)),
          pageMs: median(measurements.map(([, page]) => page.ms)),
          totalMs: median(
            measurements.map(([count, page]) => count.ms + page.ms),
          ),
          plans: measurements[0].map((entry) => entry.plan),
        }),
      );
    }
  });

  test('EXPLAIN ANALYZE count, first and last page with 2,000 Required', async () => {
    await db.query(
      `INSERT INTO enrollments (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,expected_completion_days,base_due_at,due_at,video_completion_percent,due_timezone)
      SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Required','NotStarted',now(),30,now()+g*interval '1 day',now()+g*interval '1 day',80 ,CASE WHEN (now()+g*interval '1 day')::timestamptz IS NULL THEN NULL ELSE 'Asia/Ho_Chi_Minh' END FROM generate_series(1,2000) g`,
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
