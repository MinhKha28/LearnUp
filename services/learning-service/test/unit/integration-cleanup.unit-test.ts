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
