import { closeAll, closeApp } from './deadlines';
import { courseStub } from './course-stub';
import { testFetch as fetch } from './test-io';
import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from './test-runner';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { TestClient as Client } from './test-io';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  type LookupLearner,
  type TenantClient,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { CourseSnapshotPreparationService } from '../../src/modules/course-snapshots/course-snapshot-preparation.service';
import { CourseSnapshotsRepository } from '../../src/modules/course-snapshots/course-snapshots.repository';
import {
  AssignmentsRepository,
  existingEnrollmentsSql,
  insertAssignmentsSql,
  updateAssignmentsSql,
  type AssignmentBatch,
} from '../../src/modules/assignments/assignments.repository';
import {
  databaseUrl,
  ENROLL_IT_ORG as ORG,
  ENROLL_IT_PUBLIC_COURSE as COURSE,
  ENROLL_IT_PRIVATE_COURSE as PRIVATE,
  ENROLL_IT_ORGANIZER as ORGANIZER,
  resetEnrollFixture,
} from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing assignment integration tests in production.');
const learningDb = new Client({ connectionString: databaseUrl() });
const users = new Map<string, LookupLearner>();
let app: NestExpressApplication;
let baseUrl: string;
let tenantCalls = 0;
let i1Calls = 0;
let subscriptionStatus = 'Active';
let organizationStatus = 'Active';
let tenantDown = false;
let connected = false;
const learner = (id: string): CurrentUser => ({
  ...ORGANIZER,
  userId: id,
  role: 'LEARNER',
});
function addUser(extra: Partial<LookupLearner> = {}) {
  const u: LookupLearner = {
    userId: randomUUID(),
    role: 'Learner',
    status: 'Active',
    activatedAt: null,
    deletedAt: null,
    fullName: 'Fixture',
    email: 'fixture@example.test',
    ...extra,
  };
  users.set(u.userId, u);
  return u.userId;
}
async function call(path: string, body: unknown, user = ORGANIZER) {
  const response = await fetch(`${baseUrl}/api/v1/${path}`, {
    method: 'POST',
    headers: {
      [HEADER_NAMES.INTERNAL_KEY]: process.env.INTERNAL_SERVICE_KEY!,
      [HEADER_NAMES.USER_ID]: user.userId,
      [HEADER_NAMES.USER_ROLE]: user.role,
      [HEADER_NAMES.ORGANIZATION_ID]: ORG,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      data: Record<string, number>;
      error: { code: string; errors?: { learnerId: string; reason: string }[] };
    },
  };
}
const assign = (ids: string[], courseId = COURSE, user = ORGANIZER) =>
  call('assignments', { courseId, learnerIds: ids }, user);
async function rows() {
  return (
    await learningDb.query(
      'SELECT * FROM enrollments WHERE organization_id=$1 ORDER BY learner_id',
      [ORG],
    )
  ).rows;
}
async function events() {
  return (
    await learningDb.query(
      "SELECT * FROM outbox_events WHERE organization_id=$1 AND event_type='EnrollmentAssigned' ORDER BY aggregate_id",
      [ORG],
    )
  ).rows;
}
async function optional(id: string, status = 'NotStarted') {
  assert.equal(
    (await call('enrollments', { courseId: COURSE }, learner(id))).status,
    201,
  );
  if (status === 'InProgress')
    await learningDb.query(
      "UPDATE enrollments SET status='InProgress', first_activity_at=now(), video_completion_percent=41 WHERE learner_id=$1 AND organization_id=$2",
      [id, ORG],
    );
  if (status === 'Completed')
    await learningDb.query(
      "UPDATE enrollments SET status='Completed', first_activity_at=now(), completed_at=now(), video_completion_percent=41 WHERE learner_id=$1 AND organization_id=$2",
      [id, ORG],
    );
  if (status === 'Withdrawn')
    await learningDb.query(
      "UPDATE enrollments SET status='Withdrawn', withdrawn_at=now(), withdrawn_reason='LearnerWithdrew' WHERE learner_id=$1 AND organization_id=$2",
      [id, ORG],
    );
}
async function prepare(courseId = COURSE) {
  const lock = await app
    .get(CourseServiceClient)
    .lockCourse(ORGANIZER, courseId, false);
  const data = await app
    .get(CourseSnapshotPreparationService)
    .prepare(ORGANIZER, lock);
  if (data)
    await app
      .get(PrismaService)
      .$transaction((tx) =>
        app.get(CourseSnapshotsRepository).insertIgnoringConflicts(data, tx),
      );
}

void describe('UC24.2 assignments (isolated Learning database and HTTP Course stub, stub tenant lookup)', () => {
  before(async () => {
    await learningDb.connect();
    connected = true;
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    configureApp(app);
    const tenant = app.get<TenantClient>(TENANT_CLIENT);
    tenant.lookupLearners = async (_user, ids) => {
      tenantCalls++;
      return ids.flatMap((id) => (users.has(id) ? [users.get(id)!] : []));
    };
    tenant.getOrganizationAccess = async () => {
      if (tenantDown) throw new TenantUnavailableError('network');
      return {
        subscriptionStatus,
        organizationStatus,
        readOnlyEndsAt: null,
        timezone: 'Asia/Ho_Chi_Minh',
      };
    };
    const courses = app.get(CourseServiceClient);
    const lock = courses.lockCourse.bind(courses);
    courses.lockCourse = async (...args) => {
      i1Calls++;
      return lock(...args);
    };
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  void test('inactive organization blocks assignment before learner lookup', async () => {
    organizationStatus = 'Suspended';
    const result = await assign([addUser()]);
    assert.equal(result.status, 403);
    assert.equal(result.body.error.code, 'ORGANIZATION_NOT_ACTIVE');
    assert.equal(tenantCalls, 0);
    assert.equal(i1Calls, 0);
    assert.equal((await rows()).length, 0);
  });
  void test('tenant access outage blocks assignment with 503', async () => {
    tenantDown = true;
    const result = await assign([addUser()]);
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(tenantCalls, 0);
    assert.equal(i1Calls, 0);
    assert.equal((await rows()).length, 0);
  });
  beforeEach(async () => {
    await learningDb.query(
      "DELETE FROM outbox_events WHERE organization_id=$1 AND event_type='EnrollmentAssigned'",
      [ORG],
    );
    await resetEnrollFixture(learningDb);
    users.clear();
    tenantCalls = 0;
    i1Calls = 0;
    subscriptionStatus = 'Active';
    organizationStatus = 'Active';
    tenantDown = false;
  });
  after(async () => {
    try {
      if (connected) {
        await learningDb.query(
          "DELETE FROM outbox_events WHERE organization_id=$1 AND event_type='EnrollmentAssigned'",
          [ORG],
        );
        await resetEnrollFixture(learningDb);
      }
    } finally {
      await closeAll(
        () => closeApp(app),
        () => learningDb.end(),
      );
    }
  });

  test('creates three including Pending with one lookup, one assignedAt, one outbox each, no intervals', async () => {
    const ids = [addUser(), addUser({ status: 'Pending' }), addUser()];
    const result = await assign(ids);
    assert.equal(result.status, 201);
    assert.deepEqual(result.body.data, {
      created: 3,
      converted: 0,
      completedOnAssign: 0,
      restored: 0,
    });
    assert.equal(tenantCalls, 1);
    const enrolled = await rows();
    assert.equal(enrolled.length, 3);
    assert.equal(
      new Set(enrolled.map((e) => e.assigned_at.toISOString())).size,
      1,
    );
    assert.ok(
      enrolled.every(
        (e) =>
          e.enrollment_type === 'Required' &&
          e.base_due_at.getTime() === e.due_at.getTime(),
      ),
    );
    const outbox = await events();
    assert.equal(outbox.length, 3);
    assert.ok(
      outbox.every(
        (e) =>
          e.payload.kind === 'CREATE' &&
          e.payload.assignedBy === ORGANIZER.userId &&
          e.payload.assignedAt === enrolled[0].assigned_at.toISOString(),
      ),
    );
    assert.equal(
      (
        await learningDb.query(
          'SELECT count(*)::int AS n FROM enrollment_status_intervals WHERE organization_id=$1',
          [ORG],
        )
      ).rows[0].n,
      0,
    );
  });

  test('converts Optional InProgress preserving enrollment, activity, video threshold and material progress', async () => {
    const id = addUser();
    await optional(id, 'InProgress');
    const [old] = await rows();
    const material = (
      await learningDb.query(
        'SELECT material_id FROM material_snapshots WHERE organization_id=$1 AND course_id=$2 LIMIT 1',
        [ORG, COURSE],
      )
    ).rows[0];
    assert.ok(material);
    await learningDb.query(
      'INSERT INTO material_progress(id, organization_id, enrollment_id, material_id, completed_at) VALUES ($1,$2,$3,$4,now())',
      [randomUUID(), ORG, old.id, material.material_id],
    );
    const progress = (
      await learningDb.query(
        'SELECT * FROM material_progress WHERE organization_id=$1 AND enrollment_id=$2',
        [ORG, old.id],
      )
    ).rows;
    const result = await assign([id]);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.converted, 1);
    const [row] = await rows();
    assert.equal(row.id, old.id);
    assert.equal(row.status, 'InProgress');
    assert.equal(row.video_completion_percent, 41);
    assert.deepEqual(row.due_at, row.base_due_at);
    assert.equal(BigInt(row.extension_seconds), 0n);
    assert.deepEqual(row.first_activity_at, old.first_activity_at);
    assert.deepEqual(
      (
        await learningDb.query(
          'SELECT * FROM material_progress WHERE organization_id=$1 AND enrollment_id=$2',
          [ORG, old.id],
        )
      ).rows,
      progress,
    );
    assert.equal((await events())[0].payload.kind, 'CONVERT');
  });

  test('converts Completed without changing completedAt and sets completedLate=false', async () => {
    const id = addUser();
    await optional(id, 'Completed');
    const [old] = await rows();
    const result = await assign([id]);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.completedOnAssign, 1);
    const [row] = await rows();
    assert.equal(row.status, 'Completed');
    assert.deepEqual(row.completed_at, old.completed_at);
    assert.equal(row.completed_late, false);
    assert.equal(row.video_completion_percent, 41);
    const outbox = await events();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].payload.kind, 'CONVERT_COMPLETED');
  });

  test('restores Withdrawn to NotStarted or InProgress according to firstActivityAt', async () => {
    const ids = [addUser(), addUser()];
    await optional(ids[0], 'Withdrawn');
    await optional(ids[1], 'Withdrawn');
    await learningDb.query(
      'UPDATE enrollments SET first_activity_at=now() WHERE organization_id=$1 AND learner_id=$2',
      [ORG, ids[1]],
    );
    const result = await assign(ids);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.restored, 2);
    for (const row of await rows()) {
      assert.equal(
        row.status,
        row.learner_id === ids[0] ? 'NotStarted' : 'InProgress',
      );
      assert.equal(row.withdrawn_at, null);
      assert.equal(row.withdrawn_reason, null);
    }
    assert.ok((await events()).every((e) => e.payload.kind === 'RESTORE'));
  });

  test('restores Required Withdrawn with a fresh deadline and no previous extension', async () => {
    const ids = [addUser(), addUser()];
    await optional(ids[0], 'Withdrawn');
    await optional(ids[1], 'Withdrawn');
    await learningDb.query(
      `UPDATE enrollments SET enrollment_type='Required',
      assigned_at='2025-01-01Z', expected_completion_days=1, base_due_at='2025-01-03Z',
      due_at='2025-01-05Z', extension_seconds=172800,
      first_activity_at=CASE WHEN learner_id=$2 THEN now() ELSE NULL END
      WHERE organization_id=$1`,
      [ORG, ids[1]],
    );
    const result = await assign(ids);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.restored, 2);
    for (const row of await rows()) {
      assert.equal(
        row.status,
        row.learner_id === ids[0] ? 'NotStarted' : 'InProgress',
      );
      assert.equal(BigInt(row.extension_seconds), 0n);
      assert.deepEqual(row.due_at, row.base_due_at);
      assert.ok(row.assigned_at > new Date('2025-01-01Z'));
      assert.equal(row.withdrawn_at, null);
      assert.equal(row.withdrawn_reason, null);
      const event = (await events()).find((e) => e.aggregate_id === row.id);
      assert.ok(event);
      assert.equal(event.payload.kind, 'RESTORE');
      assert.equal(event.payload.dueAt, row.due_at.toISOString());
    }
  });

  for (const withdrawnReason of ['AccountDeleted', 'HaltedClosed']) {
    for (const enrollmentType of ['Required', 'Optional']) {
      test(`${enrollmentType} Withdrawn ${withdrawnReason} retains assignment behavior`, async () => {
        const id = addUser();
        await optional(id, 'Withdrawn');
        await learningDb.query(
          `UPDATE enrollments SET withdrawn_reason=$2 WHERE organization_id=$1`,
          [ORG, withdrawnReason],
        );
        if (enrollmentType === 'Required')
          await learningDb.query(
            `UPDATE enrollments SET enrollment_type='Required', assigned_at=now(),
            expected_completion_days=1, base_due_at=now(), due_at=now() WHERE organization_id=$1`,
            [ORG],
          );
        const result = await assign([id]);
        assert.equal(result.status, enrollmentType === 'Required' ? 422 : 201);
        if (enrollmentType === 'Required') {
          assert.deepEqual(result.body.error.errors, [
            { learnerId: id, reason: 'ALREADY_ASSIGNED' },
          ]);
          assert.equal((await rows())[0].withdrawn_reason, withdrawnReason);
          assert.equal((await events()).length, 0);
        } else assert.equal(result.body.data.restored, 1);
      });
    }
  }

  test('an invalid learner prevents restoring any Withdrawn in the batch', async () => {
    const id = addUser();
    await optional(id, 'Withdrawn');
    const before = await rows();
    const result = await assign([id, randomUUID()]);
    assert.equal(result.status, 422);
    assert.deepEqual(await rows(), before);
    assert.equal((await events()).length, 0);
  });

  test('locked reclassification rejects a concurrent Required change before writing the batch', async () => {
    const id = addUser();
    const newId = addUser();
    await optional(id, 'Withdrawn');
    const courses = app.get(CourseServiceClient);
    const original = courses.lockCourse.bind(courses);
    courses.lockCourse = async (...args) => {
      const lock = await original(...args);
      await learningDb.query(
        `UPDATE enrollments SET enrollment_type='Required', status='InProgress',
          assigned_at=now(), expected_completion_days=1, base_due_at=now(), due_at=now(),
          first_activity_at=now(), withdrawn_at=NULL, withdrawn_reason=NULL WHERE organization_id=$1`,
        [ORG],
      );
      return lock;
    };
    try {
      const result = await assign([id, newId]);
      assert.equal(result.status, 409);
      assert.equal(result.body.error.code, 'CONCURRENT_CHANGE');
      assert.equal((await rows()).length, 1);
      assert.equal((await events()).length, 0);
    } finally {
      courses.lockCourse = original;
    }
  });

  for (const reason of [
    'NOT_IN_ORGANIZATION',
    'NOT_A_LEARNER',
    'ACCOUNT_DELETED',
    'ACCOUNT_DEACTIVATED',
    'ALREADY_ASSIGNED',
  ]) {
    test(`${reason} returns 422, skips I1 and leaves DB unchanged`, async () => {
      const valid = addUser();
      const id =
        reason === 'NOT_IN_ORGANIZATION'
          ? randomUUID()
          : addUser(
              reason === 'NOT_A_LEARNER'
                ? { role: 'Instructor' }
                : reason === 'ACCOUNT_DELETED'
                  ? { deletedAt: new Date().toISOString() }
                  : reason === 'ACCOUNT_DEACTIVATED'
                    ? { status: 'Deactivated' }
                    : {},
            );
      if (reason === 'ALREADY_ASSIGNED')
        assert.equal((await assign([id])).status, 201);
      const old = await rows();
      const oldEvents = await events();
      const calls = i1Calls;
      const result = await assign([valid, id]);
      assert.equal(result.status, 422);
      assert.equal(result.body.error.code, 'ASSIGNMENT_INVALID_LEARNERS');
      assert.deepEqual(result.body.error.errors, [{ learnerId: id, reason }]);
      assert.equal(i1Calls, calls);
      assert.deepEqual(await rows(), old);
      assert.deepEqual(await events(), oldEvents);
    });
  }

  test('Private course is assignable', async () => {
    assert.equal((await assign([addUser()], PRIVATE)).status, 201);
  });
  test('configured Draft/409 response returns 404 and creates no Learning records', async () => {
    courseStub.lock(PRIVATE, ORG, false, {
      status: 409,
      error: { code: 'COURSE_NOT_AVAILABLE', message: 'Draft fixture' },
    });
    const result = await assign([addUser()], PRIVATE);
    assert.equal(result.status, 404);
    assert.equal(result.body.error.code, 'COURSE_NOT_ASSIGNABLE');
    assert.deepEqual(await rows(), []);
    assert.deepEqual(await events(), []);
    assert.deepEqual(
      courseStub.calls.map(({ method, path, body }) => ({
        method,
        path,
        body,
      })),
      [
        {
          method: 'POST',
          path: `/${PRIVATE}/lock`,
          body: { selfEnroll: false },
        },
      ],
    );
    assert.equal(
      (
        await learningDb.query(
          'SELECT count(*)::int AS n FROM course_version_snapshots WHERE course_id=$1',
          [PRIVATE],
        )
      ).rows[0].n,
      0,
    );
  });
  test('501 ids, empty ids and malformed UUID return 400 before lookup', async () => {
    for (const ids of [
      Array.from({ length: 501 }, () => randomUUID()),
      [],
      ['bad'],
    ])
      assert.equal((await assign(ids)).status, 400);
    assert.equal(tenantCalls, 0);
    assert.equal(i1Calls, 0);
  });
  test('duplicates are collapsed', async () => {
    const id = addUser();
    const result = await assign([id, id, id.toUpperCase()]);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.created, 1);
    assert.equal((await rows()).length, 1);
  });
  test('non Organizer returns 403', async () => {
    const id = addUser();
    assert.equal((await assign([id], COURSE, learner(id))).status, 403);
    assert.equal(tenantCalls, 0);
  });
  test('inactive subscription returns 403 before lookup', async () => {
    subscriptionStatus = 'Grace';
    const result = await assign([addUser()]);
    assert.equal(result.status, 403);
    assert.equal(result.body.error.code, 'SUBSCRIPTION_NOT_ACTIVE');
    assert.equal(tenantCalls, 0);
    assert.equal(i1Calls, 0);
  });
  test('two assignments racing produce one Enrollment and loser 409 or 422', async () => {
    const id = addUser();
    const result = await Promise.all([assign([id]), assign([id])]);
    assert.equal(result.filter((r) => r.status === 201).length, 1);
    const loser = result.find((r) => r.status !== 201)!;
    assert.ok(loser.status === 409 || loser.status === 422);
    assert.ok(
      ['CONCURRENT_CHANGE', 'ASSIGNMENT_INVALID_LEARNERS'].includes(
        loser.body.error.code,
      ),
    );
    assert.equal((await rows()).length, 1);
    assert.equal((await events()).length, 1);
  });
  test('self enrollment racing assignment ends with exactly one Required enrollment', async () => {
    const id = addUser();
    const [assignment, self] = await Promise.all([
      assign([id]),
      call('enrollments', { courseId: COURSE }, learner(id)),
    ]);
    assert.equal(assignment.status, 201);
    assert.ok([201, 409].includes(self.status));
    const enrolled = await rows();
    assert.equal(enrolled.length, 1);
    assert.equal(enrolled[0].enrollment_type, 'Required');
  });

  test('Optional inserted after locked read retries transaction and converts without repeating lookup or I1', async () => {
    await prepare();
    const id = addUser();
    const repository = app.get(AssignmentsRepository);
    const original = repository.write.bind(repository);
    let writes = 0;
    const locksBefore = i1Calls;
    repository.write = async (plans, batch, tx) => {
      writes++;
      if (writes === 1)
        assert.equal(
          (await call('enrollments', { courseId: COURSE }, learner(id))).status,
          201,
        );
      return original(plans, batch, tx);
    };
    try {
      const result = await assign([id]);
      assert.equal(result.status, 201);
      assert.equal(result.body.data.converted, 1);
      assert.equal(writes, 2);
      assert.equal(tenantCalls, 1);
      assert.equal(i1Calls - locksBefore, 2); // Một I1 của phân công và một I1 của tự đăng ký.
      const enrolled = await rows();
      assert.equal(enrolled.length, 1);
      assert.equal(enrolled[0].enrollment_type, 'Required');
      assert.equal((await events()).length, 1);
    } finally {
      repository.write = original;
    }
  });

  test('500 learners among 50000: compare EXPLAIN before and after assignment rule changes', async () => {
    const ids = Array.from({ length: 500 }, () => addUser());
    const start = performance.now();
    const result = await assign(ids);
    console.log(
      `UC24.2 500 learners elapsed_ms=${(performance.now() - start).toFixed(3)}`,
    );
    assert.equal(result.status, 201);
    assert.equal(result.body.data.created, 500);
    assert.equal((await events()).length, 500);
    await learningDb.query(
      `INSERT INTO enrollments
      (id,organization_id,learner_id,course_id,enrollment_type,status,assigned_at,
       expected_completion_days,base_due_at,due_at,video_completion_percent)
      SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Required','NotStarted',now(),1,now(),now(),80
      FROM generate_series(1,49500)`,
      [ORG, COURSE],
    );
    await learningDb.query('ANALYZE enrollments');
    const existing = await app
      .get(AssignmentsRepository)
      .findExisting(ORG, COURSE, ids);
    const batch: AssignmentBatch = {
      organizationId: ORG,
      courseId: COURSE,
      assignedBy: ORGANIZER.userId,
      assignedAt: new Date(),
      dueAt: new Date(Date.now() + 86400000),
      expectedCompletionDays: 1,
      videoCompletionPercent: 80,
    };
    const read = existingEnrollmentsSql(ORG, COURSE, ids);
    const lockedRead = existingEnrollmentsSql(ORG, COURSE, ids, true);
    const update = updateAssignmentsSql(
      existing.map((row) => ({
        learnerId: row.learnerId,
        kind: 'CONVERT' as const,
        existing: row,
      })),
      batch,
    );
    const beforeRead = (query: Prisma.Sql) => ({
      text: query.text.replace('withdrawn_reason AS "withdrawnReason", ', ''),
      values: query.values,
    });
    const beforeUpdate = {
      text: update.text.replace(
        /due_at = (\$\d+)::timestamptz, extension_seconds = 0,/,
        "due_at = $1::timestamptz + e.extension_seconds * interval '1 second',",
      ),
      values: update.values,
    };
    assert.notEqual(beforeUpdate.text, update.text);
    const queries = [
      ['read-before', beforeRead(read)],
      ['read-after', read],
      ['locked-read-before', beforeRead(lockedRead)],
      ['locked-read-after', lockedRead],
      ['update-before', beforeUpdate],
      ['update-after', update],
      ['read', existingEnrollmentsSql(ORG, COURSE, ids)],
      ['locked-read', existingEnrollmentsSql(ORG, COURSE, ids, true)],
      [
        'insert',
        insertAssignmentsSql(
          ids.map((learnerId) => ({
            learnerId: randomUUID(),
            kind: 'CREATE' as const,
          })),
          batch,
          ids.map(() => randomUUID()),
        ),
      ],
      [
        'update',
        updateAssignmentsSql(
          existing.map((row) => ({
            learnerId: row.learnerId,
            kind: 'CONVERT' as const,
            existing: row,
          })),
          batch,
        ),
      ],
      [
        'outbox',
        Prisma.sql`INSERT INTO outbox_events
        (id, aggregate_type, aggregate_id, event_type, organization_id, payload, occurred_at)
        VALUES ${Prisma.join(
          (await events()).map(
            (event) => Prisma.sql`(
          ${randomUUID()}::uuid, 'Enrollment', ${event.aggregate_id}::uuid,
          'EnrollmentAssigned', ${ORG}::uuid, ${JSON.stringify(event.payload)}::jsonb, ${batch.assignedAt}::timestamptz)`,
          ),
        )}`,
      ],
    ] as const;
    for (const [name, query] of queries) {
      await learningDb.query('BEGIN');
      try {
        const plan = (
          await learningDb.query(
            `EXPLAIN (ANALYZE, FORMAT JSON) ${query.text}`,
            query.values,
          )
        ).rows[0]['QUERY PLAN'][0];
        console.log(`UC24.2 EXPLAIN ${name} ${JSON.stringify(plan)}`);
      } finally {
        await learningDb.query('ROLLBACK');
      }
    }
  });
});
