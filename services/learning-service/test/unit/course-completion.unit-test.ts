import { Logger } from '@nestjs/common';
import { mock } from 'node:test';
import { CompletionService } from '../../src/modules/course-completion/completion.service';
import {
  CompletionRepository,
  CompletionRequest,
} from '../../src/modules/course-completion/completion.repository';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
  CompletionClientError,
  validateCompletionSnapshot,
  createCompletionClient,
  FakeAssessmentCompletionClient,
} from '../../src/infrastructure/clients/assessment/assessment-completion.client';
import { readCompletionConfig } from '../../src/modules/course-completion/completion.config';

export function snapshot() {
  return {
    schemaVersion: 1,
    snapshotId: randomUUID(),
    asOf: new Date().toISOString(),
    revision: '1',
    organizationId: randomUUID(),
    learnerId: randomUUID(),
    courseId: randomUUID(),
    eligible: true,
    requiredComponentCount: 1,
    quizzes: [
      {
        assessmentId: randomUUID(),
        attemptId: randomUUID(),
        recordedScore: '90.00',
        passingScore: '80.00',
        passed: true,
      },
    ],
    assignments: [],
  };
}
test('completion validates a passing snapshot without modifying it', () => {
  const s = snapshot();
  assert.equal(
    validateCompletionSnapshot(s, s.organizationId, s.learnerId, s.courseId),
    s,
  );
});
for (const field of [
  'schemaVersion',
  'snapshotId',
  'asOf',
  'revision',
  'organizationId',
  'learnerId',
  'courseId',
  'eligible',
  'requiredComponentCount',
  'quizzes',
  'assignments',
]) {
  test(`completion rejects missing ${field}`, () => {
    const s = snapshot();
    const v: Record<string, unknown> = { ...s };
    delete v[field];
    assert.throws(
      () =>
        validateCompletionSnapshot(
          v,
          s.organizationId,
          s.learnerId,
          s.courseId,
        ),
      /INVALID_SNAPSHOT/,
    );
  });
}
void test('completion rejects mismatched tenant and invalid count/score', () => {
  const s = snapshot();
  for (const v of [
    { ...s, organizationId: randomUUID() },
    { ...s, requiredComponentCount: 0 },
    { ...s, quizzes: [{ ...s.quizzes[0], recordedScore: 'NaN' }] },
  ])
    assert.throws(() =>
      validateCompletionSnapshot(v, s.organizationId, s.learnerId, s.courseId),
    );
});
test('production fake and unsafe lease refuse startup even with worker disabled', () => {
  assert.throws(
    () =>
      createCompletionClient(
        (k) =>
          ({
            ASSESSMENT_COMPLETION_CLIENT_MODE: 'fake',
            NODE_ENV: 'production',
          })[k],
      ),
    /forbidden/,
  );
  assert.throws(
    () =>
      readCompletionConfig(
        (k) =>
          ({ COMPLETION_WORKER_ENABLED: 'false', COMPLETION_LEASE_MS: '9000' })[
            k
          ],
      ),
    /must exceed/,
  );
  assert.equal(readCompletionConfig(() => undefined).enabled, true);
});
test('fake defaults to not eligible and fixtures are scoped by all IDs', async () => {
  const s = snapshot();
  const fake = new FakeAssessmentCompletionClient();
  assert.equal(
    (
      await fake.getCompletionSnapshot(
        s.organizationId,
        s.learnerId,
        s.courseId,
      )
    ).eligible,
    false,
  );
  fake.fixtures.set([s.organizationId, s.learnerId, s.courseId].join('/'), {
    value: s,
  });
  assert.equal(
    (
      await fake.getCompletionSnapshot(
        s.organizationId,
        s.learnerId,
        s.courseId,
      )
    ).eligible,
    true,
  );
  assert.equal(
    (await fake.getCompletionSnapshot(randomUUID(), s.learnerId, s.courseId))
      .eligible,
    false,
  );
});
test('HTTP completion client uses service authentication without a learner principal', async () => {
  const s = snapshot();
  let path = '';
  let principal: string | string[] | undefined;
  const server = createServer((req, res) => {
    path = req.url!;
    principal = req.headers['x-user-id'];
    assert.equal(
      req.headers['x-internal-key'],
      'synthetic-completion-test-key',
    );
    assert.equal(req.headers['x-organization-id'], s.organizationId);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: s }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const c = createCompletionClient(
      (k) =>
        ({
          ASSESSMENT_COMPLETION_CLIENT_MODE: 'http',
          ASSESSMENT_SERVICE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
          INTERNAL_SERVICE_KEY: 'synthetic-completion-test-key',
        })[k],
    );
    assert.deepEqual(
      await c.getCompletionSnapshot(s.organizationId, s.learnerId, s.courseId),
      s,
    );
    assert.equal(principal, undefined);
    assert.match(path, /completion-snapshot$/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});

test('fake timeout and malformed fixture fail safely; low Quiz score is not eligible', async () => {
  const s = snapshot(),
    fake = new FakeAssessmentCompletionClient(10),
    key = [s.organizationId, s.learnerId, s.courseId].join('/');
  fake.fixtures.set(key, { value: s, delayMs: 20 });
  await assert.rejects(
    fake.getCompletionSnapshot(s.organizationId, s.learnerId, s.courseId),
    /ASSESSMENT_UNAVAILABLE/,
  );
  fake.fixtures.set(key, { value: {} });
  await assert.rejects(
    fake.getCompletionSnapshot(s.organizationId, s.learnerId, s.courseId),
    /INVALID_SNAPSHOT/,
  );
  s.eligible = false;
  s.quizzes[0].recordedScore = '20';
  s.quizzes[0].passed = false;
  fake.fixtures.set(key, { value: s });
  assert.equal(
    (
      await fake.getCompletionSnapshot(
        s.organizationId,
        s.learnerId,
        s.courseId,
      )
    ).eligible,
    false,
  );
});

for (const nested of [false, true])
  test(`transaction diagnostics include code and constraint without PII nested=${nested}`, async () => {
    const s = snapshot();
    const error = Object.assign(
      new Error('private learner@example.test constraint "ck_enrollments_due"'),
      {
        code: 'P2010',
        ...(nested
          ? {
              message: 'private learner@example.test',
              meta: {
                driverAdapterError: {
                  cause: {
                    originalMessage:
                      'private row constraint "ck_enrollments_due"',
                  },
                },
              },
            }
          : {}),
      },
    );
    let retried = '';
    const repository = {
      enrollment: async () => ({
        status: 'NotStarted',
        disabled_at: null,
        learner_id: s.learnerId,
        course_id: s.courseId,
      }),
      materials: async () => ({ ready: true, required: 0 }),
      prisma: {
        $transaction: async () => {
          throw error;
        },
      },
      config: { transactionMs: 1000 },
      retry: async (_r: unknown, code: string) => {
        retried = code;
        return 1;
      },
    } as unknown as CompletionRepository;
    const log = mock.method(Logger.prototype, 'warn', () => undefined);
    try {
      await new CompletionService(repository, {
        getCompletionSnapshot: async () =>
          validateCompletionSnapshot(
            s,
            s.organizationId,
            s.learnerId,
            s.courseId,
          ),
      }).evaluate({
        organization_id: s.organizationId,
        enrollment_id: randomUUID(),
        generation: 0n,
      } as CompletionRequest);
      assert.equal(retried, 'COMPLETION_TRANSACTION_FAILED');
      assert.deepEqual(log.mock.calls[0].arguments[0], {
        code: 'COMPLETION_TRANSACTION_FAILED',
        errorCode: 'P2010',
        constraint: 'ck_enrollments_due',
      });
      assert.equal(
        JSON.stringify(log.mock.calls).includes('learner@example.test'),
        false,
      );
    } finally {
      log.mock.restore();
    }
  });

for (const kind of [
  'Waived',
  'eligible mismatch',
  'passed mismatch',
  'null score',
])
  void test(`L22 accepts ${kind} without modifying the snapshot`, () => {
    const s = snapshot();
    const value =
      kind === 'Waived'
        ? {
            ...s,
            quizzes: [],
            assignments: [
              {
                assessmentId: randomUUID(),
                submissionId: randomUUID(),
                finalScore: '90',
                passingScore: '80',
                finalizedAt: s.asOf,
                passed: true,
                peerReview: {
                  status: 'Waived',
                  requiredCount: 3,
                  completedCount: 1,
                },
              },
            ],
          }
        : {
            ...s,
            eligible: kind === 'eligible mismatch' ? false : true,
            quizzes: [
              {
                ...s.quizzes[0],
                passed: kind === 'passed mismatch' ? false : true,
                recordedScore: kind === 'null score' ? null : '90.00',
              },
            ],
          };
    const before = structuredClone(value);
    assert.equal(
      validateCompletionSnapshot(
        value,
        s.organizationId,
        s.learnerId,
        s.courseId,
      ),
      value,
    );
    assert.deepEqual(value, before);
  });

for (const status of [400, 401, 403, 404, 422, 503])
  void test(`L22 HTTP ${status} retains status, logs permanence and retries`, async () => {
    const s = snapshot();
    const server = createServer((_req, res) => {
      res.writeHead(status);
      res.end('synthetic private response');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const log = mock.method(Logger.prototype, 'error', () => undefined);
    const retries: string[] = [];
    try {
      const client = createCompletionClient(
        (k) =>
          ({
            ASSESSMENT_SERVICE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            INTERNAL_SERVICE_KEY: 'synthetic-completion-test-key',
          })[k],
      );
      await assert.rejects(
        client.getCompletionSnapshot(s.organizationId, s.learnerId, s.courseId),
        (e: unknown) =>
          e instanceof CompletionClientError &&
          e.httpStatus === status &&
          e.code === 'ASSESSMENT_UNAVAILABLE',
      );
      const repository = {
        enrollment: () =>
          Promise.resolve({
            status: 'NotStarted',
            disabled_at: null,
            learner_id: s.learnerId,
            course_id: s.courseId,
          }),
        materials: () => Promise.resolve({ ready: true, required: 0 }),
        retry: (_r: unknown, code: string) => {
          retries.push(code);
          return Promise.resolve(1);
        },
      } as unknown as CompletionRepository;
      await new CompletionService(repository, client).evaluate({
        organization_id: s.organizationId,
        enrollment_id: randomUUID(),
        generation: 0n,
      } as CompletionRequest);
      assert.deepEqual(retries, ['ASSESSMENT_UNAVAILABLE']);
      assert.deepEqual(log.mock.calls[0].arguments[0], {
        code: 'ASSESSMENT_UNAVAILABLE',
        httpStatus: status,
        permanent: status < 500,
      });
      assert.equal(
        JSON.stringify(log.mock.calls).includes('synthetic private response'),
        false,
      );
    } finally {
      log.mock.restore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
for (const kind of [
  'timeout',
  'network',
  'malformed JSON',
  'invalid snapshot',
  'body network',
  'body timeout',
])
  void test(`L22 ${kind} retains response status when available and retries`, async () => {
    const s = snapshot();
    const original = global.fetch;
    const log = mock.method(Logger.prototype, 'error', () => undefined);
    let retry = '';
    try {
      global.fetch = () => {
        if (kind === 'timeout')
          throw new DOMException('synthetic', 'TimeoutError');
        if (kind === 'network') throw new TypeError('synthetic network');
        if (kind === 'body network' || kind === 'body timeout') {
          const response = Response.json({ data: s });
          response.json = () =>
            Promise.reject(
              kind === 'body timeout'
                ? new DOMException('synthetic', 'TimeoutError')
                : new TypeError('synthetic network'),
            );
          return Promise.resolve(response);
        }
        return kind === 'malformed JSON'
          ? Promise.resolve(new Response('{bad', { status: 200 }))
          : Promise.resolve(Response.json({ data: {} }));
      };
      const client = createCompletionClient((k) =>
        k === 'INTERNAL_SERVICE_KEY' ? 'synthetic-key' : undefined,
      );
      const repository = {
        enrollment: () =>
          Promise.resolve({
            status: 'NotStarted',
            disabled_at: null,
            learner_id: s.learnerId,
            course_id: s.courseId,
          }),
        materials: () => Promise.resolve({ ready: true, required: 0 }),
        retry: (_r: unknown, code: string) => {
          retry = code;
          return Promise.resolve(1);
        },
      } as unknown as CompletionRepository;
      await new CompletionService(repository, client).evaluate({
        organization_id: s.organizationId,
        enrollment_id: randomUUID(),
        generation: 0n,
      } as CompletionRequest);
      const permanent =
        kind === 'malformed JSON' || kind === 'invalid snapshot';
      assert.equal(
        retry,
        permanent ? 'INVALID_SNAPSHOT' : 'ASSESSMENT_UNAVAILABLE',
      );
      assert.deepEqual(log.mock.calls[0].arguments[0], {
        code: retry,
        httpStatus: permanent || kind.startsWith('body ') ? 200 : null,
        permanent,
      });
    } finally {
      global.fetch = original;
      log.mock.restore();
    }
  });
