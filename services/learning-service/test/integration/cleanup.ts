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
const fileErrors: unknown[] = [];

/** Keep later file hooks and the harness cleanup reachable after a hook fails. */
export function after(
  work: (context: TestContext | SuiteContext) => unknown,
  options?: HookOptions,
): void {
  nodeAfter(async (context) => {
    try {
      await work(context);
    } catch (error) {
      fileErrors.push(error);
    }
  }, options);
}

/** Dependencies close in order; every task gets its own attempt and deadline. */
export async function cleanupAll(tasks: CleanupTask[]): Promise<void> {
  const errors: unknown[] = [];
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
    }
  }
  if (errors.length)
    throw new AggregateError(errors, 'Integration cleanup failed');
}

export async function finishCleanup(
  tasks: CleanupTask[],
  cause?: unknown,
): Promise<void> {
  const errors = fileErrors.splice(0);
  if (cause !== undefined) errors.push(cause);
  try {
    await cleanupAll(tasks);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 0) return;
  // Node 24 with --experimental-test-isolation=none prints a failing root
  // `after` hook but still exits 0, so the run must be marked as failed here.
  process.exitCode = 1;
  throw new AggregateError(errors, 'Integration teardown failed');
}
