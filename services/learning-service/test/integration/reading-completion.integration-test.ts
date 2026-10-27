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
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import type { CourseTree } from '../../src/infrastructure/clients/course/course-service.interface';
import { CourseServiceUnavailableError } from '../../src/infrastructure/clients/course/course-service.errors';
import {
  READING_ACCESS_CONFIG,
  type ReadingAccessConfig,
} from '../../src/modules/material-progress/reading-access.config';
import { MaterialProgressRepository } from '../../src/modules/material-progress/material-progress.repository';
import { databaseUrl } from './enroll-it-fixture';
import { CompletionService } from '../../src/modules/course-completion/completion.service';
import {
  ASSESSMENT_COMPLETION_CLIENT,
  FakeAssessmentCompletionClient,
} from '../../src/infrastructure/clients/assessment/assessment-completion.client';

const org = '27030000-0000-4000-8000-000000000003';
const learner = randomUUID(),
  enrollment = randomUUID(),
  course = randomUUID(),
  lesson = randomUUID(),
  material = randomUUID();
const db = new Client({ connectionString: databaseUrl() });
let app: NestExpressApplication,
  url: string,
  calls = 0;
async function cleanup() {
  for (const table of [
    'outbox_events',
    'enrollments',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ])
    await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
}
async function state() {
  return (
    await db.query(
      `SELECT e.status,e.first_activity_at,e.updated_at AS activity_updated_at,p.updated_at AS progress_updated_at,p.completed_at,p.watched_ranges::text,
    (SELECT generation::int FROM completion_evaluation_requests WHERE enrollment_id=e.id) AS generation,
    (SELECT source FROM completion_evaluation_requests WHERE enrollment_id=e.id) AS source
    FROM enrollments e LEFT JOIN material_progress p ON p.enrollment_id=e.id WHERE e.id=$1`,
      [enrollment],
    )
  ).rows[0];
}
async function request(
  options: {
    id?: string;
    headers?: Record<string, string>;
    body?: unknown;
    get?: boolean;
  } = {},
) {
  return fetch(
    `${url}/api/v1/enrollments/${enrollment}/materials/${options.id ?? material}/${options.get ? 'reading-access' : 'complete-reading'}`,
    {
      method: options.get ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
        'x-user-id': learner,
        'x-user-role': 'LEARNER',
        'x-organization-id': org,
        ...options.headers,
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    },
  );
}
async function mark() {
  const r = await request();
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  return body.data;
}
async function setStatus(status: string) {
  await db.query(
    `UPDATE enrollments SET status=$2, first_activity_at=CASE WHEN $2 IN ('InProgress','Exempted','Completed') THEN now()-interval '1 hour' ELSE NULL END,
    completed_at=CASE WHEN $2='Completed' THEN now() ELSE NULL END,
    withdrawn_at=CASE WHEN $2='Withdrawn' THEN now() ELSE NULL END,
    withdrawn_reason=CASE WHEN $2='Withdrawn' THEN 'LearnerWithdrew' ELSE NULL END,
    enrollment_type=CASE WHEN $2='Exempted' THEN 'Required' ELSE enrollment_type END,
    assigned_at=CASE WHEN $2='Exempted' THEN now() ELSE assigned_at END,
    expected_completion_days=CASE WHEN $2='Exempted' THEN 1 ELSE expected_completion_days END,
    base_due_at=CASE WHEN $2='Exempted' THEN now()+interval '1 day' ELSE base_due_at END,
    due_at=CASE WHEN $2='Exempted' THEN now()+interval '1 day' ELSE due_at END WHERE id=$1`,
    [enrollment, status],
  );
}
describe('UC27.3 Reading HTTP + PostgreSQL', () => {
  before(async () => {
    await db.connect();
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await cleanup();
    calls = 0;
    app.get<ReadingAccessConfig>(READING_ACCESS_CONFIG).mode = 'course';
    app.get(CourseServiceClient).getCourseTree = async () => {
      calls++;
      throw new CourseServiceUnavailableError('offline');
    };
    await db.query(
      `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES($1,$2,$1,now(),now())`,
      [course, org],
    );
    await db.query(
      `INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,disabled_as_of) VALUES($1,$2,$3,$4,'Reading',true,now())`,
      [material, org, course, lesson],
    );
    await db.query(
      `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,video_completion_percent) VALUES($1,$2,$3,$4,'Optional',80)`,
      [enrollment, org, learner, course],
    );
  });
  after(async () => {
    try {
      await cleanup();
    } finally {
      await closeAll(() => closeApp(app), () => db.end());
    }
  });
  test('first completion, retry and parallel duplicates enqueue once without I2; timestamps are immutable', async () => {
    const responses = await Promise.all([mark(), mark()]);
    assert.deepEqual(responses.map((r) => r.alreadyCompleted).sort(), [
      false,
      true,
    ]);
    assert.equal(responses[0].completedAt, responses[1].completedAt);
    const before = await state();
    assert.equal(before.status, 'InProgress');
    assert.equal(before.watched_ranges, null);
    assert.equal(before.generation, 0);
    assert.equal(before.source, 'READING_COMPLETED');
    assert.equal(
      before.first_activity_at.toISOString(),
      before.completed_at.toISOString(),
    );
    assert.equal((await mark()).alreadyCompleted, true);
    assert.deepEqual(await state(), before);
    assert.equal(calls, 0);
    assert.equal(responses[0].lessonCompleted, true);
    assert.equal(responses[0].completionEvaluationPending, true);
  });
  test('existing NULL completion transitions exactly once', async () => {
    await db.query(
      `INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,watched_ranges) VALUES($1,$2,$3,$4,'{}')`,
      [randomUUID(), org, enrollment, material],
    );
    assert.equal((await mark()).alreadyCompleted, false);
    assert.equal((await state()).generation, 0);
  });
  test('Overdue is computed on read and does not block completion', async () => {
    await db.query(
      `UPDATE enrollments SET enrollment_type='Required',expected_completion_days=1,assigned_at=now()-interval '2 days',base_due_at=now()-interval '1 day',due_at=now()-interval '1 day' WHERE id=$1`,
      [enrollment],
    );
    assert.equal((await mark()).enrollmentStatus, 'Overdue');
    assert.equal((await state()).status, 'InProgress');
  });
  test('activity helper keeps an earlier timestamp and repairs a later one for Video in all writable states', async () => {
    const repository = app.get(MaterialProgressRepository);
    for (const status of ['NotStarted', 'InProgress', 'Exempted']) {
      await db.query(`DELETE FROM material_progress WHERE enrollment_id=$1`, [
        enrollment,
      ]);
      await db.query(
        `DELETE FROM completion_evaluation_requests WHERE enrollment_id=$1`,
        [enrollment],
      );
      await db.query(
        `UPDATE material_snapshots SET material_type='Video',duration_seconds=100,duration_as_of=now() WHERE material_id=$1`,
        [material],
      );
      await setStatus(status);
      const before = await state();
      await repository.transaction(async (tx) => {
        await repository.access(enrollment, learner, org, tx);
        await repository.lock(enrollment, material, org, tx);
        const preview = await repository.preview(
          enrollment,
          material,
          org,
          [[0, 100]],
          tx,
        );
        await repository.save(
          enrollment,
          material,
          org,
          preview,
          80,
          [[0, 100]],
          tx,
        );
      });
      const after = await state();
      assert.equal(
        after.status,
        status === 'NotStarted' ? 'InProgress' : status,
      );
      assert.equal(
        after.first_activity_at.toISOString(),
        before.first_activity_at?.toISOString() ??
          after.completed_at.toISOString(),
      );
      assert.equal(after.source, 'VIDEO_COMPLETED');
      assert.equal(after.generation, 0);
    }
  });
  test('Reading LEAST corrects a later existing first activity timestamp', async () => {
    await setStatus('InProgress');
    await db.query(
      `UPDATE enrollments SET first_activity_at=now()+interval '1 hour' WHERE id=$1`,
      [enrollment],
    );
    const result = await mark();
    assert.equal(
      (await state()).first_activity_at.toISOString(),
      result.completedAt,
    );
  });
  for (const status of ['Completed', 'Exempted', 'InProgress'])
    test(`${status} behavior preserves earliest activity`, async () => {
      await setStatus(status);
      const before = await state();
      const result = await mark();
      const after = await state();
      assert.equal(after.status, status);
      assert.equal(result.enrollmentStatus, status);
      assert.equal(
        after.first_activity_at.toISOString(),
        before.first_activity_at.toISOString(),
      );
      if (status === 'Completed') {
        assert.equal(result.completedAt, null);
        assert.equal(result.alreadyCompleted, false);
        assert.equal(result.lessonCompleted, false);
        assert.equal(result.completionEvaluationPending, false);
        assert.equal(after.generation, null);
      } else {
        assert.ok(result.completedAt);
        assert.equal(after.generation, 0);
      }
    });
  test('Completed returns old completion without writing', async () => {
    const old = await mark();
    await setStatus('Completed');
    const before = await state();
    const result = await mark();
    assert.equal(result.completedAt, old.completedAt);
    assert.equal(result.alreadyCompleted, true);
    assert.deepEqual(await state(), before);
  });
  for (const [status, http, code] of [
    ['Halted', 403, 'CONTENT_UNAVAILABLE'],
    ['Withdrawn', 404, 'ENROLLMENT_NOT_FOUND'],
  ] as const)
    test(`${status} is rejected`, async () => {
      await setStatus(status);
      const r = await request();
      assert.equal(r.status, http);
      assert.equal((await r.json()).error.code, code);
      assert.equal((await state()).completed_at, null);
    });
  test('Video, wrong version, unknown material, owner and organization are rejected', async () => {
    await db.query(
      `UPDATE material_snapshots SET material_type='Video',duration_seconds=100,duration_as_of=now() WHERE material_id=$1`,
      [material],
    );
    let r = await request();
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error.code, 'MATERIAL_NOT_READING');
    const invalid: Parameters<typeof request>[0][] = [
      { id: randomUUID() },
      { headers: { 'x-user-id': randomUUID() } },
      { headers: { 'x-organization-id': randomUUID() } },
    ];
    for (const options of invalid) {
      r = await request(options);
      assert.equal(r.status, 404);
    }
    await db.query(
      `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES($1,$2,$1,now(),now())`,
      [learner, org],
    );
    await db.query(
      `UPDATE material_snapshots SET course_id=$2 WHERE material_id=$1`,
      [material, learner],
    );
    assert.equal((await request()).status, 404);
    assert.equal((await state()).completed_at, null);
  });
  for (const target of ['material', 'lesson', 'course'])
    test(`disabled ${target} cannot complete`, async () => {
      if (target === 'lesson')
        await db.query(
          `INSERT INTO lesson_snapshots(lesson_id,organization_id,course_id,disabled_at,disabled_as_of) VALUES($1,$2,$3,now(),now())`,
          [lesson, org, course],
        );
      else
        await db.query(
          `UPDATE ${target === 'material' ? 'material_snapshots' : 'course_version_snapshots'} SET disabled_at=now() WHERE organization_id=$1`,
          [org],
        );
      const r = await request();
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error.code, 'CONTENT_UNAVAILABLE');
      assert.equal((await state()).completed_at, null);
    });
  test('unknown body keys fail with 422', async () => {
    for (const body of [
      { complete: true },
      { completedAt: new Date().toISOString() },
      [],
    ]) {
      const r = await request({ body });
      assert.equal(r.status, 422);
      assert.equal((await r.json()).error.code, 'VALIDATION_ERROR');
    }
    assert.equal((await state()).completed_at, null);
    assert.equal((await request({ body: {} })).status, 200);
  });
  for (const required of [true, false])
    test(`Lesson BR-185/186 with second material required=${required}`, async () => {
      await db.query(
        `UPDATE material_snapshots SET is_required=$2 WHERE material_id=$1`,
        [material, required],
      );
      const second = randomUUID();
      await db.query(
        `INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,disabled_as_of) VALUES($1,$2,$3,$4,'Reading',$5,now())`,
        [second, org, course, lesson, required],
      );
      assert.equal((await mark()).lessonCompleted, false);
      assert.equal((await request({ id: second })).status, 200);
      assert.equal((await mark()).lessonCompleted, true);
    });
  test('optional and disabled materials do not block required Lesson completion', async () => {
    for (const disabled of [true, false])
      await db.query(
        `INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,disabled_at,disabled_as_of)
      VALUES($1,$2,$3,$4,'Reading',$5,CASE WHEN $5 THEN now() ELSE NULL END,now())`,
        [randomUUID(), org, course, lesson, disabled],
      );
    assert.equal((await mark()).lessonCompleted, true);
  });
  test('snapshot Lesson with no visible materials is neutral, never completed', async () => {
    await db.query(`DELETE FROM material_snapshots WHERE material_id=$1`, [
      material,
    ]);
    const repository = app.get(MaterialProgressRepository);
    const result = await repository.transaction((tx) =>
      repository.readingState(enrollment, material, course, lesson, org, tx),
    );
    assert.equal(result.lessonCompleted, null);
  });
  test('enqueue failure rolls back completion and activation', async () => {
    // A transaction proxy fails only the durable request INSERT; no DB schema is changed.
    const repository = app.get(MaterialProgressRepository);
    const original = repository.transaction.bind(repository);
    let failedAtEnqueue = false;
    repository.transaction = (work) =>
      original((tx) =>
        work(
          new Proxy(tx, {
            get(target, key) {
              if (key === '$executeRaw')
                return (...args: Parameters<typeof target.$executeRaw>) => {
                  const sql = args[0];
                  const text =
                    'sql' in sql ? sql.sql : Array.from(sql).join('');
                  if (
                    text.includes('INSERT INTO completion_evaluation_requests')
                  ) {
                    failedAtEnqueue = true;
                    throw new Error('synthetic enqueue failure');
                  }
                  return target.$executeRaw(...args);
                };
              return Reflect.get(target, key);
            },
          }),
        ),
      );
    try {
      assert.equal((await request()).status, 500);
    } finally {
      repository.transaction = original;
    }
    assert.equal(failedAtEnqueue, true);
    const row = await state();
    assert.equal(row.completed_at, null);
    assert.equal(row.status, 'NotStarted');
    assert.equal(row.generation, null);
  });
  test('course mode and dependency outage return SERVICE_UNAVAILABLE, fixture is explicit', async () => {
    let r = await request({ get: true });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error.code, 'SERVICE_UNAVAILABLE');
    const config = app.get<ReadingAccessConfig>(READING_ACCESS_CONFIG);
    config.mode = 'fixture';
    config.fixtureUrl = 'https://example.test/reading.pdf';
    r = await request({ get: true });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error.code, 'SERVICE_UNAVAILABLE');
    const tree: CourseTree = {
      courseId: course,
      chainId: course,
      versionNumber: 1,
      asOf: new Date(),
      disabledAt: null,
      modules: [
        {
          id: randomUUID(),
          title: '',
          position: 0,
          lessons: [
            {
              id: lesson,
              title: '',
              position: 0,
              disabledAt: null,
              materials: [
                {
                  id: material,
                  title: 'Reading fixture',
                  position: 0,
                  materialType: 'Reading',
                  isRequired: true,
                  durationSeconds: null,
                  disabledAt: null,
                },
              ],
            },
          ],
        },
      ],
    };
    app.get(CourseServiceClient).getCourseTree = async () => tree;
    r = await request({ get: true });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).data.fixture, true);
    assert.equal((await state()).completed_at, null);
    for (const target of [
      tree,
      tree.modules[0].lessons[0],
      tree.modules[0].lessons[0].materials[0],
    ]) {
      target.disabledAt = new Date();
      assert.equal((await request({ get: true })).status, 403);
      target.disabledAt = null;
    }
  });
  test('Reading triggers the existing Course evaluator and emits one completion event', async () => {
    app
      .get<FakeAssessmentCompletionClient>(ASSESSMENT_COMPLETION_CLIENT)
      .fixtures.set([org, learner, course].join('/'), {
        value: {
          schemaVersion: 1,
          snapshotId: randomUUID(),
          asOf: new Date().toISOString(),
          revision: 'reading-test',
          organizationId: org,
          learnerId: learner,
          courseId: course,
          eligible: true,
          requiredComponentCount: 0,
          quizzes: [],
          assignments: [],
        },
      });
    await mark();
    const evaluator = app.get(CompletionService);
    await evaluator.evaluate({
      enrollment_id: enrollment,
      organization_id: org,
      generation: 0n,
      attempts: 0n,
      expired: false,
    });
    assert.equal((await state()).status, 'Completed');
    const result = await mark();
    assert.equal(result.alreadyCompleted, true);
    assert.equal(result.completionEvaluationPending, false);
    assert.equal(
      (
        await db.query(
          `SELECT count(*)::int AS n FROM outbox_events WHERE organization_id=$1 AND event_type='EnrollmentCompleted'`,
          [org],
        )
      ).rows[0].n,
      1,
    );
  });
});
