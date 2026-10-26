// Three green full runs: slowest test 4618.4548 ms; slowest end-to-end
// run 36145 ms. Round 4x the test and 3x the run up to whole seconds.
export const TEST_TIMEOUT_MS = 19000;
export const SUITE_TIMEOUT_MS = 109000;
export const IO_TIMEOUT_MS = 10000;
export const BARRIER_TIMEOUT_MS = 5000;

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
