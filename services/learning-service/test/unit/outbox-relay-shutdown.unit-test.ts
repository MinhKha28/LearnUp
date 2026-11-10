import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

const skip = process.platform === 'win32' && 'Requires POSIX signal delivery';

function signalFixture(scenario: 'startup' | 'drain'): string[] {
  const child = spawnSync(
    process.execPath,
    [
      '--require',
      'ts-node/register',
      join(__dirname, 'fixtures', 'outbox-relay-shutdown.ts'),
      scenario,
    ],
    {
      env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.seed.json' },
      encoding: 'utf8',
      timeout: 15000,
      killSignal: 'SIGKILL',
    },
  );
  assert.ifError(child.error);
  assert.equal(child.signal, 'SIGTERM', child.stderr);
  assert.equal(child.status, null);
  return JSON.parse(child.stdout) as string[];
}

test(
  'SIGTERM during startup retry cancels connect before the relay claims rows',
  { skip },
  () => {
    assert.deepEqual(signalFixture('startup'), [
      'connect attempt 1',
      'connect attempt 2',
      'shutdown started',
      'producer disconnected',
      'shutdown finished SIGTERM',
    ]);
  },
);

test(
  'SIGTERM during drain commits publication before the producer closes',
  { skip },
  () => {
    assert.deepEqual(signalFixture('drain'), [
      'transaction started',
      'send pending',
      'shutdown started',
      'send acknowledged',
      'row published',
      'transaction committed',
      'producer disconnected',
      'shutdown finished SIGTERM',
    ]);
  },
);
