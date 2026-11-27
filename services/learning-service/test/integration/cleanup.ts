import { relative } from 'node:path';
import {
  after as nodeAfter,
  type HookOptions,
  type TestContext,
  type SuiteContext,
} from 'node:test';
import { deadline, IO_TIMEOUT_MS } from './deadlines';

export interface CleanupTask {
  name: string;
  run: () => unknown;
  timeoutMs?: number;
}
type HookWork = (context: TestContext | SuiteContext) => unknown;

/** Where a reported hook lives: the test file (pass __filename) and what the hook does. */
export interface HookLabel {
  file: string;
  hook: string;
}

const fileErrors: unknown[] = [];

/**
 * Run the hook body and hand any error to onFailure instead of rethrowing it.
 * node:test skips the remaining `after` hooks at the same level once one throws.
 */
export function catchHookFailure(
  work: HookWork,
  onFailure: (error: unknown) => void,
): HookWork {
  return async (context) => {
    try {
      await work(context);
    } catch (error) {
      onFailure(error);
    }
  };
}

/** Keep later file hooks and the harness cleanup reachable after a hook fails. */
export function after(work: HookWork, options?: HookOptions): void {
  nodeAfter(
    catchHookFailure(work, (error) => fileErrors.push(error)),
    options,
  );
}

/** Print a failed hook once and mark the whole run as failed. */
export function reportHookFailure(label: HookLabel, error: unknown): void {
  const file = relative(process.cwd(), label.file);
  console.error(`after hook "${label.hook}" failed in ${file}:`, error);
  process.exitCode = 1;
}

/**
 * Root-level `after` for runs without the integration harness, e.g. test/unit/index.ts.
 * Node 24 runs those files in one process and then prints a failing root `after`
 * hook but still exits 0, so the failure is reported here and the run fails.
 * The error is not rethrown, so the later `after` hooks still run.
 */
export function reportingAfter(
  label: HookLabel,
  work: HookWork,
  options?: HookOptions,
): void {
  nodeAfter(
    catchHookFailure(work, (error) => reportHookFailure(label, error)),
    options,
  );
}

/** Dependencies close in order; every task gets its own attempt and deadline. */
export async function cleanupAll(tasks: CleanupTask[]): Promise<void> {
  const errors: unknown[] = [];
  const failures: string[] = [];
  for (const task of tasks) {
    try {
      await deadline(
        Promise.resolve().then(task.run),
        task.name,
        task.timeoutMs ?? IO_TIMEOUT_MS,
      );
      if (process.env.LEARNING_IT_TIMING === '1')
        console.log(`it-cleanup closed ${task.name}`);
    } catch (error) {
      errors.push(error);
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${task.name}: ${message}`);
    }
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      `Integration cleanup failed: ${failures.join('; ')}`,
    );
}

export async function finishCleanup(
  tasks: CleanupTask[],
  cause?: unknown,
): Promise<void> {
  const errors = fileErrors.splice(0);
  try {
    await cleanupAll(tasks);
  } catch (error) {
    errors.push(error);
  }
  if (cause === undefined && errors.length === 0) return;
  // Node 24 with --experimental-test-isolation=none prints a failing root
  // `after` hook but still exits 0, so the run must be marked as failed here.
  process.exitCode = 1;
  if (cause !== undefined) {
    const startupError =
      cause instanceof Error
        ? cause
        : new Error('Integration startup failed', { cause });
    if (errors.length === 0) throw startupError;
    throw new AggregateError(
      [startupError, ...errors],
      `${startupError.message}; integration cleanup failed`,
    );
  }
  throw new AggregateError(errors, 'Integration teardown failed');
}
