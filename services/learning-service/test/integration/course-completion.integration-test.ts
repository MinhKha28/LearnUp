import { Logger } from '@nestjs/common';
import { AssessmentStatusConsumer } from '../../src/modules/assessment-status/assessment-status.consumer';
import { AssessmentStatusRepository } from '../../src/modules/assessment-status/assessment-status.repository';
import { readAssessmentStatusConfig } from '../../src/modules/assessment-status/assessment-status.config';
import { mock } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  createCompletionClient,
  type CompletionSnapshot,
} from '../../src/infrastructure/clients/assessment/assessment-completion.client';
import { AssignmentChangesRepository } from '../../src/modules/assignments/assignment-changes.repository';
import { BaseDueAtRepository } from '../../src/modules/enrollments/base-due-at.repository';
import { validateExtension } from '../../src/modules/assignments/assignment-change-rules';
import { closeAll, closeApp } from './deadlines';
import { deadline, BARRIER_TIMEOUT_MS } from './deadlines';
import { testFetch as fetch } from './test-io';
import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from './test-runner';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
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
    await prisma.$executeRaw`DELETE FROM assessment_event_quarantine WHERE topic=${'l18-' + org}`;
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

for (const [eventStatus, status] of [
  ['Submitted', 'NotStarted'],
  ['Submitted', 'InProgress'],
  ['Submitted', 'Exempted'],
  ['Submitted', 'Halted'],
  ['Submitted', 'Withdrawn'],
  ['Submitted', 'Completed'],
  ['Submitted', 'Exempted-ineligible'],
  ['Started', 'NotStarted'],
  ['Started', 'Exempted'],
  ['Started', 'Halted'],
  ['Started', 'Withdrawn'],
  ['Started', 'Completed'],
] as const)
  void test(`assessment ${eventStatus} queues ${status} and preserves worker status rules`, async () => {
    const initial = status === 'Exempted-ineligible' ? 'Exempted' : status;
    const f = await fixture(
      initial,
      initial === 'Exempted' ? 'Required' : 'Optional',
    );
    await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
    if (initial === 'Exempted')
      await prisma.$executeRaw`INSERT INTO enrollment_status_intervals(id,organization_id,enrollment_id,kind,started_at,reason)
        VALUES (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted',now()-interval '1 hour','synthetic assessment fixture')`;
    if (status === 'Exempted-ineligible')
      fake.fixtures.set(f.key, {
        value: {
          ...f.snapshot,
          eligible: false,
          quizzes: [
            { ...f.snapshot.quizzes[0], recordedScore: '10', passed: false },
          ],
        },
      });
    const consumer = new AssessmentStatusConsumer(
      new AssessmentStatusRepository(prisma),
      readAssessmentStatusConfig(() => undefined),
    );
    const input = {
      eventId: randomUUID(),
      eventType: 'LearnerAssessmentStatusChanged',
      version: 1,
      occurredAt: '2026-10-30T12:00:00.000Z',
      organizationId: org,
      producer: 'assessment-service',
      data: {
        assessmentId: f.snapshot.quizzes[0].assessmentId,
        organizationId: org,
        learnerId: f.learner,
        courseId: f.course,
        kind: eventStatus === 'Started' ? 'QUIZ' : 'ASSIGNMENT',
        status: eventStatus,
        reason:
          eventStatus === 'Started' ? 'QUIZ_STARTED' : 'ASSIGNMENT_SUBMITTED',
        revision: 'arbitrary-unordered-hash',
        firstActivityAt: '2026-10-29T12:00:00.000Z',
      },
    };
    const delivery = {
      topic: 'l18-' + org,
      partition: 0,
      offset: '1',
      value: Buffer.from(JSON.stringify(input)),
    };
    let commits = 0;
    const commit = async () => {
      // A separate query sees the committed transaction before acknowledgement.
      const rows = await prisma.$queryRaw<
        { source: string; generation: bigint }[]
      >`SELECT source,generation FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
      assert.equal(rows.length, 1);
      const [q] = rows;
      assert.equal(q.source, 'assessment');
      assert.equal(q.generation, BigInt(commits));
      commits++;
    };
    await consumer.handle(delivery, commit);
    assert.equal(
      (await state(f.id)).status,
      initial === 'NotStarted' ? 'InProgress' : initial,
    );
    const [beforeDuplicate] = await prisma.$queryRaw<
      { first_activity_at: Date | null }[]
    >`SELECT first_activity_at FROM enrollments WHERE id=${f.id}::uuid`;
    if (eventStatus === 'Started') {
      assert.deepEqual(
        beforeDuplicate.first_activity_at,
        initial === 'NotStarted' || initial === 'Exempted'
          ? new Date(input.data.firstActivityAt)
          : null,
      );
    }
    await consumer.handle(delivery, commit);
    const [afterDuplicate] = await prisma.$queryRaw<
      { first_activity_at: Date | null }[]
    >`SELECT first_activity_at FROM enrollments WHERE id=${f.id}::uuid`;
    assert.deepEqual(afterDuplicate, beforeDuplicate);
    assert.equal(commits, 2);
    if (eventStatus === 'Started' && initial === 'NotStarted') {
      const later = {
        ...input,
        eventId: randomUUID(),
        occurredAt: '2026-10-31T12:00:00.000Z',
        data: { ...input.data, firstActivityAt: input.occurredAt },
      };
      await consumer.handle(
        { ...delivery, offset: '2', value: Buffer.from(JSON.stringify(later)) },
        commit,
      );
      const [afterLater] = await prisma.$queryRaw<
        { first_activity_at: Date | null }[]
      >`SELECT first_activity_at FROM enrollments WHERE id=${f.id}::uuid`;
      assert.deepEqual(afterLater, beforeDuplicate);
      assert.equal(commits, 3);
    }
    await service.evaluate(await take(f.id));
    const expected = [
      'Halted',
      'Withdrawn',
      'Completed',
      'Exempted-ineligible',
    ].includes(status)
      ? initial
      : 'Completed';
    assert.equal((await state(f.id)).status, expected);
    if (status === 'Exempted-ineligible')
      assert.equal(await eventCount(f.id), 0);
  });

for (const [status, reason] of [
  ['PeerReviewAssigned', 'PEER_REVIEW_ASSIGNED'],
  ['PeerReviewMissed', 'PEER_REVIEW_MISSED'],
  ['Finalized', 'ASSIGNMENT_FINALIZED'],
] as const)
  void test(`assessment ${status} commits re-evaluation without activating enrollment`, async () => {
    const f = await fixture();
    await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
    const consumer = new AssessmentStatusConsumer(
      new AssessmentStatusRepository(prisma),
      readAssessmentStatusConfig(() => undefined),
    );
    const input = {
      eventId: randomUUID(),
      eventType: 'LearnerAssessmentStatusChanged',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: org,
      producer: 'assessment-service',
      data: {
        assessmentId: randomUUID(),
        learnerId: f.learner,
        courseId: f.course,
        kind: 'ASSIGNMENT',
        status,
        reason,
        ...(status === 'Finalized'
          ? { submissionId: 'unread', finalScore: 'abc', finalizedAt: 'unread' }
          : {}),
        firstActivityAt: '2026-10-29T12:00:00.000Z',
      },
    };
    let commits = 0;
    const delivery = {
      topic: 'l18-' + org,
      partition: 3,
      offset: status === 'PeerReviewAssigned' ? '0' : '1',
      value: Buffer.from(JSON.stringify(input)),
    };
    const commit = async () => {
      // Independent reads observe both effects before Kafka acknowledgement.
      const [row] = await prisma.$queryRaw<
        { status: string; first_activity_at: Date | null; source: string }[]
      >`SELECT e.status,e.first_activity_at,q.source
          FROM enrollments e JOIN completion_evaluation_requests q ON q.enrollment_id=e.id
          WHERE e.id=${f.id}::uuid`;
      assert.deepEqual(row, {
        status: 'NotStarted',
        first_activity_at: null,
        source: 'assessment',
      });
      commits++;
    };
    await consumer.handle(delivery, commit);
    assert.equal(commits, 1);
    await consumer.handle(delivery, commit);
    const [queue] = await prisma.$queryRaw<
      { count: bigint; generation: bigint }[]
    >`
      SELECT count(*) AS count, min(generation) AS generation
      FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
    assert.deepEqual(queue, { count: 1n, generation: 1n });
    assert.equal(commits, 2);
  });
void test('assessment handler durably quarantines poison and missing enrollment, including Started; duplicate delivery adds no row', async () => {
  const consumer = new AssessmentStatusConsumer(
    new AssessmentStatusRepository(prisma),
    readAssessmentStatusConfig(() => undefined),
  );
  const valid = {
    eventId: randomUUID(),
    eventType: 'LearnerAssessmentStatusChanged',
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId: org,
    producer: 'assessment-service',
    data: {
      assessmentId: randomUUID(),
      learnerId: randomUUID(),
      courseId: randomUUID(),
      kind: 'QUIZ',
      status: 'Resubmitted',
    },
  };
  const missing = { ...valid, data: { ...valid.data, courseId: undefined } };
  let commits = 0;
  for (const [index, input] of [
    valid,
    {
      ...valid,
      eventId: randomUUID(),
      data: { ...valid.data, status: 'Started', reason: 'QUIZ_STARTED' },
    },
    missing,
    {},
    '{',
    { eventId: 'bad\0id', invalid: '\ud800' },
    { ...valid, data: { ...valid.data, status: 'FutureStatus' } },
    {
      ...valid,
      data: {
        ...valid.data,
        kind: 'ASSIGNMENT',
        status: 'Finalized',
        reason: 'ASSIGNMENT_SUBMITTED',
      },
    },
  ].entries()) {
    const d = {
      topic: 'l18-' + org,
      partition: 1,
      offset: String(index),
      value: Buffer.from(
        typeof input === 'string' ? input : JSON.stringify(input),
      ),
    };
    const commit = async () => {
      const [row] = await prisma.$queryRaw<
        { reason: string }[]
      >`SELECT reason FROM assessment_event_quarantine WHERE topic=${d.topic} AND partition=1 AND "offset"=${BigInt(index)}`;
      assert.equal(
        row.reason,
        [
          'ENROLLMENT_NOT_FOUND',
          'ENROLLMENT_NOT_FOUND',
          'MISSING_COURSE_ID',
          'INVALID_ENVELOPE',
          'INVALID_JSON',
          'INVALID_ENVELOPE',
          'INVALID_PAYLOAD',
          'INVALID_PAYLOAD',
        ][index],
      );
      commits++;
    };
    await consumer.handle(d, commit);
    await consumer.handle(d, commit);
  }
  const [count] = await prisma.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) FROM assessment_event_quarantine WHERE topic=${'l18-' + org}`;
  assert.equal(count.count, 8n);
  assert.equal(commits, 16);
});
void test('assessment queue SQL failure rolls back activation and prevents offset commit', async () => {
  const f = await fixture();
  await prisma.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  const transaction = prisma.$transaction.bind(prisma);
  const broken = new Proxy(prisma, {
    get(target, property) {
      if (property === '$transaction')
        return (work: (tx: unknown) => Promise<unknown>) =>
          transaction(async (tx) =>
            work(
              new Proxy(tx, {
                get(t, p) {
                  if (p === '$executeRaw')
                    return (sql: TemplateStringsArray, ...values: unknown[]) =>
                      Array.isArray(sql) &&
                      sql
                        .join('')
                        .includes('INSERT INTO completion_evaluation_requests')
                        ? tx.$executeRaw`SELECT 1/0`
                        : tx.$executeRaw(sql, ...values);
                  const value: unknown = Reflect.get(t, p);
                  return (
                    typeof value === 'function' ? value.bind(t) : value
                  ) as unknown;
                },
              }),
            ),
          );
      const value: unknown = Reflect.get(target, property);
      return (
        typeof value === 'function' ? value.bind(target) : value
      ) as unknown;
    },
  });
  const consumer = new AssessmentStatusConsumer(
    new AssessmentStatusRepository(broken),
    readAssessmentStatusConfig(() => undefined),
  );
  const value = {
    eventId: randomUUID(),
    eventType: 'LearnerAssessmentStatusChanged',
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId: org,
    producer: 'assessment-service',
    data: {
      learnerId: f.learner,
      courseId: f.course,
      assessmentId: randomUUID(),
      kind: 'QUIZ',
      status: 'Submitted',
    },
  };
  let committed = false;
  await assert.rejects(
    consumer.handle(
      {
        topic: 'l18-' + org,
        partition: 2,
        offset: '0',
        value: Buffer.from(JSON.stringify(value)),
      },
      () => {
        committed = true;
        return Promise.resolve();
      },
    ),
  );
  assert.equal(committed, false);
  assert.equal((await state(f.id)).status, 'NotStarted');
  const [e] = await prisma.$queryRaw<
    { first_activity_at: Date | null; pending: bigint }[]
  >`SELECT first_activity_at,
    (SELECT count(*) FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid) AS pending FROM enrollments WHERE id=${f.id}::uuid`;
  assert.equal(e.first_activity_at, null);
  assert.equal(e.pending, 0n);
});

for (const kind of ['CONVERT', 'RESTORE', 'CONVERT_COMPLETED'] as const)
  void test(`assignment ${kind} preserves assigned payload and completion uniqueness`, async () => {
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
          dueTimezone: 'Asia/Ho_Chi_Minh',
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
void test('Optional restore enqueues transactionally', async () => {
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
  void test(`local material ${mode}`, async () => {
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
  void test(`assignment snapshot ${duty}`, async () => {
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
void test('outbox INSERT failure rolls back Completed and retains request', async () => {
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
                        create: () =>
                          Promise.reject(new Error('synthetic insert failure')),
                      };
                    const v: unknown = Reflect.get(t, p);
                    return (typeof v === 'function' ? v.bind(t) : v) as unknown;
                  },
                }),
              ),
            options as never,
          );
      const v: unknown = Reflect.get(target, property);
      return (typeof v === 'function' ? v.bind(target) : v) as unknown;
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
    assigned_at,expected_completion_days,base_due_at,due_at,first_activity_at,completed_at,completed_late,withdrawn_at,withdrawn_reason,due_timezone)
    VALUES (${id}::uuid,${org}::uuid,${learner}::uuid,${course}::uuid,${type},${status},80,${assigned},${assigned ? 1 : null},${due},${due},
      ${status === 'InProgress' ? new Date() : null},${status === 'Completed' ? new Date() : null},${status === 'Completed' && assigned ? false : null},
      ${status === 'Withdrawn' ? new Date() : null},${status === 'Withdrawn' ? 'LearnerWithdrew' : null},CASE WHEN (${due})::timestamptz IS NULL THEN NULL ELSE 'Asia/Ho_Chi_Minh' END )`;
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
test('Persists the precise completion time and classifies the deadline boundary', async () => {
  const fixed = '2030-01-02T03:04:05.123456Z';
  const evaluator = new CompletionService(repo, fake, () => Prisma.sql`${fixed}::timestamptz`);
  for (const [microseconds, expectedLate] of [[0, true], [1, false]] as const) {
    const f = await fixture('NotStarted', 'Required');
    await prisma.$executeRaw`
      UPDATE enrollments SET base_due_at = ${fixed}::timestamptz + ${microseconds}::int * interval '1 microsecond',
                             due_at = ${fixed}::timestamptz + ${microseconds}::int * interval '1 microsecond'
      WHERE id = ${f.id}::uuid`;
    await evaluator.evaluate(await take(f.id));
    const [stored] = await prisma.$queryRaw<
      { exactTime: boolean; late: boolean; payload: { completedAt: string; occurredAt: string; completedLate: boolean } }[]
    >`
      SELECT e.completed_at = ${fixed}::timestamptz AS "exactTime", e.completed_late AS late, o.payload
      FROM enrollments e JOIN outbox_events o ON o.aggregate_id = e.id AND o.event_type = 'EnrollmentCompleted'
      WHERE e.id = ${f.id}::uuid`;
    assert.equal(stored?.exactTime, true);
    assert.equal(stored.late, expectedLate);
    assert.equal(stored.payload.completedLate, expectedLate);
    assert.equal(stored.payload.completedAt, '2030-01-02T03:04:05.123Z');
    assert.equal(stored.payload.occurredAt, stored.payload.completedAt);
  }
});

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
  void test(`completion status ${status}`, async () => {
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
void test('UC24.4 drains an OrganizerCancelled completion request without completing', async () => {
  const f = await fixture('NotStarted', 'Required');
  const request = await take(f.id);
  await prisma.$executeRaw`UPDATE enrollments
    SET status='Withdrawn', withdrawn_reason='OrganizerCancelled', withdrawn_at=clock_timestamp()
    WHERE id=${f.id}::uuid`;
  await service.evaluate(request);
  assert.equal((await state(f.id)).status, 'Withdrawn');
  assert.equal(await eventCount(f.id), 0);
  assert.equal(await prisma.completionEvaluationRequest.count({ where: { enrollmentId: f.id } }), 0);
});

void test('lease abandoned after claim can be reclaimed; old generation cannot complete twice', async () => {
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
void test('trigger during assessment wait survives obsolete result and is evaluated once', async () => {
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
void test('timeout backs off, new signal bypasses backoff, recovered snapshot is immutable', async () => {
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
  void test(`Required late=${late}`, async () => {
    const f = await fixture('InProgress', 'Required', late ? -1000 : 86400000);
    await service.evaluate(await take(f.id));
    assert.equal((await state(f.id)).completed_late, late);
  });
void test('Course Disabled and empty aggregate never complete', async () => {
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
void test('effective deadline unions overlapping pauses and keeps extensions', async () => {
  const f = await fixture('Exempted', 'Required', -3600000);
  const assigned = new Date(Date.now() - 86400000),
    base = new Date(Date.now() - 3600000);
  await prisma.$executeRaw`UPDATE enrollments SET due_timezone='Pacific/Auckland',assigned_at=${assigned},base_due_at=${base},due_at=${new Date(base.getTime() + 1800000)},extension_seconds=1800 WHERE id=${f.id}::uuid`;
  await prisma.$executeRaw`INSERT INTO enrollment_status_intervals(id,organization_id,enrollment_id,kind,started_at,ended_at,reason)
    VALUES (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted',${new Date(Date.now() - 7200000)},${new Date(Date.now() - 3600000)},'synthetic overlap'),
      (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted',${new Date(Date.now() - 5400000)},NULL,'synthetic open')`;
  await service.evaluate(await take(f.id));
  const [row] = await prisma.$queryRaw<
    {
      due_at: Date;
      completed_at: Date;
      completed_late: boolean;
      due_timezone: string;
    }[]
  >`SELECT due_at,completed_at,completed_late,due_timezone FROM enrollments WHERE id=${f.id}::uuid`;
  assert.ok(row.due_at > row.completed_at);
  assert.equal(row.completed_late, false);
  assert.equal(row.due_timezone, 'Pacific/Auckland');
  // Two hours in the union plus thirty minutes extension, not 2.5 hours of overlapping intervals.
  assert.ok(Math.abs(row.due_at.getTime() - base.getTime() - 9000000) < 2000);
  const [open] = await prisma.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) FROM enrollment_status_intervals WHERE enrollment_id=${f.id}::uuid AND ended_at IS NULL`;
  assert.equal(open.count, 0n);
});
void test('stale failure cannot overwrite immediate eligibility time of a new trigger', async () => {
  const f = await fixture();
  const old = await take(f.id);
  await f.enqueue();
  assert.equal(await repo.retry(old, 'ASSESSMENT_UNAVAILABLE'), 0);
  await service.evaluate(await take(f.id));
  assert.equal(await eventCount(f.id), 1);
});
void test('two concurrent claimers get disjoint work', async () => {
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
void test('expired lease while old worker writes cannot let a second worker duplicate completion', async () => {
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
                    const v: unknown = Reflect.get(t, p);
                    return (typeof v === 'function' ? v.bind(t) : v) as unknown;
                  },
                }),
              ),
            options as never,
          );
      const v: unknown = Reflect.get(target, property);
      return (typeof v === 'function' ? v.bind(target) : v) as unknown;
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
void test('invalid contract increments attempts without completing', async () => {
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
void test('two concurrent Video completions enqueue only on the first transition', async () => {
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
      await video.saveCoverage(f.id, material, org, 80, [[0, 80]], tx);
    });
  await Promise.all([finish(), finish()]);
  const [request] = await prisma.$queryRaw<
    { generation: bigint }[]
  >`SELECT generation FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
  assert.equal(request.generation, 0n);
  await service.evaluate(await take(f.id));
  assert.equal(await eventCount(f.id), 1);
});
void test('API starts with Kafka and course-service unreachable and retains assessment outage work until recovery', async () => {
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
void test('microsecond base deadline completes without losing precision', async () => {
  const f = await fixture('NotStarted', 'Required');
  await prisma.$executeRaw`UPDATE enrollments SET due_timezone='Asia/Ho_Chi_Minh',base_due_at='2026-10-13 16:44:59.572527+00'::timestamptz,
    due_at='2026-10-13 16:44:59.572527+00'::timestamptz WHERE id=${f.id}::uuid`;
  await service.evaluate(await take(f.id));
  assert.equal((await state(f.id)).status, 'Completed');
  const [row] = await prisma.$queryRaw<
    { exact: boolean }[]
  >`SELECT due_at=base_due_at AS exact FROM enrollments WHERE id=${f.id}::uuid`;
  assert.equal(row.exact, true);
  assert.equal(await eventCount(f.id), 1);
});
void test('microsecond interval start closes without ck_intervals_range failure', async () => {
  const f = await fixture('Exempted', 'Required');
  await prisma.$executeRaw`INSERT INTO enrollment_status_intervals(id,organization_id,enrollment_id,kind,started_at,reason)
    VALUES (${randomUUID()}::uuid,${org}::uuid,${f.id}::uuid,'Exempted','2026-10-13 16:44:59.572527+00'::timestamptz,'synthetic precision')`;
  const original = prisma.$transaction.bind(prisma);
  const controlled = new Proxy(prisma, {
    get(target, property) {
      if (property === '$transaction')
        return (work: (tx: unknown) => Promise<unknown>, options: unknown) =>
          original(
            async (tx) =>
              work(
                new Proxy(tx, {
                  get(t, p) {
                    if (p === '$queryRaw')
                      return (
                        strings: TemplateStringsArray,
                        ...values: unknown[]
                      ) => {
                        if (
                          Array.isArray(strings) &&
                          strings.join('').trim() ===
                            'SELECT clock_timestamp() AS "completedAt"'
                        )
                          return Promise.resolve([
                            {
                              completedAt: new Date('2026-10-13T16:44:59.572Z'),
                            },
                          ]);
                        return t.$queryRaw(strings, ...values);
                      };
                    const value: unknown = Reflect.get(t, p);
                    return (
                      typeof value === 'function' ? value.bind(t) : value
                    ) as unknown;
                  },
                }),
              ),
            options as never,
          );
      const value: unknown = Reflect.get(target, property);
      return (
        typeof value === 'function' ? value.bind(target) : value
      ) as unknown;
    },
  });
  await new CompletionService(
    new CompletionRepository(controlled, repo.config),
    fake,
  ).evaluate(await take(f.id));
  assert.equal((await state(f.id)).status, 'Completed');
  const [row] = await prisma.$queryRaw<
    { valid: boolean }[]
  >`SELECT ended_at >= started_at AS valid FROM enrollment_status_intervals WHERE enrollment_id=${f.id}::uuid`;
  assert.equal(row.valid, true);
});

for (const fraction of ['572527', '000527'])
  void test(`fractional base extension ${fraction} recomputes within requested Ho Chi Minh calendar day`, async () => {
    const f = await fixture('NotStarted', 'Required');
    await prisma.$executeRaw`UPDATE enrollments SET due_timezone='Asia/Ho_Chi_Minh',base_due_at=${`2026-10-13 16:44:59.${fraction}+00`}::timestamptz,
    due_at=${`2026-10-13 16:44:59.${fraction}+00`}::timestamptz WHERE id=${f.id}::uuid`;
    await prisma.$transaction(async (tx) => {
      const changes = new AssignmentChangesRepository(prisma);
      const row = await changes.lock(tx, org, f.id);
      const boundary = await new BaseDueAtRepository(
        prisma,
      ).computeDueAtForDate('2026-10-14', 'Asia/Ho_Chi_Minh', tx);
      assert.equal(boundary.toISOString(), '2026-10-14T17:00:00.000Z');
      const seconds = validateExtension(
        row.dueAt,
        boundary,
        '2026-10-14',
        '2026-10-13',
        row.dueAtHasSubMillisecond,
      );
      assert.equal(seconds, 87300n);
      await changes.extend(
        tx,
        org,
        f.id,
        boundary,
        seconds,
        'Asia/Ho_Chi_Minh',
      );
    });
    const [stored] = await prisma.$queryRaw<
      { boundary: boolean }[]
    >`SELECT due_at='2026-10-14 17:00:00+00'::timestamptz AS boundary FROM enrollments WHERE id=${f.id}::uuid`;
    assert.equal(stored.boundary, true);
    await service.evaluate(await take(f.id));
    assert.equal((await state(f.id)).status, 'Completed');
    const [row] = await prisma.$queryRaw<
      { day: string; valid: boolean; exact: boolean }[]
    >`SELECT
    to_char(due_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS day,
    due_at >= base_due_at AND due_at < '2026-10-14 17:00:00+00'::timestamptz AS valid,
    due_at=${`2026-10-14 16:59:59.${fraction}+00`}::timestamptz AS exact
    FROM enrollments WHERE id=${f.id}::uuid`;
    assert.equal(row.day, '2026-10-14');
    assert.equal(row.valid, true);
    assert.equal(row.exact, true);
  });

void test('Optional completion preserves NULL deadline and timezone', async () => {
  const f = await fixture('InProgress', 'Optional');
  await service.evaluate(await take(f.id));
  const stored = await prisma.enrollment.findUniqueOrThrow({
    where: { id: f.id },
    select: { dueAt: true, dueTimezone: true },
  });
  assert.deepEqual(stored, { dueAt: null, dueTimezone: null });
});

const assignmentSnapshot = (
  s: CompletionSnapshot,
  status: CompletionSnapshot['assignments'][number]['peerReview']['status'] = 'Waived',
) => {
  s.quizzes = [];
  s.assignments = [
    {
      assessmentId: randomUUID(),
      submissionId: randomUUID(),
      finalScore: '90',
      passingScore: '80',
      finalizedAt: s.asOf,
      passed: true,
      peerReview: {
        status,
        requiredCount: status === 'NotApplicable' ? 0 : 3,
        completedCount:
          status === 'Satisfied' ? 3 : status === 'NotApplicable' ? 0 : 1,
      },
    },
  ];
};
for (const [name, change, completed, mismatch, itemMismatch] of [
  [
    'Waived partly reviewed',
    (s: CompletionSnapshot) => assignmentSnapshot(s),
    true,
    false,
    false,
  ],
  [
    'eligible=false with passing facts',
    (s: CompletionSnapshot) => {
      s.eligible = false;
    },
    true,
    true,
    false,
  ],
  [
    'eligible=true with low quiz score',
    (s: CompletionSnapshot) => {
      s.quizzes[0].recordedScore = '20';
    },
    false,
    true,
    true,
  ],
  [
    'quiz passed=false with passing facts',
    (s: CompletionSnapshot) => {
      s.quizzes[0].passed = false;
    },
    true,
    true,
    true,
  ],
  [
    'null quiz score with passed=true',
    (s: CompletionSnapshot) => {
      s.quizzes[0].recordedScore = null;
    },
    false,
    true,
    true,
  ],
  [
    'assignment passed=false with passing facts',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      s.assignments[0].passed = false;
    },
    true,
    true,
    true,
  ],
  [
    'null assignment score with passed=true',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      s.assignments[0].finalScore = null;
    },
    false,
    true,
    true,
  ],
  [
    'unfinalized assignment',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      s.assignments[0].finalizedAt = null;
    },
    false,
    true,
    true,
  ],
  [
    'missing quiz attempt',
    (s: CompletionSnapshot) => {
      s.quizzes[0].attemptId = null;
    },
    false,
    true,
    true,
  ],
  [
    'missing assignment submission',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      s.assignments[0].submissionId = null;
    },
    false,
    true,
    true,
  ],
  [
    'Waived with low assignment score',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      s.assignments[0].finalScore = '20';
    },
    false,
    true,
    true,
  ],
  [
    'Pending peer duty',
    (s: CompletionSnapshot) => assignmentSnapshot(s, 'Pending'),
    false,
    true,
    true,
  ],
  [
    'Missed peer duty',
    (s: CompletionSnapshot) => assignmentSnapshot(s, 'Missed'),
    false,
    true,
    true,
  ],
  [
    'Satisfied peer duty',
    (s: CompletionSnapshot) => assignmentSnapshot(s, 'Satisfied'),
    true,
    false,
    false,
  ],
  [
    'NotApplicable peer duty',
    (s: CompletionSnapshot) => assignmentSnapshot(s, 'NotApplicable'),
    true,
    false,
    false,
  ],
] as const)
  void test(`L22 completion follows facts: ${name}`, async () => {
    const f = await fixture();
    const s: CompletionSnapshot = { ...f.snapshot, schemaVersion: 1 };
    change(s);
    const original = structuredClone(s);
    fake.fixtures.set(f.key, { value: s });
    const warnings = mock.method(Logger.prototype, 'warn', () => undefined);
    const errors = mock.method(Logger.prototype, 'error', () => undefined);
    try {
      await service.evaluate(await take(f.id));
      const saved = await state(f.id);
      assert.equal(saved.status, completed ? 'Completed' : 'NotStarted');
      assert.equal(await eventCount(f.id), completed ? 1 : 0);
      assert.equal(errors.mock.callCount(), 0);
      assert.equal(warnings.mock.callCount(), mismatch ? 1 : 0);
      if (mismatch) {
        const item = s.quizzes[0] ?? s.assignments[0];
        assert.deepEqual(warnings.mock.calls[0].arguments[0], {
          code: 'COMPLETION_SNAPSHOT_MISMATCH',
          organizationId: org,
          learnerId: f.learner,
          courseId: f.course,
          revision: s.revision,
          assessmentEligible: s.eligible,
          learningEligible: completed,
          items: itemMismatch
            ? [
                {
                  assessmentId: item.assessmentId,
                  assessment: item.passed,
                  learning: completed,
                },
              ]
            : [],
        });
      }
      assert.deepEqual(s, original);
      if (completed) {
        assert.deepEqual(saved.completion_snapshot, original);
        const [event] = await prisma.$queryRaw<
          { payload: { scoreSnapshot: unknown } }[]
        >`SELECT payload FROM outbox_events WHERE aggregate_id=${f.id}::uuid AND event_type='EnrollmentCompleted'`;
        assert.deepEqual(event.payload.scoreSnapshot, original);
      } else assert.equal(saved.completion_snapshot, null);
    } finally {
      warnings.mock.restore();
      errors.mock.restore();
    }
  });

for (const [name, change] of [
  [
    'unknown peer status',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      (s.assignments[0].peerReview as { status: string }).status = 'Exempted';
    },
  ],
  [
    'count mismatch',
    (s: CompletionSnapshot) => {
      s.requiredComponentCount = 2;
    },
  ],
  [
    'duplicate id',
    (s: CompletionSnapshot) => {
      s.quizzes.push({ ...s.quizzes[0] });
      s.requiredComponentCount = 2;
    },
  ],
  [
    'excess completed count',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s);
      s.assignments[0].peerReview.completedCount = 4;
    },
  ],
  [
    'wrong learnerId',
    (s: CompletionSnapshot) => {
      s.learnerId = randomUUID();
    },
  ],
  [
    'wrong courseId',
    (s: CompletionSnapshot) => {
      s.courseId = randomUUID();
    },
  ],
  [
    'wrong organizationId',
    (s: CompletionSnapshot) => {
      s.organizationId = randomUUID();
    },
  ],
  [
    'negative count',
    (s: CompletionSnapshot) => {
      s.requiredComponentCount = -1;
    },
  ],
  [
    'unsafe count',
    (s: CompletionSnapshot) => {
      s.requiredComponentCount = Number.MAX_SAFE_INTEGER + 1;
    },
  ],
  [
    'NotApplicable counts',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s, 'NotApplicable');
      s.assignments[0].peerReview.requiredCount = 1;
    },
  ],
  [
    'Satisfied counts',
    (s: CompletionSnapshot) => {
      assignmentSnapshot(s, 'Satisfied');
      s.assignments[0].peerReview.completedCount = 1;
    },
  ],
  [
    'NaN decimal',
    (s: CompletionSnapshot) => {
      s.quizzes[0].recordedScore = 'NaN';
    },
  ],
  [
    'nondecimal',
    (s: CompletionSnapshot) => {
      s.quizzes[0].passingScore = '0x10';
    },
  ],
  [
    'excess decimal precision',
    (s: CompletionSnapshot) => {
      s.quizzes[0].recordedScore = '90.001';
      s.quizzes[0].passingScore = '90.0001';
    },
  ],
  [
    'out-of-range score',
    (s: CompletionSnapshot) => {
      s.quizzes[0].recordedScore = '100.01';
    },
  ],
  [
    'infinite decimal',
    (s: CompletionSnapshot) => {
      s.quizzes[0].passingScore = '9'.repeat(400);
    },
  ],
] as const)
  void test(`L22 structural failure retries: ${name}`, async () => {
    const f = await fixture();
    const s: CompletionSnapshot = { ...f.snapshot, schemaVersion: 1 };
    change(s);
    fake.fixtures.set(f.key, { value: s });
    const errors = mock.method(Logger.prototype, 'error', () => undefined);
    try {
      await service.evaluate(await take(f.id));
      assert.equal((await state(f.id)).status, 'NotStarted');
      const [r] = await prisma.$queryRaw<
        { attempts: bigint; last_error: string }[]
      >`SELECT attempts,last_error FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
      assert.equal(r.attempts, 1n);
      assert.equal(r.last_error, 'INVALID_SNAPSHOT');
      assert.deepEqual(errors.mock.calls[0].arguments[0], {
        code: 'INVALID_SNAPSHOT',
        httpStatus: null,
        permanent: true,
      });
    } finally {
      errors.mock.restore();
    }
  });

for (const httpStatus of [404, 503])
  void test(`L22 HTTP ${httpStatus} retries repeatedly then recovers`, async () => {
    const f = await fixture();
    let status = httpStatus;
    const server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: f.snapshot }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const errors = mock.method(Logger.prototype, 'error', () => undefined);
    try {
      const address = server.address() as AddressInfo;
      const client = createCompletionClient(
        (k) =>
          ({
            ASSESSMENT_SERVICE_URL: `http://127.0.0.1:${address.port}`,
            INTERNAL_SERVICE_KEY: 'synthetic-l22-key',
          })[k],
      );
      const evaluator = new CompletionService(repo, client);
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (attempt > 1) await f.enqueue();
        await evaluator.evaluate(await take(f.id));
        const [r] = await prisma.$queryRaw<
          { attempts: bigint; last_error: string }[]
        >`SELECT attempts,last_error FROM completion_evaluation_requests WHERE enrollment_id=${f.id}::uuid`;
        assert.equal(r.attempts, BigInt(attempt));
        assert.equal(r.last_error, 'ASSESSMENT_UNAVAILABLE');
        assert.equal((await state(f.id)).status, 'NotStarted');
      }
      assert.equal(errors.mock.callCount(), 2);
      assert.deepEqual(errors.mock.calls[0].arguments[0], {
        code: 'ASSESSMENT_UNAVAILABLE',
        httpStatus,
        permanent: httpStatus === 404,
      });
      status = 200;
      await f.enqueue();
      await evaluator.evaluate(await take(f.id));
      assert.equal((await state(f.id)).status, 'Completed');
      assert.equal(await eventCount(f.id), 1);
    } finally {
      errors.mock.restore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

void test('L22 multiple flag differences produce one warning and preserve all original flags', async () => {
  const f = await fixture();
  const s: CompletionSnapshot = {
    ...f.snapshot,
    schemaVersion: 1,
    eligible: false,
    quizzes: [
      { ...f.snapshot.quizzes[0], passed: false },
      { ...f.snapshot.quizzes[0], assessmentId: randomUUID(), passed: false },
    ],
    requiredComponentCount: 2,
  };
  fake.fixtures.set(f.key, { value: s });
  const original = structuredClone(s);
  const warnings = mock.method(Logger.prototype, 'warn', () => undefined);
  try {
    await service.evaluate(await take(f.id));
    assert.equal((await state(f.id)).status, 'Completed');
    assert.equal(warnings.mock.callCount(), 1);
    assert.deepEqual(warnings.mock.calls[0].arguments[0], {
      code: 'COMPLETION_SNAPSHOT_MISMATCH',
      organizationId: org,
      learnerId: f.learner,
      courseId: f.course,
      revision: s.revision,
      assessmentEligible: false,
      learningEligible: true,
      items: s.quizzes.map((q) => ({
        assessmentId: q.assessmentId,
        assessment: false,
        learning: true,
      })),
    });
    assert.deepEqual((await state(f.id)).completion_snapshot, original);
    const [e] = await prisma.$queryRaw<
      { payload: { scoreSnapshot: unknown } }[]
    >`SELECT payload FROM outbox_events WHERE aggregate_id=${f.id}::uuid AND event_type='EnrollmentCompleted'`;
    assert.deepEqual(e.payload.scoreSnapshot, original);
  } finally {
    warnings.mock.restore();
  }
});
