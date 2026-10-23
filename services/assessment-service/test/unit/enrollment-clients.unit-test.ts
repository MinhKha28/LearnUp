/** The two ways of asking Learning Service (ENROLLMENT_CLIENT_MODE): http (default) and fake. */
import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FakeEnrollmentClient,
  fakeEnrollmentId,
} from '../../src/infrastructure/clients/learning/fake-enrollment.client';
import { HttpEnrollmentClient } from '../../src/infrastructure/clients/learning/http-enrollment.client';
import { COURSE, instructor, rejectsWith } from './fixtures';

Logger.overrideLogger(false); // the clients warn on purpose; keep the test output readable

const OTHER_COURSE = '00000000-0000-4000-8000-0000000000c9';
const ENROLLMENT = '00000000-0000-4000-8000-0000000000e1';
const learner = { ...instructor, role: 'LEARNER' as const };

describe('HttpEnrollmentClient', () => {
  let server: Server;
  let baseUrl: string;
  let mode: 'ok' | '500' | 'hang' = 'ok';
  let seen: { url?: string; headers?: IncomingHttpHeaders } = {};
  /** What the answer carries as status; undefined = no status in the answer. */
  let status: unknown;

  before(async () => {
    server = createServer((req, res) => {
      seen = { url: req.url, headers: req.headers };
      if (mode === 'hang') return; // never answers
      res.statusCode = mode === '500' ? 500 : 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          statusCode: 200,
          message: 'ok',
          data: [
            {
              courseId: COURSE,
              enrollmentId: ENROLLMENT,
              ...(status === undefined ? {} : { status }),
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = (url = baseUrl, timeoutMs = '2000') =>
    new HttpEnrollmentClient(
      new ConfigService({
        LEARNING_SERVICE_URL: url,
        INTERNAL_SERVICE_KEY: 'secret',
        LEARNING_SERVICE_TIMEOUT_MS: timeoutMs,
      }),
    );

  test('finds the Enrollment of the Course and sends the internal key and the Learner identity', async () => {
    mode = 'ok';
    const found = await client().findEnrollment(COURSE, learner);
    assert.deepEqual(found, { courseId: COURSE, enrollmentId: ENROLLMENT });
    assert.equal(seen.url, '/api/v1/enrollments/me/course-ids');
    assert.equal(seen.headers?.['x-internal-key'], 'secret');
    assert.equal(seen.headers?.['x-user-id'], learner.userId);
    assert.equal(seen.headers?.['x-user-role'], 'LEARNER');
  });

  test('the status of the Enrollment comes through when Learning Service sends one (BR-169)', async () => {
    mode = 'ok';
    status = 'Completed';
    assert.deepEqual(await client().findEnrollment(COURSE, learner), {
      courseId: COURSE,
      enrollmentId: ENROLLMENT,
      status: 'Completed',
    });
    status = undefined;
  });

  test('a status that is not a string is left out, so it is never trusted', async () => {
    mode = 'ok';
    for (const odd of [null, 7, { x: 1 }, true]) {
      status = odd;
      const found = await client().findEnrollment(COURSE, learner);
      assert.deepEqual(found, { courseId: COURSE, enrollmentId: ENROLLMENT });
    }
    status = undefined;
  });

  test('reportLearningActivity posts the time with the internal key and the Learner identity (BR-119)', async () => {
    mode = 'ok';
    let body = '';
    server.once('request', (req) => {
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    });
    const at = new Date('2026-10-18T03:00:00Z');
    await client().reportLearningActivity(ENROLLMENT, at, learner);
    assert.equal(
      seen.url,
      `/api/v1/internal/enrollments/${ENROLLMENT}/learning-activity`,
    );
    assert.equal(seen.headers?.['x-internal-key'], 'secret');
    assert.equal(seen.headers?.['x-user-id'], learner.userId);
    assert.deepEqual(JSON.parse(body), { occurredAt: at.toISOString() });
  });

  test('reportLearningActivity: an error answer or no answer is a 503 (LEARNING_SERVICE_UNAVAILABLE)', async () => {
    mode = '500';
    await rejectsWith(
      client().reportLearningActivity(ENROLLMENT, new Date(), learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    mode = 'ok';
    await rejectsWith(
      client('http://127.0.0.1:1').reportLearningActivity(
        ENROLLMENT,
        new Date(),
        learner,
      ),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
  });

  test('a Course the Learner is not enrolled in gives null', async () => {
    mode = 'ok';
    assert.equal(await client().findEnrollment(OTHER_COURSE, learner), null);
  });

  test('an error answer, no answer or a slow answer is a 503 (LEARNING_SERVICE_UNAVAILABLE)', async () => {
    mode = '500';
    await rejectsWith(
      client().findEnrollment(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    await rejectsWith(
      client('http://127.0.0.1:1').findEnrollment(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    mode = 'hang';
    await rejectsWith(
      client(baseUrl, '200').findEnrollment(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
  });
});

describe('FakeEnrollmentClient', () => {
  test('every Learner is enrolled in every Course, with a stable Enrollment id', async () => {
    const fake = new FakeEnrollmentClient();
    const a = await fake.findEnrollment(COURSE, learner);
    const b = await fake.findEnrollment(COURSE, learner);
    assert.equal(a?.enrollmentId, b?.enrollmentId);
    assert.equal(a?.enrollmentId, fakeEnrollmentId(learner.userId, COURSE));
    assert.notEqual(
      (await fake.findEnrollment(OTHER_COURSE, learner))?.enrollmentId,
      a?.enrollmentId,
    );
    assert.match(a.enrollmentId, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  });

  test('it tells nobody about the activity and does not fail', async () => {
    await new FakeEnrollmentClient().reportLearningActivity();
  });
});
