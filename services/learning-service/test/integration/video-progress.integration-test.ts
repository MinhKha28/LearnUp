import './tenant-lookup-config';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import type { CourseTree } from '../../src/infrastructure/clients/course/course-service.interface';
import {
  VIDEO_PLAYBACK_CONFIG,
  type VideoPlaybackConfig,
} from '../../src/modules/material-progress/video-playback.config';
import { databaseUrl } from './enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing UC27.2 integration tests in production.');
const ORG = '27200000-0000-4000-8000-000000000001';
const OTHER = '27200000-0000-4000-8000-000000000002';
const learner = randomUUID(),
  enrollment = randomUUID(),
  course = randomUUID(),
  lesson = randomUUID(),
  material = randomUUID();
const db = new Client({ connectionString: databaseUrl('learning_db') });
let app: NestExpressApplication, url: string, calls: number, tree: CourseTree;
let connected = false;
const clientReportedAt = new Date().toISOString();

async function cleanup() {
  for (const table of [
    'enrollments',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ])
    await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [ORG]);
}
async function row() {
  const result = await db.query(
    `SELECT e.status,e.first_activity_at,p.watched_ranges::text,p.last_reported_at,p.completed_at,p.position_seconds,p.position_reported_at,p.updated_at
    FROM enrollments e LEFT JOIN material_progress p ON p.enrollment_id=e.id AND p.organization_id=e.organization_id
    WHERE e.id=$1 AND e.organization_id=$2`,
    [enrollment, ORG],
  );
  return result.rows[0];
}
async function request(
  ranges?: unknown,
  overrides: Record<string, string> = {},
  method = 'POST',
  position = { positionSeconds: 0, reportedAt: clientReportedAt },
) {
  return fetch(
    `${url}/api/v1/enrollments/${enrollment}/materials/${material}/${method === 'GET' ? 'playback' : 'progress'}`,
    {
      method,
      headers: {
        'content-type': 'application/json',
        'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
        'x-user-id': learner,
        'x-user-role': 'LEARNER',
        'x-organization-id': ORG,
        ...overrides,
      },
      ...(method === 'GET'
        ? {}
        : { body: JSON.stringify({ ranges, ...position }) }),
    },
  );
}
async function report(ranges: number[][]) {
  const response = await request(ranges);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.data;
}

describe('UC27.2 video progress HTTP + PostgreSQL', () => {
  before(async () => {
    await db.connect();
    connected = true;
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    configureApp(app);
    const config = app.get<VideoPlaybackConfig>(VIDEO_PLAYBACK_CONFIG);
    config.mode = 'fixture';
    config.fixtureUrl = 'https://example.test/fixture.mp4';
    app.get(CourseServiceClient).getCourseTree = async () => {
      calls++;
      return tree;
    };
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await cleanup();
    calls = 0;
    tree = {
      courseId: course,
      chainId: course,
      versionNumber: 1,
      disabledAt: null,
      asOf: new Date(),
      modules: [
        {
          id: randomUUID(),
          title: 'Module',
          position: 1,
          lessons: [
            {
              id: lesson,
              title: 'Lesson',
              position: 1,
              disabledAt: null,
              materials: [
                {
                  id: material,
                  title: 'Video title from I2',
                  position: 1,
                  materialType: 'Video',
                  isRequired: true,
                  durationSeconds: 999,
                  disabledAt: null,
                },
              ],
            },
          ],
        },
      ],
    };
    await db.query(
      `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of)
      VALUES ($1,$2,$1,now(),now())`,
      [course, ORG],
    );
    await db.query(
      `INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,duration_seconds,duration_as_of,disabled_as_of)
      VALUES ($1,$2,$3,$4,'Video',true,101,now(),now())`,
      [material, ORG, course, lesson],
    );
    await db.query(
      `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,video_completion_percent)
      VALUES ($1,$2,$3,$4,'Optional',90)`,
      [enrollment, ORG, learner, course],
    );
  });
  after(async () => {
    try {
      if (connected) await cleanup();
    } finally {
      await app?.close();
      await db.end();
    }
  });
  test('playback reads title from I2, duration from snapshot and writes nothing', async () => {
    const before = await row();
    const response = await request(undefined, {}, 'GET');
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.title, 'Video title from I2');
    assert.equal(body.data.durationSeconds, 101);
    assert.equal(body.data.requiredSeconds, 91);
    assert.equal(body.data.playbackUrl, 'https://example.test/fixture.mp4');
    assert.equal('learnerId' in body.data, false);
    assert.equal('maxPlaybackRate' in body.data, false);
    assert.equal(body.data.positionSeconds, null);
    assert.equal(body.data.positionReportedAt, null);
    assert.equal(body.data.heartbeatSeconds, 15);
    assert.deepEqual(await row(), before);
    assert.equal(calls, 1);
  });
  test('BR-181 partial coverage, retry and backward seek do not activate Enrollment', async () => {
    const state = await report([
      [0.1, 10.9],
      [5, 20],
    ]);
    assert.deepEqual(state.watchedRanges, [[1, 20]]);
    assert.equal(state.watchedSeconds, 19);
    assert.equal('title' in state, false);
    assert.equal('playbackUrl' in state, false);
    const saved = await row();
    assert.equal(saved.status, 'NotStarted');
    assert.equal(saved.first_activity_at, null);
    await report([[1, 20]]);
    await report([[2, 4]]);
    assert.deepEqual(await row(), saved);
    assert.equal(calls, 0);
  });
  test('zero whole seconds do not activate Enrollment or update last_reported_at', async () => {
    assert.equal((await report([[0.1, 0.9]])).watchedSeconds, 0);
    const saved = await row();
    assert.equal(saved.status, 'NotStarted');
    assert.equal(saved.first_activity_at, null);
    assert.equal(saved.last_reported_at, null);
  });
  test('BR-181 has no rate budget; BR-140 activates only at the completion boundary', async () => {
    assert.equal((await report([[0, 46]])).watchedSeconds, 46);
    assert.equal((await report([[0, 90]])).completed, false);
    assert.equal((await row()).status, 'NotStarted');
    const completed = await report([[90, 91]]);
    assert.equal(completed.completed, true);
    assert.equal((await row()).status, 'InProgress');
    await report([[0, 5]]);
    await report([[91, 92]]);
    assert.equal(
      (await row()).completed_at.toISOString(),
      completed.completedAt,
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM outbox_events WHERE organization_id=$1',
          [ORG],
        )
      ).rows[0].n,
      0,
    );
  });
  test('two concurrent overlapping reports union once and retry preserves timestamps', async () => {
    const results = await Promise.all([report([[0, 30]]), report([[0, 30]])]);
    assert.equal(results[0].watchedSeconds, 30);
    assert.equal(results[1].watchedSeconds, 30);
    assert.equal((await row()).watched_ranges, '{[0,30)}');
    const saved = await row();
    await report([[0, 30]]);
    assert.deepEqual(await row(), saved);
  });
  test('BR-181 concurrent disjoint reports union without a rate budget', async () => {
    const responses = await Promise.all([
      request([[0, 30]]),
      request([[30, 60]]),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200]);
    const saved = await row();
    assert.equal(saved.watched_ranges, '{[0,60)}');
  });
  test('missing snapshot calls I2 once and inserts optional snapshot before progress FK', async () => {
    await db.query('DELETE FROM material_snapshots WHERE organization_id=$1', [
      ORG,
    ]);
    const result = await report([[0, 1]]);
    assert.equal(result.durationSeconds, 999);
    assert.equal(calls, 1);
    assert.equal(
      (
        await db.query(
          'SELECT is_required FROM material_snapshots WHERE organization_id=$1',
          [ORG],
        )
      ).rows[0].is_required,
      false,
    );
    await report([[0, 1]]);
    assert.equal(calls, 1);
  });
  test('422 invalid body/duration, permits duration+1 then clips', async () => {
    for (const ranges of [[[0, 1, 2]], [[-1, 2]], [[0, '2']], [[0, 102.01]]])
      assert.equal((await request(ranges)).status, 422);
    assert.equal((await request([[100, 102]])).status, 200);
    assert.equal((await row()).watched_ranges, '{[100,101)}');
  });
  test('D28 rejects wrong owner/org, Withdrawn, Halted; rejects Reading and disabled lesson', async () => {
    assert.equal(
      (await request([[0, 1]], { 'x-user-id': randomUUID() })).status,
      404,
    );
    assert.equal(
      (await request([[0, 1]], { 'x-organization-id': OTHER })).status,
      404,
    );
    assert.equal(
      (await request([[0, 1]], { 'x-user-role': 'ORGANIZER' })).status,
      403,
    );
    await db.query(
      `UPDATE enrollments SET status='Withdrawn',withdrawn_at=now(),withdrawn_reason='LearnerWithdrew' WHERE organization_id=$1`,
      [ORG],
    );
    assert.equal((await request([[0, 1]])).status, 404);
    await db.query(
      `UPDATE enrollments SET status='Halted',withdrawn_at=NULL,withdrawn_reason=NULL WHERE organization_id=$1`,
      [ORG],
    );
    assert.equal((await request([[0, 1]])).status, 403);
    await db.query(
      `UPDATE enrollments SET status='NotStarted' WHERE organization_id=$1`,
      [ORG],
    );
    await db.query(
      `UPDATE material_snapshots SET material_type='Reading',duration_seconds=NULL WHERE organization_id=$1`,
      [ORG],
    );
    assert.equal((await request([[0, 1]])).status, 409);
    await db.query(
      `UPDATE material_snapshots SET material_type='Video',duration_seconds=101,duration_as_of=now() WHERE organization_id=$1`,
      [ORG],
    );
    await db.query(
      `INSERT INTO lesson_snapshots(lesson_id,organization_id,course_id,disabled_at,disabled_as_of) VALUES($1,$2,$3,now(),now())`,
      [lesson, ORG, course],
    );
    assert.equal((await request([[0, 1]])).status, 403);
    assert.equal(calls, 0);
  });
  test('BR-184 Completed ignores ranges; Exempted accepts them; both accept position', async () => {
    for (const status of ['Completed', 'Exempted']) {
      await db.query(
        `UPDATE enrollments SET status=$2, first_activity_at=now(),completed_at=CASE WHEN $2='Completed' THEN now() ELSE NULL END,
         enrollment_type='Required', assigned_at=now(),expected_completion_days=1,base_due_at=now()+interval '1 day',due_at=now()+interval '1 day',
         completed_late=CASE WHEN $2='Completed' THEN false ELSE NULL END WHERE organization_id=$1`,
        [ORG, status],
      );
      const before = await row();
      await report([[0, status === 'Completed' ? 1 : 2]]);
      assert.equal((await row()).status, status);
      assert.equal(
        (await row()).watched_ranges,
        status === 'Completed' ? '{}' : '{[0,2)}',
      );
      assert.equal((await row()).position_seconds, 0);
      assert.deepEqual(
        (await row()).first_activity_at,
        before.first_activity_at,
      );
    }
  });
  test('BR-182 position-only reports clamp duration and do not write coverage or activity', async () => {
    const response = await request([], {}, 'POST', {
      positionSeconds: 999,
      reportedAt: clientReportedAt,
    });
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.positionSeconds, 101);
    assert.equal(data.watchedSeconds, 0);
    assert.equal(data.positionReportedAt, clientReportedAt);
    const saved = await row();
    assert.equal(saved.watched_ranges, '{}');
    assert.equal(saved.last_reported_at, null);
    assert.equal(saved.status, 'NotStarted');
    assert.equal(saved.first_activity_at, null);
    const read = (await (await request(undefined, {}, 'GET')).json()).data;
    assert.equal(read.positionSeconds, 101);
    assert.equal(read.positionReportedAt, clientReportedAt);
  });
  test('BR-182 stale and equal timestamps cannot overwrite a newer position, including backward seek', async () => {
    const base = Date.now() - 10000;
    for (const [positionSeconds, offset] of [
      [60, 2000],
      [8, 1000],
      [70, 2000],
      [5, 3000],
    ]) {
      assert.equal(
        (
          await request([], {}, 'POST', {
            positionSeconds,
            reportedAt: new Date(base + offset).toISOString(),
          })
        ).status,
        200,
      );
      assert.equal((await row()).position_seconds, offset === 3000 ? 5 : 60);
    }
  });
  test('BR-182 clamps timestamps over 60 seconds ahead to server time', async () => {
    const before = Date.now();
    const response = await request([], {}, 'POST', {
      positionSeconds: 9,
      reportedAt: new Date(before + 120000).toISOString(),
    });
    assert.equal(response.status, 200);
    const timestamp = Date.parse(
      (await response.json()).data.positionReportedAt,
    );
    assert.ok(timestamp >= before && timestamp <= Date.now());
  });
  test('BR-184 Completed preserves coverage, completion and coverage timestamps but updates position', async () => {
    await report([[0, 91]]);
    await db.query(
      "UPDATE enrollments SET status='Completed',completed_at=now() WHERE id=$1",
      [enrollment],
    );
    const before = await row();
    const response = await request([[91, 101]], {}, 'POST', {
      positionSeconds: 8,
      reportedAt: new Date(Date.parse(clientReportedAt) + 1000).toISOString(),
    });
    assert.equal(response.status, 200);
    const after = await row();
    for (const key of [
      'watched_ranges',
      'completed_at',
      'last_reported_at',
      'updated_at',
      'first_activity_at',
      'status',
    ])
      assert.deepEqual(after[key], before[key]);
    assert.equal(after.position_seconds, 8);
    assert.equal((await response.json()).data.completed, true);
  });
  test('playback applies I2 disabled flags and course mode returns 503', async () => {
    tree.modules[0].lessons[0].materials[0].disabledAt = new Date();
    assert.equal((await request(undefined, {}, 'GET')).status, 403);
    tree.modules[0].lessons[0].materials[0].disabledAt = null;
    app.get<VideoPlaybackConfig>(VIDEO_PLAYBACK_CONFIG).mode = 'course';
    const response = await request(undefined, {}, 'GET');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'PLAYBACK_UNAVAILABLE');
    app.get<VideoPlaybackConfig>(VIDEO_PLAYBACK_CONFIG).mode = 'fixture';
  });
});
