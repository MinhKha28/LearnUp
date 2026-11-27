import { relative } from 'node:path';
import {
  after,
  type HookOptions,
  type SuiteContext,
  type TestContext,
} from 'node:test';

type HookWork = (context: TestContext | SuiteContext) => unknown;

/** Where a reported hook lives: the test file (pass __filename) and what the hook does. */
export interface HookLabel {
  file: string;
  hook: string;
}

/** Print a failed hook once and mark the whole run as failed. */
export function reportHookFailure(label: HookLabel, error: unknown): void {
  const file = relative(process.cwd(), label.file);
  console.error(`after hook "${label.hook}" failed in ${file}:`, error);
  process.exitCode = 1;
}

/**
 * Root-level `after` for the node:test files that run with ts-node, e.g. npm run test:lock:db.
 * Node 24 runs such a file in the same process and then prints a failing root
 * `after` hook but still exits 0, so the failure is reported here and the run fails.
 * The error is not rethrown: node:test skips the remaining `after` hooks at the
 * same level once one throws.
 */
export function reportingAfter(
  label: HookLabel,
  work: HookWork,
  options?: HookOptions,
): void {
  after(async (context) => {
    try {
      await work(context);
    } catch (error) {
      reportHookFailure(label, error);
    }
  }, options);
}
