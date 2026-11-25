// Three green full runs: slowest test 4618.4548 ms; slowest end-to-end
// run 36145 ms. Round 4x the test and 3x the run up to whole seconds.
/** Positive-integer override from the environment; the default applies when unset. */
function budget(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${envName} must be a positive integer (ms)`);
  return value;
}

export const TEST_TIMEOUT_MS = budget('LEARNING_IT_TEST_TIMEOUT_MS', 19000);
export const SUITE_TIMEOUT_MS = budget('LEARNING_IT_SUITE_TIMEOUT_MS', 109000);
export const IO_TIMEOUT_MS = budget('LEARNING_IT_IO_TIMEOUT_MS', 10000);
export const BARRIER_TIMEOUT_MS = budget(
  'LEARNING_IT_BARRIER_TIMEOUT_MS',
  5000,
);

// Measured child startup in full default runs: 2016-3016 ms here and at least
// 8000 ms on a slower machine (it hit the old 8 s cap). Allow twice the
// slowest, rounded up to the next multiple of 5 s.
export const CHILD_APP_START_TIMEOUT_ENV = 'LEARNING_IT_CHILD_START_TIMEOUT_MS';
export const CHILD_APP_START_TIMEOUT_MS = budget(
  CHILD_APP_START_TIMEOUT_ENV,
  20000,
);
// Measured child shutdown: 20-30 ms; leave 5 s for native cancellation.
export const CHILD_APP_STOP_TIMEOUT_MS = 5000;
// Forced process termination measured 90 ms.
export const CHILD_APP_KILL_TIMEOUT_MS = 1000;
// Existing chaos recovery allowance; broker metadata requests are bounded by probeMs.
export const KAFKA_RECOVERY_TIMEOUT_MS = 40000;
export const KAFKA_READY_POLL_MS = 100;
export const KAFKA_TOPIC_CLEANUP_TIMEOUT_MS =
  KAFKA_RECOVERY_TIMEOUT_MS + IO_TIMEOUT_MS;

// With LEARNING_IT_TIMING=1 the longest observed wait per deadline name is
// printed once at process exit, to size the budgets above from real runs.
const longestWaitMs = new Map<string, number>();
if (process.env.LEARNING_IT_TIMING === '1')
  process.once('exit', () => {
    const waits = Object.fromEntries(
      [...longestWaitMs].map(([name, ms]) => [name, Math.round(ms)]),
    );
    console.log(
      `it-timing ${process.env.LEARNING_IT_DATABASE ? 'child' : 'parent'} ${JSON.stringify(waits)}`,
    );
  });

export async function closeApp(
  app: import('@nestjs/common').INestApplication | null | undefined,
): Promise<void> {
  if (!app) return;
  // Some HTTP assertions intentionally inspect only status. Do not let their
  // keep-alive sockets hold app.close open after the test has finished.
  const server = app.getHttpServer() as { closeAllConnections?: () => void };
  server.closeAllConnections?.();
  await deadline(app.close(), 'Nest app.close');
}

export async function deadline<T>(
  work: Promise<T>,
  name: string,
  ms = IO_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startedAt = performance.now();
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name} timed out after ${ms} ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    const waited = performance.now() - startedAt;
    if (waited > (longestWaitMs.get(name) ?? 0))
      longestWaitMs.set(name, waited);
  }
}

/** Start every close even when an earlier close/reset fails. */
export async function closeAll(
  ...tasks: (() => Promise<unknown> | undefined)[]
): Promise<void> {
  const results = await Promise.allSettled(
    tasks.map(async (task, i) =>
      deadline(Promise.resolve().then(task), `teardown handle ${i + 1}`),
    ),
  );
  const errors = results.flatMap((r) =>
    r.status === 'rejected' ? [r.reason as unknown] : [],
  );
  if (errors.length)
    throw new AggregateError(
      errors,
      `Integration teardown failed: ${errors.map((error) => (error instanceof Error ? error.message : 'unknown error')).join('; ')}`,
    );
}
