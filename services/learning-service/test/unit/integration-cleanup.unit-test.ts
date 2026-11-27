import assert from 'node:assert/strict';
import { mock, test, type TestContext } from 'node:test';
import {
  catchHookFailure,
  cleanupAll,
  finishCleanup,
  reportHookFailure,
} from '../integration/cleanup';

// The hook bodies below ignore their context, so an empty one is enough.
const UNUSED_CONTEXT = {} as TestContext;

void test('a failing hook body hands its error over and does not reject', async () => {
  const hookError = new Error('disconnect failed');
  const received: unknown[] = [];
  const hook = catchHookFailure(
    () => Promise.reject(hookError),
    (error) => received.push(error),
  );
  await hook(UNUSED_CONTEXT);
  assert.deepEqual(received, [hookError]);
});

void test('a passing hook body reports nothing', async () => {
  const received: unknown[] = [];
  let ran = false;
  const hook = catchHookFailure(
    () => {
      ran = true;
    },
    (error) => received.push(error),
  );
  await hook(UNUSED_CONTEXT);
  assert.equal(ran, true);
  assert.deepEqual(received, []);
});

// Node 24 runs test/unit/index.ts in one process and exits 0 after a failing
// root `after` hook, so the reporter must set the exit code itself.
void test('a reported hook failure is printed once and fails the run', () => {
  const previousExitCode = process.exitCode;
  const printError = mock.method(console, 'error', () => undefined);
  const hookError = new Error('disconnect failed');
  try {
    process.exitCode = undefined;
    reportHookFailure(
      { file: __filename, hook: 'close stub server' },
      hookError,
    );
    assert.equal(process.exitCode, 1);
    assert.equal(printError.mock.callCount(), 1);
    const [message, printed] = printError.mock.calls[0].arguments;
    assert.match(
      String(message),
      /after hook "close stub server" failed in .*integration-cleanup\.unit-test\.ts/,
    );
    assert.equal(printed, hookError);
  } finally {
    printError.mock.restore();
    process.exitCode = previousExitCode;
  }
});

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

void test('integration cleanup names every failed task and preserves its error', async () => {
  const topicError = new Error('delete denied');
  const consumerError = new Error('disconnect failed');
  let laterCleanupRan = false;
  await assert.rejects(
    cleanupAll([
      {
        name: 'relay test topic',
        run: () => {
          throw topicError;
        },
      },
      {
        name: 'relay test consumer',
        run: () => {
          throw consumerError;
        },
      },
      {
        name: 'later resource',
        run: () => {
          laterCleanupRan = true;
        },
      },
    ]),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(
        error.message,
        'Integration cleanup failed: relay test topic: delete denied; relay test consumer: disconnect failed',
      );
      assert.deepEqual(error.errors, [topicError, consumerError]);
      return true;
    },
  );
  assert.equal(laterCleanupRan, true);
});
