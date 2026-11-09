/** UC28.1: the client that asks assessment-service for the results of a Learner, and the service that shows them. */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import {
  AssessmentResultsUnavailableError,
  createAssessmentResultsClient,
  FakeAssessmentResultsClient,
  HttpAssessmentResultsClient,
  validateAssessmentResults,
  type AssessmentResultItem,
  type AssessmentResultsClient,
} from '../../src/infrastructure/clients/assessment/assessment-results.client';
import {
  AssessmentResultsService,
  summarize,
} from '../../src/modules/curriculum/assessment-results.service';
import type { CurriculumService } from '../../src/modules/curriculum/curriculum.service';

const ORG = '0199a000-0000-7000-8000-0a0000000001';
const COURSE = '0199a000-0000-7000-8000-0e0000000002';
const ENROLLMENT = '0199a000-0000-7000-8000-2a0000000002';
const A1 = '0199a000-0000-7000-8000-3a0000000001';
const A2 = '0199a000-0000-7000-8000-3a0000000002';
const A3 = '0199a000-0000-7000-8000-3a0000000003';
const LEARNER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  role: 'LEARNER',
  isAuthenticated: true,
  organizationId: ORG,
};
const NOW = '2026-11-05T10:00:00.000Z';

const quizItem = (over: Record<string, unknown> = {}): Record<string, any> => ({
  assessmentId: A1,
  kind: 'QUIZ',
  title: 'Quiz an toàn',
  isRequired: true,
  disabled: false,
  passingScore: 70,
  status: 'Completed',
  recordedScore: 85,
  passed: true,
  attemptCount: 2,
  lastActivityAt: NOW,
  quiz: {
    bestAttemptNumber: 2,
    attempts: [
      {
        attemptNumber: 1,
        score: 50,
        submittedAt: NOW,
        submissionKind: 'Manual',
      },
      {
        attemptNumber: 2,
        score: 85,
        submittedAt: NOW,
        submissionKind: 'TimedOut',
      },
    ],
  },
  assignment: null,
  ...over,
});
const assignmentItem = (
  over: Record<string, unknown> = {},
): Record<string, any> => ({
  assessmentId: A2,
  kind: 'ASSIGNMENT',
  title: 'Bài luận',
  isRequired: true,
  disabled: false,
  passingScore: 60,
  status: 'AwaitingResult',
  recordedScore: null,
  passed: null,
  attemptCount: 1,
  lastActivityAt: NOW,
  quiz: null,
  assignment: {
    latestSubmissionNumber: 1,
    gradingStatus: 'AwaitingInstructor',
  },
  ...over,
});
const good = () => ({
  courseId: COURSE,
  items: [quizItem(), assignmentItem()],
});
const rejects = (value: unknown, why: string) =>
  assert.throws(
    () => validateAssessmentResults(value, COURSE),
    (error) =>
      error instanceof AssessmentResultsUnavailableError &&
      error.reason === 'INVALID_RESPONSE',
    why,
  );

describe('validateAssessmentResults', () => {
  test('a good answer passes and comes back as it is', () => {
    assert.deepEqual(validateAssessmentResults(good(), COURSE), good());
    assert.deepEqual(
      validateAssessmentResults({ courseId: COURSE, items: [] }, COURSE),
      {
        courseId: COURSE,
        items: [],
      },
    );
  });

  test('the answer must be about the Course that was asked for, and be an object with a list', () => {
    rejects({ ...good(), courseId: A3 }, 'another Course');
    rejects(null, 'null');
    rejects([], 'an array');
    rejects('x', 'a string');
    rejects({ courseId: COURSE }, 'no items');
    rejects({ courseId: COURSE, items: {} }, 'items is not a list');
  });

  test('each field of an item is checked', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['an id that is not a UUID', { assessmentId: 'x' }],
      ['an unknown kind', { kind: 'EXAM' }],
      ['an empty title', { title: '' }],
      ['isRequired not a boolean', { isRequired: 'yes' }],
      ['disabled missing', { disabled: undefined }],
      ['a passing score above 100', { passingScore: 101 }],
      ['a negative passing score', { passingScore: -1 }],
      ['a passing score that is a string', { passingScore: '70' }],
      ['an unknown status', { status: 'Failed' }],
      ['a score above 100', { recordedScore: 120, passed: true }],
      ['a score that is not a number', { recordedScore: 'a', passed: true }],
      ['a negative count', { attemptCount: -1 }],
      ['a fractional count', { attemptCount: 1.5 }],
      ['a date without the Z', { lastActivityAt: '2026-11-05T10:00:00+07:00' }],
      [
        'a date that does not exist',
        { lastActivityAt: '2026-13-45T10:00:00Z' },
      ],
    ];
    for (const [why, over] of cases)
      rejects({ courseId: COURSE, items: [quizItem(over)] }, why);
    rejects(
      { courseId: COURSE, items: ['x'] },
      'an item that is not an object',
    );
  });

  test('a score and its verdict come together, and the verdict is the one the passing score gives', () => {
    rejects(
      { courseId: COURSE, items: [quizItem({ recordedScore: null })] },
      'a verdict without a score',
    );
    rejects(
      { courseId: COURSE, items: [quizItem({ passed: null })] },
      'a score without a verdict',
    );
    rejects(
      {
        courseId: COURSE,
        items: [quizItem({ recordedScore: 85, passed: false })],
      },
      '85 is not below 70',
    );
    rejects(
      {
        courseId: COURSE,
        items: [quizItem({ recordedScore: 50, passed: true })],
      },
      '50 is not above 70',
    );
    assert.doesNotThrow(() =>
      validateAssessmentResults(
        {
          courseId: COURSE,
          items: [quizItem({ recordedScore: 70, passed: true })],
        },
        COURSE,
      ),
    );
    rejects(
      {
        courseId: COURSE,
        items: [
          quizItem({ status: 'Completed', recordedScore: null, passed: null }),
        ],
      },
      'Completed with no score',
    );
  });

  test('a Quiz has its attempts and no assignment part; an Assignment the other way round', () => {
    rejects(
      { courseId: COURSE, items: [quizItem({ quiz: null })] },
      'a Quiz without attempts',
    );
    rejects(
      {
        courseId: COURSE,
        items: [
          quizItem({
            assignment: { latestSubmissionNumber: 1, gradingStatus: 'x' },
          }),
        ],
      },
      'a Quiz with an assignment part',
    );
    rejects(
      { courseId: COURSE, items: [assignmentItem({ assignment: null })] },
      'an Assignment without its part',
    );
    rejects(
      {
        courseId: COURSE,
        items: [
          assignmentItem({ quiz: { bestAttemptNumber: null, attempts: [] } }),
        ],
      },
      'an Assignment with a quiz part',
    );
    rejects(
      {
        courseId: COURSE,
        items: [
          quizItem({
            quiz: {
              bestAttemptNumber: 1,
              attempts: [
                {
                  attemptNumber: 1,
                  score: 101,
                  submittedAt: NOW,
                  submissionKind: null,
                },
              ],
            },
          }),
        ],
      },
      'an attempt score above 100',
    );
    rejects(
      {
        courseId: COURSE,
        items: [
          quizItem({
            quiz: {
              bestAttemptNumber: 1,
              attempts: [
                {
                  attemptNumber: 1,
                  score: 50,
                  submittedAt: 'x',
                  submissionKind: null,
                },
              ],
            },
          }),
        ],
      },
      'an attempt date',
    );
    rejects(
      {
        courseId: COURSE,
        items: [quizItem({ quiz: { bestAttemptNumber: 'a', attempts: [] } })],
      },
      'a best attempt that is not a number',
    );
    rejects(
      {
        courseId: COURSE,
        items: [
          assignmentItem({
            assignment: { latestSubmissionNumber: 1, gradingStatus: '' },
          }),
        ],
      },
      'an empty grading status',
    );
  });

  test('the same component twice is not an answer', () => {
    rejects(
      { courseId: COURSE, items: [quizItem(), quizItem()] },
      'duplicate id',
    );
  });
});

describe('summarize', () => {
  const item = (over: Partial<AssessmentResultItem>) =>
    ({ ...quizItem(), ...over }) as AssessmentResultItem;

  test('counts passed, not passed and pending, and leaves the disabled ones out (BR-296)', () => {
    assert.deepEqual(
      summarize([
        item({ passed: true }),
        item({ assessmentId: A2, passed: false, recordedScore: 10 }),
        item({
          assessmentId: A3,
          passed: null,
          recordedScore: null,
          status: 'AwaitingResult',
        }),
        item({
          assessmentId: '0199a000-0000-7000-8000-3a0000000004',
          passed: true,
          disabled: true,
        }),
      ]),
      { total: 3, passed: 1, notPassed: 1, pending: 1 },
    );
  });

  test('an empty list is all zeros', () => {
    assert.deepEqual(summarize([]), {
      total: 0,
      passed: 0,
      notPassed: 0,
      pending: 0,
    });
  });
});

describe('AssessmentResultsService', () => {
  const quiet = () => {
    const warn = Logger.prototype.warn;
    Logger.prototype.warn = () => undefined;
    return () => (Logger.prototype.warn = warn);
  };
  const build = (
    getResults: AssessmentResultsClient['getResults'],
    findAccessible: (user: CurrentUser, id: string) => Promise<any> = () =>
      Promise.resolve({
        id: ENROLLMENT,
        courseId: COURSE,
        status: 'InProgress',
      }),
  ) => {
    const calls = { access: 0, results: [] as string[] };
    const curriculum = {
      findAccessibleEnrollment: (user: CurrentUser, id: string) => {
        calls.access += 1;
        return findAccessible(user, id);
      },
    } as unknown as CurriculumService;
    const client: AssessmentResultsClient = {
      getResults: (user, courseId) => {
        calls.results.push(courseId);
        return getResults(user, courseId);
      },
    };
    return { calls, service: new AssessmentResultsService(curriculum, client) };
  };

  test('the results of the Course of the Enrollment, with the summary', async () => {
    const { service, calls } = build(() =>
      Promise.resolve(validateAssessmentResults(good(), COURSE)),
    );
    const view = await service.getResults(LEARNER, ENROLLMENT);
    assert.equal(view.state, 'ok');
    assert.deepEqual(view.enrollment, {
      id: ENROLLMENT,
      courseId: COURSE,
      status: 'InProgress',
    });
    assert.deepEqual(view.summary, {
      total: 2,
      passed: 1,
      notPassed: 0,
      pending: 1,
    });
    assert.equal(view.items?.length, 2);
    assert.deepEqual(
      calls.results,
      [COURSE],
      'asks about the Course of the Enrollment, not one the caller names',
    );
  });

  test('a Completed Enrollment still shows its results: they are history', async () => {
    const { service } = build(
      () => Promise.resolve({ courseId: COURSE, items: [] }),
      () =>
        Promise.resolve({
          id: ENROLLMENT,
          courseId: COURSE,
          status: 'Completed',
        }),
    );
    const view = await service.getResults(LEARNER, ENROLLMENT);
    assert.equal(view.state, 'ok');
    assert.equal(view.enrollment.status, 'Completed');
    assert.deepEqual(view.summary, {
      total: 0,
      passed: 0,
      notPassed: 0,
      pending: 0,
    });
  });

  test('when assessment-service cannot be asked the answer says so; it is not an empty list and not an error', async () => {
    const restore = quiet();
    try {
      for (const reason of [
        'UNREACHABLE',
        'HTTP_ERROR',
        'INVALID_RESPONSE',
      ] as const) {
        const { service } = build(() =>
          Promise.reject(new AssessmentResultsUnavailableError(reason, 503)),
        );
        const view = await service.getResults(LEARNER, ENROLLMENT);
        assert.equal(view.state, 'unavailable', reason);
        assert.equal(view.items, undefined);
        assert.equal(view.summary, undefined);
        assert.equal(view.enrollment.id, ENROLLMENT);
      }
    } finally {
      restore();
    }
  });

  test('a failure that is not about assessment-service is not hidden', async () => {
    const { service } = build(() => Promise.reject(new Error('bug')));
    await assert.rejects(() => service.getResults(LEARNER, ENROLLMENT), /bug/);
  });

  test('an Enrollment that is not the caller’s, or is Halted, stops before assessment-service is asked', async () => {
    for (const error of [
      new NotFoundException('x'),
      new ForbiddenException('y'),
    ]) {
      const { service, calls } = build(
        () => Promise.resolve({ courseId: COURSE, items: [] }),
        () => Promise.reject(error),
      );
      await assert.rejects(
        () => service.getResults(LEARNER, ENROLLMENT),
        (e) => e === error,
      );
      assert.deepEqual(calls.results, []);
    }
  });
});

describe('the client over HTTP', () => {
  let server: Server | undefined;
  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (!server) return resolve();
      server.closeAllConnections();
      server.close(() => resolve());
      server = undefined;
    });
  });
  const serve = async (
    handler: (
      req: import('node:http').IncomingMessage,
      res: import('node:http').ServerResponse,
    ) => void,
  ) => {
    server = createServer(handler);
    await new Promise<void>((resolve) =>
      server!.listen(0, '127.0.0.1', resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };
  const reply = (
    res: import('node:http').ServerResponse,
    status: number,
    body: unknown,
  ) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const failure = async (
    promise: Promise<unknown>,
    reason: string,
    status?: number,
  ) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof AssessmentResultsUnavailableError);
      assert.equal(error.reason, reason);
      if (status !== undefined) assert.equal(error.httpStatus, status);
      return true;
    });
  };

  test('asks the internal endpoint of this Learner and Course with the key and the identity of the caller, and returns the data', async () => {
    let seen: { url?: string; headers?: Record<string, unknown> } = {};
    const url = await serve((req, res) => {
      seen = { url: req.url, headers: req.headers };
      reply(res, 200, { statusCode: 200, data: good() });
    });
    const client = new HttpAssessmentResultsClient(url, 'secret', 2000);
    const results = await client.getResults(LEARNER, COURSE);
    assert.deepEqual(results, good());
    assert.equal(
      seen.url,
      `/api/v1/internal/learners/${LEARNER.userId}/courses/${COURSE}/assessment-results`,
    );
    assert.equal(seen.headers?.['x-internal-key'], 'secret');
    assert.equal(seen.headers?.['x-user-id'], LEARNER.userId);
    assert.equal(seen.headers?.['x-user-role'], 'LEARNER');
    assert.equal(seen.headers?.['x-organization-id'], ORG);
  });

  test('an error status, a body that is not JSON and a body that is not the contract are told apart', async () => {
    const url = await serve((req, res) => {
      if (req.url?.includes('0199a000-0000-7000-8000-0e00000000a1'))
        return reply(res, 503, {});
      if (req.url?.includes('0199a000-0000-7000-8000-0e00000000a2'))
        return reply(res, 200, 'not json');
      if (req.url?.includes('0199a000-0000-7000-8000-0e00000000a3'))
        return reply(res, 200, { data: { courseId: COURSE, items: 'x' } });
      reply(res, 200, { data: null });
    });
    const client = new HttpAssessmentResultsClient(url, 'k', 2000);
    await failure(
      client.getResults(LEARNER, '0199a000-0000-7000-8000-0e00000000a1'),
      'HTTP_ERROR',
      503,
    );
    await failure(
      client.getResults(LEARNER, '0199a000-0000-7000-8000-0e00000000a2'),
      'INVALID_RESPONSE',
      200,
    );
    await failure(
      client.getResults(LEARNER, '0199a000-0000-7000-8000-0e00000000a3'),
      'INVALID_RESPONSE',
    );
    await failure(
      client.getResults(LEARNER, '0199a000-0000-7000-8000-0e00000000a4'),
      'INVALID_RESPONSE',
    );
  });

  test('a service that does not answer in time, or is not there, is UNREACHABLE', async () => {
    const url = await serve(() => undefined); // never answers
    await failure(
      new HttpAssessmentResultsClient(url, 'k', 150).getResults(
        LEARNER,
        COURSE,
      ),
      'UNREACHABLE',
    );
    await failure(
      new HttpAssessmentResultsClient(
        'http://127.0.0.1:1',
        'k',
        500,
      ).getResults(LEARNER, COURSE),
      'UNREACHABLE',
    );
  });
});

describe('createAssessmentResultsClient', () => {
  const env = (values: Record<string, string>) => (key: string) => values[key];

  test('http is the default and needs the internal key; the URL is checked', () => {
    assert.ok(
      createAssessmentResultsClient(
        env({ INTERNAL_SERVICE_KEY: 'k' }),
      ) instanceof HttpAssessmentResultsClient,
    );
    assert.throws(
      () => createAssessmentResultsClient(env({})),
      /INTERNAL_SERVICE_KEY/,
    );
    assert.throws(
      () =>
        createAssessmentResultsClient(
          env({
            INTERNAL_SERVICE_KEY: 'k',
            ASSESSMENT_SERVICE_URL: 'not a url',
          }),
        ),
      /ASSESSMENT_SERVICE_URL/,
    );
    for (const bad of [
      'ftp://x',
      'http://user:pw@x',
      'http://x?a=1',
      'http://x#f',
    ]) {
      assert.throws(
        () =>
          createAssessmentResultsClient(
            env({ INTERNAL_SERVICE_KEY: 'k', ASSESSMENT_SERVICE_URL: bad }),
          ),
        /ASSESSMENT_SERVICE_URL/,
        bad,
      );
    }
    assert.throws(
      () =>
        createAssessmentResultsClient(
          env({
            INTERNAL_SERVICE_KEY: 'k',
            ASSESSMENT_RESULTS_TIMEOUT_MS: '0',
          }),
        ),
      /TIMEOUT/,
    );
    assert.throws(
      () =>
        createAssessmentResultsClient(
          env({
            INTERNAL_SERVICE_KEY: 'k',
            ASSESSMENT_RESULTS_CLIENT_MODE: 'smtp',
          }),
        ),
      /fake hoặc http/,
    );
  });

  test('fake is for demos, refused in production, and has sample results only for the Courses listed', async () => {
    assert.throws(
      () =>
        createAssessmentResultsClient(
          env({
            ASSESSMENT_RESULTS_CLIENT_MODE: 'fake',
            NODE_ENV: 'production',
          }),
        ),
      /production/,
    );
    assert.throws(
      () =>
        createAssessmentResultsClient(
          env({
            ASSESSMENT_RESULTS_CLIENT_MODE: 'fake',
            ASSESSMENT_FAKE_RESULT_COURSE_IDS: 'x',
          }),
        ),
      /UUID/,
    );
    const client = createAssessmentResultsClient(
      env({
        ASSESSMENT_RESULTS_CLIENT_MODE: 'fake',
        ASSESSMENT_FAKE_RESULT_COURSE_IDS: COURSE.toUpperCase(),
      }),
    );
    assert.ok(client instanceof FakeAssessmentResultsClient);
    const sample = await client.getResults(LEARNER, COURSE);
    assert.equal(sample.items.length, 2);
    assert.doesNotThrow(
      () => validateAssessmentResults(sample, COURSE),
      'the sample follows the contract',
    );
    assert.deepEqual((await client.getResults(LEARNER, A3)).items, []);
  });
});
