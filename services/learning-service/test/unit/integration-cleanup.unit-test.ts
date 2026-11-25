import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishCleanup } from '../integration/cleanup';

function failingCleanup() {
  return {
    name: 'failing cleanup',
    run: () => {
      throw new Error('cleanup failed');
    },
  };
}

// Node 24 with --experimental-test-isolation=none still exits 0 when the root
// `after` hook throws, so the integration teardown must set the exit code.
void test('integration teardown failure marks the run as failed', async () => {
  const previousExitCode = process.exitCode;
  try {
    await assert.rejects(
      finishCleanup([failingCleanup()]),
      /Integration teardown failed/,
    );
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = previousExitCode;
  }
});

void test('integration teardown success keeps the exit code', async () => {
  const previousExitCode = process.exitCode;
  try {
    process.exitCode = undefined;
    await finishCleanup([{ name: 'passing cleanup', run: () => undefined }]);
    assert.equal(process.exitCode, undefined);
  } finally {
    process.exitCode = previousExitCode;
  }
});

void test('integration startup error stays primary when cleanup succeeds', async () => {
  const previousExitCode = process.exitCode;
  const startupError = new Error('Invalid OUTBOX_DRAIN_GAP_MS');
  let closed = false;
  try {
    await assert.rejects(
      finishCleanup(
        [
          {
            name: 'startup resource',
            run: () => {
              closed = true;
            },
          },
        ],
        startupError,
      ),
      (error: unknown) => error === startupError,
    );
    assert.equal(closed, true);
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = previousExitCode;
  }
});

void test('integration startup and cleanup errors are both reported', async () => {
  const previousExitCode = process.exitCode;
  const startupError = new Error('Invalid OUTBOX_DRAIN_GAP_MS');
  const cleanupError = new Error('cleanup failed');
  let laterCleanupRan = false;
  try {
    await assert.rejects(
      finishCleanup(
        [
          {
            name: 'broken resource',
            run: () => {
              throw cleanupError;
            },
          },
          {
            name: 'later resource',
            run: () => {
              laterCleanupRan = true;
            },
          },
        ],
        startupError,
      ),
      (error: unknown) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(
          error.message,
          'Invalid OUTBOX_DRAIN_GAP_MS; integration cleanup failed',
        );
        assert.equal(error.errors[0], startupError);
        const cleanup = error.errors[1] as AggregateError;
        assert.ok(cleanup instanceof AggregateError);
        assert.equal(cleanup.errors[0], cleanupError);
        return true;
      },
    );
    assert.equal(laterCleanupRan, true);
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = previousExitCode;
  }
});
