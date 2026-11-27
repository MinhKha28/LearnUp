import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Logger } from '@nestjs/common';
import { CompletionWorker } from '../../src/modules/course-completion/completion.worker';
import { CompletionService } from '../../src/modules/course-completion/completion.service';
import { CompletionRepository } from '../../src/modules/course-completion/completion.repository';
import { readCompletionConfig } from '../../src/modules/course-completion/completion.config';
import { CompletionClientError } from '../../src/infrastructure/clients/assessment/assessment-completion.client';

test('full waves drain backlog in one tick, yielding without waiting a poll interval', async (t) => {
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
  const logger = (worker as unknown as { logger: Logger }).logger;
  t.mock.method(logger, 'log', () => undefined);
  await worker.tick();
  assert.equal(pending, 0);
  assert.equal(calls, 3);
  assert.equal(maxActive, 5);
  assert.equal(yielded, true);
  await worker.beforeApplicationShutdown();
});
test('concurrency below batch claims only runnable slots, never queues leased work', async (t) => {
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
  const worker = new CompletionWorker(
    repo as unknown as CompletionRepository,
    service as unknown as CompletionService,
    config,
  );
  const logger = (worker as unknown as { logger: Logger }).logger;
  t.mock.method(logger, 'log', () => undefined);
  await worker.tick();
  assert.equal(pending, 0);
  assert.equal(maximum, 2);
});
test('persistent assessment errors honor backoff without a hot drain loop', async (t) => {
  // Virtual time: the poll interval, the retry backoff and the observation window
  // advance only when the test ticks the clock, so machine speed cannot change the result.
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const POLL_MS = 5;
  const RETRY_BACKOFF_MS = 50;
  const LEASE_MS = 30000;
  // Long enough for several backoff retries.
  const OBSERVATION_WINDOW_MS = 300;
  const CLOCK_STEP_MS = 1;
  // At least one retry after the first failure, so an interval is actually checked.
  const MIN_ASSESSMENT_CALLS = 2;
  const config = {
    ...readCompletionConfig(() => undefined),
    batchSize: 1,
    concurrency: 1,
    pollMs: POLL_MS,
  };
  let nextClaimableAt = 0;
  let claims = 0;
  const assessmentCallTimes: number[] = [];
  const request = {
    enrollment_id: 'test',
    organization_id: 'test',
    generation: 0n,
    attempts: 0n,
    expired: false,
  };
  const repo = {
    // Like the real queue: a claimed request is leased, and a request waiting
    // for its retry backoff is not claimable.
    claim: async () => {
      claims++;
      if (Date.now() < nextClaimableAt) return [];
      nextClaimableAt = Date.now() + LEASE_MS;
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
      nextClaimableAt = Date.now() + RETRY_BACKOFF_MS;
      return 1;
    },
    metrics: async () => ({}),
  };
  const service = new CompletionService(
    repo as unknown as CompletionRepository,
    {
      getCompletionSnapshot: async () => {
        assessmentCallTimes.push(Date.now());
        throw new CompletionClientError('ASSESSMENT_UNAVAILABLE');
      },
    },
  );
  const worker = new CompletionWorker(
    repo as unknown as CompletionRepository,
    service,
    config,
  );
  const workerLogger = (worker as unknown as { logger: Logger }).logger;
  const serviceLogger = (service as unknown as { logger: Logger }).logger;
  t.mock.method(workerLogger, 'log', () => undefined);
  const loggerError = t.mock.method(serviceLogger, 'error', () => undefined);
  try {
    worker.onModuleInit();
    for (
      let elapsedMs = 0;
      elapsedMs < OBSERVATION_WINDOW_MS;
      elapsedMs += CLOCK_STEP_MS
    ) {
      t.mock.timers.tick(CLOCK_STEP_MS);
      await flush();
    }
  } finally {
    await worker.beforeApplicationShutdown();
    t.mock.timers.reset();
  }

  // The service handed the failure to the queue's retry, so the worker came back for it.
  assert.ok(
    assessmentCallTimes.length >= MIN_ASSESSMENT_CALLS,
    `assessment calls=${assessmentCallTimes.length}`,
  );
  assert.equal(loggerError.mock.callCount(), assessmentCallTimes.length);
  for (const call of loggerError.mock.calls) {
    const payload = call.arguments[0] as { code: string };
    assert.equal(payload.code, 'ASSESSMENT_UNAVAILABLE');
  }
  // The fake queue holds the request back for RETRY_BACKOFF_MS, so a shorter gap
  // means the worker or service called assessment without a new claim
  // (for example, retrying the failed request in place).
  for (let index = 1; index < assessmentCallTimes.length; index++) {
    const intervalMs =
      assessmentCallTimes[index] - assessmentCallTimes[index - 1];
    assert.ok(
      intervalMs >= RETRY_BACKOFF_MS,
      `assessment call ${index + 1} came ${intervalMs} ms after the previous call; backoff is ${RETRY_BACKOFF_MS} ms`,
    );
  }
  // Hot drain loop guard: while the request is backing off, the worker must wait
  // pollMs between claims. Allowed: one claim per poll tick (the first tick runs at
  // start), plus one extra claim after each failed full wave. The bound is tight on
  // purpose; virtual time makes the count exact. A worker that skips the poll wait
  // or keeps draining empty claims makes about one claim per millisecond.
  const maxPollTicks = OBSERVATION_WINDOW_MS / POLL_MS + 1;
  const maxClaims = maxPollTicks + assessmentCallTimes.length;
  assert.ok(claims <= maxClaims, `claims=${claims}, maximum=${maxClaims}`);
});

/** Lets pending promise chains and setImmediate callbacks run (real, not mocked). */
function flush(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}
