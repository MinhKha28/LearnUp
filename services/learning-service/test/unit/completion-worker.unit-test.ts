import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompletionWorker } from '../../src/modules/course-completion/completion.worker';
import { CompletionService } from '../../src/modules/course-completion/completion.service';
import { CompletionRepository } from '../../src/modules/course-completion/completion.repository';
import { readCompletionConfig } from '../../src/modules/course-completion/completion.config';
import { CompletionClientError } from '../../src/infrastructure/clients/assessment/assessment-completion.client';

test('full waves drain backlog in one tick, yielding without waiting a poll interval', async () => {
  const config = { ...readCompletionConfig(() => undefined), pollMs: 60000 };
  let pending = 12,
    calls = 0,
    active = 0,
    maxActive = 0,
    yielded = false;
  setImmediate(() => {
    yielded = true;
  });
  const repo = {
    claim: async (limit: number) => {
      calls++;
      if (calls > 1) assert.equal(yielded, true);
      assert.equal(limit, 5);
      const n = Math.min(limit, pending);
      pending -= n;
      return Array.from({ length: n }, () => ({}));
    },
    metrics: async () => ({}),
  };
  const service = {
    metrics: {},
    evaluate: async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
    },
  };
  const worker = new CompletionWorker(
    repo as unknown as CompletionRepository,
    service as unknown as CompletionService,
    config,
  );
  await worker.tick();
  assert.equal(pending, 0);
  assert.equal(calls, 3);
  assert.equal(maxActive, 5);
  assert.equal(yielded, true);
  await worker.beforeApplicationShutdown();
});
test('concurrency below batch claims only runnable slots, never queues leased work', async () => {
  const config = {
    ...readCompletionConfig(() => undefined),
    batchSize: 5,
    concurrency: 2,
  };
  let pending = 7,
    active = 0,
    maximum = 0;
  const repo = {
    claim: async (limit: number) => {
      assert.equal(limit, 2);
      const n = Math.min(limit, pending);
      pending -= n;
      return Array.from({ length: n }, () => ({}));
    },
    metrics: async () => ({}),
  };
  const service = {
    metrics: {},
    evaluate: async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((r) => setImmediate(r));
      active--;
    },
  };
  await new CompletionWorker(
    repo as unknown as CompletionRepository,
    service as unknown as CompletionService,
    config,
  ).tick();
  assert.equal(pending, 0);
  assert.equal(maximum, 2);
});
test('persistent assessment errors honor backoff without a hot drain loop', async () => {
  const config = {
    ...readCompletionConfig(() => undefined),
    batchSize: 1,
    concurrency: 1,
    pollMs: 5,
  };
  let due = 0,
    claims = 0,
    assessmentCalls = 0;
  const request = {
    enrollment_id: 'test',
    organization_id: 'test',
    generation: 0n,
    attempts: 0n,
    expired: false,
  };
  const repo = {
    claim: async () => {
      claims++;
      if (Date.now() < due) return [];
      due = Date.now() + 30000;
      return [request];
    },
    enrollment: async () => ({
      status: 'InProgress',
      disabled_at: null,
      learner_id: 'test',
      course_id: 'test',
    }),
    materials: async () => ({ ready: true, required: 1 }),
    retry: async () => {
      due = Date.now() + 50;
      return 1;
    },
    metrics: async () => ({}),
  };
  const service = new CompletionService(
    repo as unknown as CompletionRepository,
    {
      getCompletionSnapshot: async () => {
        assessmentCalls++;
        throw new CompletionClientError('ASSESSMENT_UNAVAILABLE');
      },
    },
  );
  const worker = new CompletionWorker(
    repo as unknown as CompletionRepository,
    service,
    config,
  );
  worker.onModuleInit();
  await new Promise((r) => setTimeout(r, 130));
  await worker.beforeApplicationShutdown();
  assert.ok(
    assessmentCalls >= 1 && assessmentCalls <= 3,
    `assessment calls=${assessmentCalls}`,
  );
  assert.ok(claims < 40, `claims=${claims}`);
});
