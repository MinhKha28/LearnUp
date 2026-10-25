import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
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
test('completion rejects mismatched tenant and inconsistent eligibility/count/score', () => {
  const s = snapshot();
  for (const v of [
    { ...s, organizationId: randomUUID() },
    { ...s, eligible: false },
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
