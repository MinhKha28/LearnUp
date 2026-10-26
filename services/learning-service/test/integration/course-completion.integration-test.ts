import { closeAll, closeApp } from './deadlines';
import { deadline, BARRIER_TIMEOUT_MS } from './deadlines';
import { testFetch as fetch } from './test-io';
import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from './test-runner';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { ASSESSMENT_COMPLETION_CLIENT } from '../../src/infrastructure/clients/assessment/assessment-completion.client';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CompletionRepository } from '../../src/modules/course-completion/completion.repository';
import { CompletionService } from '../../src/modules/course-completion/completion.service';
import { requestCompletion } from '../../src/modules/course-completion/completion-request';
import { FakeAssessmentCompletionClient } from '../../src/infrastructure/clients/assessment/assessment-completion.client';
import { readCompletionConfig } from '../../src/modules/course-completion/completion.config';
import { AssignmentsRepository } from '../../src/modules/assignments/assignments.repository';
import { OptionalEnrollmentRepository } from '../../src/modules/enrollments/optional-enrollment.repository';
import { MaterialProgressRepository } from '../../src/modules/material-progress/material-progress.repository';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing completion integration in production');
const prisma = new PrismaService(new ConfigService());
const org = randomUUID();
const repo = new CompletionRepository(
  prisma,
  readCompletionConfig(() => undefined),
);
const fake = new FakeAssessmentCompletionClient();
const service = new CompletionService(repo, fake);
before(async () => {
  await prisma.$connect();
});
after(async () => {
  try {
    await prisma.$executeRaw`DELETE FROM outbox_events WHERE organization_id=${org}::uuid`;
    await prisma.$executeRaw`DELETE FROM enrollments WHERE organization_id=${org}::uuid`;
    await prisma.$executeRaw`DELETE FROM material_snapshots WHERE organization_id=${org}::uuid`;
    await prisma.$executeRaw`DELETE FROM lesson_snapshots WHERE organization_id=${org}::uuid`;
    await prisma.$executeRaw`DELETE FROM organization_suspensions WHERE organization_id=${org}::uuid`;
    await prisma.$executeRaw`DELETE FROM course_version_snapshots WHERE organization_id=${org}::uuid`;
  } finally {
    await deadline(
      prisma.$disconnect(),
      'course-completion.integration-test shutdown',
    );
  }
});

for (const kind of ['CONVERT', 'RESTORE', 'CONVERT_COMPLETED'] as const)
  test(`assignment ${kind} preserves assigned payload and completion uniqueness`, async () => {
    const f = await fixture(
      kind === 'RESTORE'
        ? 'Withdrawn'
        : kind === 'CONVERT_COMPLETED'
          ? 'Completed'
          : 'InProgress',
    );
    await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
    const assignments = new AssignmentsRepository(prisma);
    await prisma.$transaction((tx) =>
      assignments.write(
        [
          {
            kind,
            learnerId: f.learner,
            existing: {
              id: f.id,
              learnerId: f.learner,
              enrollmentType: 'Optional',
              status:
                kind === 'RESTORE'
                  ? 'Withdrawn'
                  : kind === 'CONVERT_COMPLETED'
                    ? 'Completed'
                    : 'InProgress',
              firstActivityAt: kind === 'CONVERT' ? new Date() : null,
              withdrawnReason: kind === 'RESTORE' ? 'LearnerWithdrew' : null,
            },
          },
        ],
        {
          organizationId: org,
          courseId: f.course,
          assignedBy: randomUUID(),
          assignedAt: new Date(),
          dueAt: new Date(Date.now() + 86400000),
          expectedCompletionDays: 1,
          videoCompletionPercent: 80,
        },
        tx,
      ),
    );
    if (kind !== 'CONVERT_COMPLETED') await service.evaluate(await take(f.id));
    else
      assert.equal(
        (await repo.claim()).some((r) => r.enrollment_id === f.id),
        false,
      );
    assert.equal((await state(f.id)).status, 'Completed');
    assert.equal(await eventCount(f.id), kind === 'CONVERT_COMPLETED' ? 0 : 1);
    const [event] = await prisma.$queryRaw<
      { payload: { kind: string } }[]
    >`SELECT payload FROM outbox_events WHERE aggregate_id=${f.id}::uuid AND event_type='EnrollmentAssigned'`;
    assert.equal(event.payload.kind, kind);
  });
test('Optional restore enqueues transactionally', async () => {
  const f = await fixture('Withdrawn');
  await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  await prisma.$transaction((tx) =>
    new OptionalEnrollmentRepository(prisma).restore(tx, {
      id: f.id,
      courseId: f.course,
      learnerId: f.learner,
      organizationId: org,
      enrollmentType: 'Optional',
      status: 'Withdrawn',
      withdrawnReason: 'LearnerWithdrew',
    }),
  );
  await service.evaluate(await take(f.id));
  assert.equal(await eventCount(f.id), 1);
});
for (const mode of [
  'required',
  'optional',
  'disabled-material',
  'disabled-lesson',
])
  test(`local material ${mode}`, async () => {
    const f = await fixture();
    const material = randomUUID(),
      lesson = randomUUID();
    await prisma.$executeRaw`INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,disabled_at,disabled_as_of)
    VALUES (${material}::uuid,${org}::uuid,${f.course}::uuid,${lesson}::uuid,'Reading',${mode !== 'optional'},${mode === 'disabled-material' ? new Date() : null},now())`;
    if (mode === 'disabled-lesson')
      await prisma.$executeRaw`INSERT INTO lesson_snapshots(lesson_id,organization_id,course_id,disabled_at,disabled_as_of)
    VALUES (${lesson}::uuid,${org}::uuid,${f.course}::uuid,now(),now())`;
    await service.evaluate(await take(f.id));
    assert.equal(
      (await state(f.id)).status,
      mode === 'required' ? 'NotStarted' : 'Completed',
    );
  });
for (const duty of ['Pending', 'Missed', 'Satisfied', 'unfinalized'])
  test(`assignment snapshot ${duty}`, async () => {
    const f = await fixture();
    const good = duty === 'Satisfied';
    fake.fixtures.set(f.key, {
      value: {
        ...f.snapshot,
        quizzes: [],
        eligible: good,
        assignments: [
          {
            assessmentId: randomUUID(),
            submissionId: randomUUID(),
            finalScore: duty === 'unfinalized' ? null : '90',
            passingScore: '80',
            finalizedAt:
              duty === 'unfinalized' ? null : new Date().toISOString(),
            passed: duty !== 'unfinalized',
            peerReview: {
              status: duty === 'unfinalized' ? 'Satisfied' : duty,
              requiredCount: 2,
              completedCount:
                duty === 'Satisfied' || duty === 'unfinalized' ? 2 : 0,
            },
          },
        ],
      },
    });
    await service.evaluate(await take(f.id));
    assert.equal((await state(f.id)).status, good ? 'Completed' : 'NotStarted');
  });
test('outbox INSERT failure rolls back Completed and retains request', async () => {
  const f = await fixture();
  const r = await take(f.id);
  // A separate Prisma client avoids replacing the shared client's transaction method.
  const isolated = new PrismaService(new ConfigService());
  const original = isolated.$transaction.bind(isolated);
  const broken = new Proxy(isolated, {
    get(target, property) {
      if (property === '$transaction')
        return (work: (tx: unknown) => Promise<unknown>, options: unknown) =>
          original(
            async (tx) =>
              work(
                new Proxy(tx, {
                  get(t, p) {
                    if (p === 'outboxEvent')
                      return {
                        create: async () => {
                          throw new Error('synthetic insert failure');
                        },
                      };
                    const v = Reflect.get(t, p);
                    return typeof v === 'function' ? v.bind(t) : v;
                  },
                }),
              ),
            options as never,
          );
      const v = Reflect.get(target, property);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  try {
    await new CompletionService(
      new CompletionRepository(broken, repo.config),
      fake,
    ).evaluate(r);
  } finally {
    await deadline(isolated.$disconnect(), 'isolated Prisma shutdown');
  }
  assert.equal((await state(f.id)).status, 'NotStarted');
  assert.equal(await eventCount(f.id), 0);
  const [pending] = await prisma.$queryRaw<
    { attempts: bigint }[]
  >`SELECT attempts FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  assert.equal(pending.attempts, 1n);
  await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
});
async function fixture(
  status = 'NotStarted',
  type = 'Optional',
  dueOffset = 86400000,
) {
  const id = randomUUID(),
    learner = randomUUID(),
    course = randomUUID();
  await prisma.$executeRaw`INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of)
    VALUES (${course}::uuid,${org}::uuid,${course}::uuid,now(),now())`;
  const assigned = type === 'Required' ? new Date(Date.now() - 86400000) : null;
  const due = type === 'Required' ? new Date(Date.now() + dueOffset) : null;
  await prisma.$executeRaw`INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent,
    assigned_at,expected_completion_days,base_due_at,due_at,first_activity_at,completed_at,completed_late,withdrawn_at,withdrawn_reason)
    VALUES (${id}::uuid,${org}::uuid,${learner}::uuid,${course}::uuid,${type},${status},80,${assigned},${assigned ? 1 : null},${due},${due},
      ${status === 'InProgress' ? new Date() : null},${status === 'Completed' ? new Date() : null},${status === 'Completed' && assigned ? false : null},
      ${status === 'Withdrawn' ? new Date() : null},${status === 'Withdrawn' ? 'LearnerWithdrew' : null})`;
  const snapshot = {
    schemaVersion: 1,
    snapshotId: randomUUID(),
    asOf: new Date().toISOString(),
    revision: '1',
    organizationId: org,
    learnerId: learner,
    courseId: course,
    eligible: true,
    requiredComponentCount: 1,
    quizzes: [
      {
        assessmentId: randomUUID(),
        attemptId: randomUUID(),
        recordedScore: '90',
        passingScore: '80',
        passed: true,
      },
    ],
    assignments: [],
  };
  const key = [org, learner, course].join('/');
  fake.fixtures.set(key, { value: snapshot });
  const enqueue = () =>
    prisma.$transaction((tx) =>
      requestCompletion(tx, org, id, 'OPTIONAL_RESTORE'),
    );
  await enqueue();
  return { id, learner, course, snapshot, key, enqueue };
}
async function take(id: string) {
  const r = (await repo.claim()).find((row) => row.enrollment_id === id);
  assert.ok(r, 'fixture request must be claimed');
  return r;
}
async function state(id: string) {
  return (
    await prisma.$queryRaw<
      {
        status: string;
        completion_snapshot: unknown;
        completed_late: boolean | null;
      }[]
    >`SELECT status,completion_snapshot,completed_late FROM enrollments WHERE id=${id}::uuid`
  )[0];
}
async function eventCount(id: string) {
  return Number(
    (
      await prisma.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) FROM outbox_events WHERE aggregate_id=${id}::uuid AND event_type='EnrollmentCompleted'`
    )[0].count,
  );
}
for (const status of [
  'NotStarted',
  'InProgress',
  'Exempted',
  'Halted',
  'Withdrawn',
  'Completed',
])
  test(`completion status ${status}`, async () => {
    const f = await fixture(
      status,
      status === 'Exempted' ? 'Required' : 'Optional',
    );
    if (status === 'Exempted')
      await prisma.$executeRaw`INSERT INTO enrollment_status_intervals(id,organization_id,enrollment_id,kind,started_at,reason)
    VALUES (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted',now()-interval '1 hour','synthetic test')`;
    await service.evaluate(await take(f.id));
    assert.equal(
      (await state(f.id)).status,
      ['Halted', 'Withdrawn'].includes(status) ? status : 'Completed',
    );
    assert.equal(
      await eventCount(f.id),
      ['Halted', 'Withdrawn', 'Completed'].includes(status) ? 0 : 1,
    );
  });
test('lease abandoned after claim can be reclaimed; old generation cannot complete twice', async () => {
  const f = await fixture();
  const abandoned = await take(f.id);
  await prisma.$executeRaw`UPDATE completion_evaluation_requests SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE enrollment_id=${f.id}::uuid`;
  const reclaimed = await take(f.id);
  assert.ok(reclaimed.expired);
  assert.ok(reclaimed.generation > abandoned.generation);
  await Promise.all([service.evaluate(abandoned), service.evaluate(reclaimed)]);
  assert.equal(await eventCount(f.id), 1);
  assert.equal((await state(f.id)).status, 'Completed');
});
test('trigger during assessment wait survives obsolete result and is evaluated once', async () => {
  const f = await fixture();
  const r = await take(f.id);
  let entered!: () => void;
  let release!: () => void;
  const waiting = deadline(
    new Promise<void>((resolve) => {
      entered = resolve;
    }),
    'course-completion.integration-test: waiting',
    BARRIER_TIMEOUT_MS,
  );
  const barrier = deadline(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
    'course-completion.integration-test: barrier',
    BARRIER_TIMEOUT_MS,
  );
  const blocked = new CompletionService(repo, {
    async getCompletionSnapshot() {
      entered();
      await barrier;
      return fake.getCompletionSnapshot(org, f.learner, f.course);
    },
  });
  const processing = blocked.evaluate(r);
  await waiting;
  await f.enqueue();
  release();
  await processing;
  assert.equal((await state(f.id)).status, 'NotStarted');
  await service.evaluate(await take(f.id));
  assert.equal(await eventCount(f.id), 1);
});
test('timeout backs off, new signal bypasses backoff, recovered snapshot is immutable', async () => {
  const f = await fixture();
  fake.fixtures.set(f.key, { value: f.snapshot, unavailable: true });
  await service.evaluate(await take(f.id));
  const [request] = await prisma.$queryRaw<
    { attempts: bigint; delayed: boolean }[]
  >`SELECT attempts,next_attempt_at>clock_timestamp() AS delayed FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  assert.equal(request.attempts, 1n);
  assert.equal(request.delayed, true);
  assert.equal((await state(f.id)).status, 'NotStarted');
  fake.fixtures.set(f.key, { value: f.snapshot });
  await f.enqueue();
  await service.evaluate(await take(f.id));
  const saved = (await state(f.id)).completion_snapshot;
  f.snapshot.quizzes[0].recordedScore = '99';
  await f.enqueue();
  await service.evaluate(await take(f.id));
  assert.deepEqual((await state(f.id)).completion_snapshot, saved);
  assert.equal(await eventCount(f.id), 1);
});
for (const late of [false, true])
  test(`Required late=${late}`, async () => {
    const f = await fixture('InProgress', 'Required', late ? -1000 : 86400000);
    await service.evaluate(await take(f.id));
    assert.equal((await state(f.id)).completed_late, late);
  });
test('Course Disabled and empty aggregate never complete', async () => {
  const f = await fixture();
  await prisma.$executeRaw`UPDATE course_version_snapshots SET disabled_at=now() WHERE course_id=${f.course}::uuid`;
  await service.evaluate(await take(f.id));
  assert.equal((await state(f.id)).status, 'NotStarted');
  const empty = await fixture();
  fake.fixtures.set(empty.key, {
    value: { ...empty.snapshot, quizzes: [], requiredComponentCount: 0 },
  });
  await service.evaluate(await take(empty.id));
  assert.equal((await state(empty.id)).status, 'NotStarted');
});

test('effective deadline unions overlapping pauses and keeps extensions', async () => {
  const f = await fixture('Exempted', 'Required', -3600000);
  const assigned = new Date(Date.now() - 86400000),
    base = new Date(Date.now() - 3600000);
  await prisma.$executeRaw`UPDATE enrollments SET assigned_at=${assigned},base_due_at=${base},due_at=${new Date(base.getTime() + 1800000)},extension_seconds=1800 WHERE id=${f.id}::uuid`;
  await prisma.$executeRaw`INSERT INTO enrollment_status_intervals(id,organization_id,enrollment_id,kind,started_at,ended_at,reason)
    VALUES (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted',${new Date(Date.now() - 7200000)},${new Date(Date.now() - 3600000)},'synthetic overlap'),
      (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted',${new Date(Date.now() - 5400000)},NULL,'synthetic open')`;
  await service.evaluate(await take(f.id));
  const [row] = await prisma.$queryRaw<
    { due_at: Date; completed_at: Date; completed_late: boolean }[]
  >`SELECT due_at,completed_at,completed_late FROM enrollments WHERE id=${f.id}::uuid`;
  assert.ok(row.due_at > row.completed_at);
  assert.equal(row.completed_late, false);
  // Two hours in the union plus thirty minutes extension, not 2.5 hours of overlapping intervals.
  assert.ok(Math.abs(row.due_at.getTime() - base.getTime() - 9000000) < 2000);
  const [open] = await prisma.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) FROM enrollment_status_intervals WHERE enrollment_id=${f.id}::uuid AND ended_at IS NULL`;
  assert.equal(open.count, 0n);
});
test('stale failure cannot overwrite immediate eligibility time of a new trigger', async () => {
  const f = await fixture();
  const old = await take(f.id);
  await f.enqueue();
  assert.equal(await repo.retry(old, 'ASSESSMENT_UNAVAILABLE'), 0);
  await service.evaluate(await take(f.id));
  assert.equal(await eventCount(f.id), 1);
});
test('two concurrent claimers get disjoint work', async () => {
  const f = await fixture();
  const other = new CompletionRepository(prisma, repo.config);
  const [a, b] = await Promise.all([repo.claim(), other.claim()]);
  assert.equal([...a, ...b].filter((r) => r.enrollment_id === f.id).length, 1);
  await Promise.all(
    [...a, ...b]
      .filter((r) => r.enrollment_id === f.id)
      .map((r) => service.evaluate(r)),
  );
  assert.equal(await eventCount(f.id), 1);
});

test('expired lease while old worker writes cannot let a second worker duplicate completion', async () => {
  const f = await fixture(),
    r = await take(f.id);
  await prisma.$executeRaw`UPDATE completion_evaluation_requests SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE enrollment_id=${f.id}::uuid`;
  let entered!: () => void;
  let release!: () => void;
  const inside = deadline(
    new Promise<void>((resolve) => {
      entered = resolve;
    }),
    'course-completion.integration-test: inside',
    BARRIER_TIMEOUT_MS,
  );
  const barrier = deadline(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
    'course-completion.integration-test: barrier',
    BARRIER_TIMEOUT_MS,
  );
  const isolated = new PrismaService(new ConfigService()),
    original = isolated.$transaction.bind(isolated);
  const paused = new Proxy(isolated, {
    get(target, property) {
      if (property === '$transaction')
        return (work: (tx: unknown) => Promise<unknown>, options: unknown) =>
          original(
            async (tx) =>
              work(
                new Proxy(tx, {
                  get(t, p) {
                    if (p === 'outboxEvent')
                      return {
                        create: async (
                          args: Parameters<typeof tx.outboxEvent.create>[0],
                        ) => {
                          entered();
                          await barrier;
                          return tx.outboxEvent.create(args);
                        },
                      };
                    const v = Reflect.get(t, p);
                    return typeof v === 'function' ? v.bind(t) : v;
                  },
                }),
              ),
            options as never,
          );
      const v = Reflect.get(target, property);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  const processing = new CompletionService(
    new CompletionRepository(paused, repo.config),
    fake,
  ).evaluate(r);
  try {
    await inside;
    assert.equal(
      (await repo.claim()).some((row) => row.enrollment_id === f.id),
      false,
    );
  } finally {
    release();
    await processing;
    await deadline(isolated.$disconnect(), 'isolated Prisma shutdown');
  }
  assert.equal((await state(f.id)).status, 'Completed');
  assert.equal(await eventCount(f.id), 1);
});
test('invalid contract increments attempts without completing', async () => {
  const f = await fixture();
  fake.fixtures.set(f.key, {
    value: { ...f.snapshot, organizationId: randomUUID() },
  });
  await service.evaluate(await take(f.id));
  const [row] = await prisma.$queryRaw<
    { attempts: bigint; last_error: string }[]
  >`SELECT attempts,last_error FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  assert.equal(row.attempts, 1n);
  assert.equal(row.last_error, 'INVALID_SNAPSHOT');
  assert.equal((await state(f.id)).status, 'NotStarted');
  await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
});

test('two concurrent Video completions enqueue only on the first transition', async () => {
  const f = await fixture(),
    material = randomUUID(),
    lesson = randomUUID();
  await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  await prisma.$executeRaw`INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,duration_seconds,duration_as_of,disabled_as_of)
    VALUES (${material}::uuid,${org}::uuid,${f.course}::uuid,${lesson}::uuid,'Video',true,100,now(),now())`;
  const video = new MaterialProgressRepository(prisma);
  const finish = () =>
    prisma.$transaction(async (tx) => {
      await video.access(f.id, f.learner, org, tx);
      await video.lock(f.id, material, org, tx);
      const preview = await video.preview(f.id, material, org, [[0, 80]], tx);
      if (preview.newSeconds > 0)
        await video.save(f.id, material, org, preview, 80, [[0, 80]], tx);
    });
  await Promise.all([finish(), finish()]);
  const [request] = await prisma.$queryRaw<
    { generation: bigint }[]
  >`SELECT generation FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  assert.equal(request.generation, 0n);
  await service.evaluate(await take(f.id));
  assert.equal(await eventCount(f.id), 1);
});
test('API starts with Kafka and course-service unreachable and retains assessment outage work until recovery', async () => {
  const previous = {
    worker: process.env.COMPLETION_WORKER_ENABLED,
    relay: process.env.OUTBOX_RELAY_ENABLED,
    brokers: process.env.KAFKA_BROKERS,
    course: process.env.COURSE_SERVICE_URL,
  };
  process.env.COMPLETION_WORKER_ENABLED = 'true';
  process.env.OUTBOX_RELAY_ENABLED = 'true';
  process.env.KAFKA_BROKERS = '127.0.0.1:1';
  process.env.COURSE_SERVICE_URL = 'http://127.0.0.1:1';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  try {
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const f = await fixture();
    const client = app.get<FakeAssessmentCompletionClient>(
      ASSESSMENT_COMPLETION_CLIENT,
    );
    client.fixtures.set(f.key, { value: f.snapshot, unavailable: true });
    const result = await fetch(
      `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1/enrollments/me/course-ids`,
      {
        headers: {
          'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
          'x-organization-id': org,
          'x-user-id': f.learner,
          'x-user-role': 'LEARNER',
        },
      },
    );
    assert.equal(result.status, 200);
    const deadline = Date.now() + 15000;
    let attempts = 0n;
    while (Date.now() < deadline) {
      const [row] = await prisma.$queryRaw<
        { attempts: bigint }[]
      >`SELECT attempts FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
      attempts = row?.attempts ?? 0n;
      if (attempts > 0n) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(attempts > 0n);
    assert.equal((await state(f.id)).status, 'NotStarted');
    client.fixtures.set(f.key, { value: f.snapshot });
    await f.enqueue();
    while (Date.now() < deadline && (await state(f.id)).status !== 'Completed')
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal((await state(f.id)).status, 'Completed');
    assert.equal(await eventCount(f.id), 1);
  } finally {
    try {
      await closeAll(() => closeApp(app));
    } finally {
      for (const [key, value] of Object.entries({
        COMPLETION_WORKER_ENABLED: previous.worker,
        OUTBOX_RELAY_ENABLED: previous.relay,
        KAFKA_BROKERS: previous.brokers,
        COURSE_SERVICE_URL: previous.course,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
});
