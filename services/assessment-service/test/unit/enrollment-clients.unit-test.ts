/** The two ways of asking Learning Service (ENROLLMENT_CLIENT_MODE): http (default) and fake. */
import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, mock, test } from 'node:test';
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

type Mode =
  | 'ok'
  | 'not-found'
  | 'not-found-without-code'
  | '500'
  | 'hang'
  | 'no-data'
  | 'junk';

describe('HttpEnrollmentClient', () => {
  let server: Server;
  let baseUrl: string;
  let mode: Mode = 'ok';
  let seen: { url?: string; headers?: IncomingHttpHeaders } = {};
  /** What the answer carries in data when the mode is ok. */
  let answer: Record<string, unknown> = {};

  const reset = () => {
    mode = 'ok';
    answer = { enrollmentId: ENROLLMENT, status: 'InProgress', access: 'Full' };
  };

  before(async () => {
    server = createServer((req, res) => {
      seen = { url: req.url, headers: req.headers };
      if (mode === 'hang') return; // never answers
      res.setHeader('content-type', 'application/json');
      if (mode === 'not-found') {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            statusCode: 404,
            error: { code: 'ENROLLMENT_NOT_FOUND', message: 'none' },
          }),
        );
      } else if (mode === 'not-found-without-code') {
        res.statusCode = 404;
        res.end(JSON.stringify({ statusCode: 404, error: { message: 'no route' } }));
      } else if (mode === '500') {
        res.statusCode = 500;
        res.end('{}');
      } else if (mode === 'junk') {
        res.statusCode = 200;
        res.end('this is not json');
      } else {
        res.statusCode = 200;
        res.end(
          JSON.stringify(
            mode === 'no-data'
              ? { statusCode: 200, message: 'ok' }
              : { statusCode: 200, message: 'ok', data: answer },
          ),
        );
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = (url = baseUrl, timeoutMs?: string) =>
    new HttpEnrollmentClient(
      new ConfigService({
        LEARNING_SERVICE_URL: url,
        INTERNAL_SERVICE_KEY: 'secret',
        ...(timeoutMs ? { LEARNING_SERVICE_TIMEOUT_MS: timeoutMs } : {}),
      }),
    );

  test('asks assessment-access for the Learner and the Course, with the internal key and the Learner identity', async () => {
    reset();
    const found = await client().getAssessmentAccess(COURSE, learner);
    assert.deepEqual(found, {
      enrollmentId: ENROLLMENT,
      status: 'InProgress',
      access: 'Full',
    });
    const url = new URL(seen.url ?? '', 'http://x');
    assert.equal(url.pathname, '/api/v1/internal/enrollments/assessment-access');
    assert.equal(url.searchParams.get('learnerId'), learner.userId);
    assert.equal(url.searchParams.get('courseId'), COURSE);
    assert.equal(seen.headers?.['x-internal-key'], 'secret');
    assert.equal(seen.headers?.['x-user-id'], learner.userId);
    assert.equal(seen.headers?.['x-organization-id'], learner.organizationId);
    assert.equal(seen.headers?.['x-user-role'], 'LEARNER');
  });

  test('Full, ReadOnly and None come through with the status of the Enrollment (BR-210)', async () => {
    reset();
    for (const [status, access] of [
      ['NotStarted', 'Full'],
      ['Exempted', 'Full'],
      ['Completed', 'ReadOnly'],
      ['Halted', 'None'],
      ['Withdrawn', 'None'],
    ] as const) {
      answer = { enrollmentId: ENROLLMENT, status, access };
      assert.deepEqual(await client().getAssessmentAccess(COURSE, learner), {
        enrollmentId: ENROLLMENT,
        status,
        access,
      });
    }
  });

  test('ENROLLMENT_NOT_FOUND gives null: the Learner is not enrolled in the Course', async () => {
    reset();
    mode = 'not-found';
    assert.equal(await client().getAssessmentAccess(OTHER_COURSE, learner), null);
  });

  test('a 404 without that code is a 503, never "not enrolled" (for example a learning-service without this route)', async () => {
    reset();
    mode = 'not-found-without-code';
    await rejectsWith(
      client().getAssessmentAccess(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
  });

  test('an error answer, no answer or a slow answer is a 503 (LEARNING_SERVICE_UNAVAILABLE)', async () => {
    reset();
    mode = '500';
    await rejectsWith(
      client().getAssessmentAccess(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    reset();
    await rejectsWith(
      client('http://127.0.0.1:1').getAssessmentAccess(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    mode = 'hang';
    await rejectsWith(
      client(baseUrl, '200').getAssessmentAccess(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
  });

  test('an answer without the agreed shape is a 503: what cannot be read is not trusted', async () => {
    reset();
    mode = 'junk';
    await rejectsWith(
      client().getAssessmentAccess(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    mode = 'no-data';
    await rejectsWith(
      client().getAssessmentAccess(COURSE, learner),
      ServiceUnavailableException,
      'LEARNING_SERVICE_UNAVAILABLE',
    );
    mode = 'ok';
    for (const bad of [
      { enrollmentId: ENROLLMENT, status: 'InProgress', access: 'Maybe' },
      { enrollmentId: ENROLLMENT, status: 'InProgress' },
      { enrollmentId: 7, status: 'InProgress', access: 'Full' },
      { enrollmentId: ENROLLMENT, status: null, access: 'Full' },
      { enrollmentId: 'not-a-uuid', status: 'InProgress', access: 'Full' },
      { enrollmentId: ENROLLMENT, status: 'Overdue', access: 'Full' },
    ]) {
      answer = bad;
      await rejectsWith(
        client().getAssessmentAccess(COURSE, learner),
        ServiceUnavailableException,
        'LEARNING_SERVICE_UNAVAILABLE',
      );
    }
  });

  test('a status and an access that contradict each other is a 503: Completed + Full or Halted + Full would allow a write', async () => {
    reset();
    for (const [status, access] of [
      ['Completed', 'Full'],
      ['Completed', 'None'],
      ['Halted', 'Full'],
      ['Halted', 'ReadOnly'],
      ['Withdrawn', 'Full'],
      ['InProgress', 'ReadOnly'],
      ['InProgress', 'None'],
      ['Exempted', 'ReadOnly'],
      ['NotStarted', 'None'],
    ] as const) {
      answer = { enrollmentId: ENROLLMENT, status, access };
      await rejectsWith(
        client().getAssessmentAccess(COURSE, learner),
        ServiceUnavailableException,
        'LEARNING_SERVICE_UNAVAILABLE',
      );
    }
  });

  test('a rejected answer is logged with a short reason code, and never with its values', async () => {
    reset();
    const warn = mock.method(Logger.prototype, 'warn', () => undefined);
    try {
      const reasonOf = async (bad: Record<string, unknown>) => {
        warn.mock.resetCalls();
        answer = bad;
        await rejectsWith(
          client().getAssessmentAccess(COURSE, learner),
          ServiceUnavailableException,
          'LEARNING_SERVICE_UNAVAILABLE',
        );
        return String(warn.mock.calls[0]?.arguments[0]);
      };
      assert.match(
        await reasonOf({ enrollmentId: 'not-a-uuid', status: 'InProgress', access: 'Full' }),
        /INVALID_ENROLLMENT_ID/,
      );
      assert.match(
        await reasonOf({ enrollmentId: ENROLLMENT, status: 'Overdue', access: 'Full' }),
        /INVALID_STATUS/,
      );
      assert.match(
        await reasonOf({ enrollmentId: ENROLLMENT, status: 'Completed', access: 'Full' }),
        /ACCESS_MISMATCH/,
      );
      const withValues = await reasonOf({
        enrollmentId: ENROLLMENT,
        status: 'SomethingSecret42',
        access: 'Full',
      });
      assert.equal(withValues.includes('SomethingSecret42'), false);
      mode = 'no-data';
      warn.mock.resetCalls();
      await rejectsWith(
        client().getAssessmentAccess(COURSE, learner),
        ServiceUnavailableException,
        'LEARNING_SERVICE_UNAVAILABLE',
      );
      assert.match(String(warn.mock.calls[0]?.arguments[0]), /NO_DATA/);
    } finally {
      warn.mock.restore();
      reset();
    }
  });

  test('the timeout is 2 seconds unless LEARNING_SERVICE_TIMEOUT_MS says otherwise', () => {
    const timeoutOf = (c: HttpEnrollmentClient) =>
      (c as unknown as { timeoutMs: number }).timeoutMs;
    assert.equal(timeoutOf(client()), 2000);
    assert.equal(timeoutOf(client(baseUrl, '750')), 750);
  });
});

describe('FakeEnrollmentClient', () => {
  test('every Learner is enrolled in every Course with Full access and a stable Enrollment id', async () => {
    const fake = new FakeEnrollmentClient();
    const a = await fake.getAssessmentAccess(COURSE, learner);
    const b = await fake.getAssessmentAccess(COURSE, learner);
    assert.equal(a?.access, 'Full');
    assert.equal(a?.enrollmentId, b?.enrollmentId);
    assert.equal(a?.enrollmentId, fakeEnrollmentId(learner.userId, COURSE));
    assert.notEqual(
      (await fake.getAssessmentAccess(OTHER_COURSE, learner))?.enrollmentId,
      a?.enrollmentId,
    );
    assert.match(
      a?.enrollmentId ?? '',
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/,
    );
  });
});
