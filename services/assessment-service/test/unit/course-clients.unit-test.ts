/** The two ways of asking Course Service (COURSE_CLIENT_MODE): http (default) and fake. */
import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FakeCourseServiceClient } from '../../src/infrastructure/clients/course/fake-course-service.client';
import { HttpCourseServiceClient } from '../../src/infrastructure/clients/course/http-course-service.client';
import { COURSE, instructor, ORG, INSTRUCTOR, rejectsWith } from './fixtures';

Logger.overrideLogger(false); // the clients warn on purpose; keep the test output readable

const context = {
  courseId: COURSE,
  organizationId: ORG,
  instructorId: INSTRUCTOR,
  status: 'Published',
  locked: true,
  disabled: false,
};

describe('HttpCourseServiceClient', () => {
  let server: Server;
  let baseUrl: string;
  let mode: 'ok' | '404' | '500' | 'hang' = 'ok';
  let seen: { url?: string; headers?: IncomingHttpHeaders } = {};

  before(async () => {
    server = createServer((req, res) => {
      seen = { url: req.url, headers: req.headers };
      if (mode === 'hang') return; // never answers
      res.statusCode = mode === '404' ? 404 : mode === '500' ? 500 : 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({ statusCode: 200, message: 'ok', data: context }),
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
    new HttpCourseServiceClient(
      new ConfigService({
        COURSE_SERVICE_URL: url,
        INTERNAL_SERVICE_KEY: 'secret',
        COURSE_SERVICE_TIMEOUT_MS: timeoutMs,
      }),
    );

  test('returns the Course facts and sends the internal key and the caller identity', async () => {
    mode = 'ok';
    const result = await client().getAuthoringContext(COURSE, instructor);

    assert.deepEqual(result, context);
    assert.equal(seen.url, `/api/v1/courses/${COURSE}/authoring-context`);
    assert.equal(seen.headers?.['x-internal-key'], 'secret');
    assert.equal(seen.headers?.['x-user-id'], INSTRUCTOR);
    assert.equal(seen.headers?.['x-organization-id'], ORG);
    assert.equal(seen.headers?.['x-user-role'], 'INSTRUCTOR');
  });

  test('setAssignmentMinutes posts the total with the internal key and the caller identity', async () => {
    mode = 'ok';
    let body = '';
    server.once('request', (req) => {
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    });
    await client().setAssignmentMinutes(COURSE, 135, instructor);
    assert.equal(seen.url, `/api/v1/internal/courses/${COURSE}/assignment-minutes`);
    assert.equal(seen.headers?.['x-internal-key'], 'secret');
    assert.equal(seen.headers?.['x-organization-id'], ORG);
    assert.deepEqual(JSON.parse(body), { minutes: 135 });
  });

  test('setAssignmentMinutes: 404 is COURSE_NOT_FOUND, any other failure is a 503', async () => {
    mode = '404';
    await rejectsWith(
      client().setAssignmentMinutes(COURSE, 1, instructor),
      NotFoundException,
      'COURSE_NOT_FOUND',
    );
    mode = '500';
    await rejectsWith(
      client().setAssignmentMinutes(COURSE, 1, instructor),
      ServiceUnavailableException,
      'COURSE_SERVICE_UNAVAILABLE',
    );
    mode = 'ok';
  });

  test('404 from Course Service is a 404 here (COURSE_NOT_FOUND)', async () => {
    mode = '404';
    await rejectsWith(
      client().getAuthoringContext(COURSE, instructor),
      NotFoundException,
      'COURSE_NOT_FOUND',
    );
  });

  test('any other failure is a 503 (COURSE_SERVICE_UNAVAILABLE)', async () => {
    mode = '500';
    await rejectsWith(
      client().getAuthoringContext(COURSE, instructor),
      ServiceUnavailableException,
      'COURSE_SERVICE_UNAVAILABLE',
    );
  });

  test('nothing listening is a 503, not a crash', async () => {
    await rejectsWith(
      client('http://127.0.0.1:9').getAuthoringContext(COURSE, instructor),
      ServiceUnavailableException,
      'COURSE_SERVICE_UNAVAILABLE',
    );
  });

  test('a Course Service that never answers times out into a 503', async () => {
    mode = 'hang';
    await rejectsWith(
      client(baseUrl, '200').getAuthoringContext(COURSE, instructor),
      ServiceUnavailableException,
      'COURSE_SERVICE_UNAVAILABLE',
    );
  });

  test('needs INTERNAL_SERVICE_KEY to start', () => {
    assert.throws(
      () => new HttpCourseServiceClient(new ConfigService({})),
      /INTERNAL_SERVICE_KEY/,
    );
  });
});

describe('FakeCourseServiceClient', () => {
  const fake = (env: Record<string, string> = {}) =>
    new FakeCourseServiceClient(new ConfigService(env));

  test('treats the Course as an unlocked Draft owned by the caller', async () => {
    const result = await fake().getAuthoringContext(COURSE, instructor);
    assert.deepEqual(result, {
      courseId: COURSE,
      organizationId: ORG,
      instructorId: INSTRUCTOR,
      status: 'Draft',
      locked: false,
      disabled: false,
    });
  });

  test('FAKE_COURSE_STATUS and FAKE_COURSE_LOCKED pick the branch to try', async () => {
    const result = await fake({
      FAKE_COURSE_STATUS: 'Submitted',
      FAKE_COURSE_LOCKED: 'true',
    }).getAuthoringContext(COURSE, instructor);
    assert.equal(result.status, 'Submitted');
    assert.equal(result.locked, true);

    const notLocked = await fake({
      FAKE_COURSE_LOCKED: 'false',
    }).getAuthoringContext(COURSE, instructor);
    assert.equal(notLocked.locked, false);
  });
});
