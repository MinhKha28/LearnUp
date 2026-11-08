/** Step 22 of the plan: what the relay of the outbox reads from the environment, and how long it waits after a failure. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  readRelayConfig,
  retryDelay,
  type RelayConfig,
} from '../../src/modules/outbox/relay.config';

const read = (env: Record<string, string> = {}) =>
  readRelayConfig((key) => env[key]);

describe('readRelayConfig', () => {
  test('the alert for an outage of the destination is after five minutes by default and takes a number of milliseconds', () => {
    assert.equal(read().outageAlertMs, 300000);
    assert.equal(
      read({ OUTBOX_OUTAGE_ALERT_MS: '60000' }).outageAlertMs,
      60000,
    );
    for (const bad of ['0', '-1', '1.5', 'abc', ''])
      assert.throws(
        () => read({ OUTBOX_OUTAGE_ALERT_MS: bad }),
        /OUTBOX_OUTAGE_ALERT_MS/,
        bad,
      );
  });

  test('is off by default, polls every second and takes batches of 20', () => {
    const config = read();
    assert.equal(config.enabled, false);
    assert.equal(config.pollMs, 1000);
    assert.equal(config.batchSize, 20);
    assert.equal(config.backoffMs, 1000);
    assert.equal(config.alertAttempts, 10);
  });

  test('is on only for the word true', () => {
    assert.equal(read({ OUTBOX_RELAY_ENABLED: 'true' }).enabled, true);
    assert.throws(
      () => read({ OUTBOX_RELAY_ENABLED: '1' }),
      /OUTBOX_RELAY_ENABLED/,
    );
    assert.throws(
      () => read({ OUTBOX_RELAY_ENABLED: 'TRUE' }),
      /OUTBOX_RELAY_ENABLED/,
    );
  });

  for (const bad of ['0', '-1', '1.5', 'abc', '', '99999999999999999999']) {
    test(`refuses ${JSON.stringify(bad)} as a number of milliseconds or a size`, () => {
      assert.throws(
        () => read({ OUTBOX_POLL_INTERVAL_MS: bad }),
        /OUTBOX_POLL_INTERVAL_MS/,
      );
      assert.throws(
        () => read({ OUTBOX_BATCH_SIZE: bad }),
        /OUTBOX_BATCH_SIZE/,
      );
    });
  }

  test('refuses a ceiling of the wait below the first wait, and a batch that is too large', () => {
    assert.throws(
      () => read({ OUTBOX_BACKOFF_MS: '5000', OUTBOX_BACKOFF_MAX_MS: '1000' }),
      /OUTBOX_BACKOFF_MAX_MS/,
    );
    assert.throws(
      () => read({ OUTBOX_BATCH_SIZE: '1001' }),
      /OUTBOX_BATCH_SIZE/,
    );
  });
});

describe('retryDelay', () => {
  const config = { backoffMs: 1000, backoffMaxMs: 300000 } as RelayConfig;

  test('doubles with each failed attempt', () => {
    assert.deepEqual(
      [1, 2, 3, 4].map((attempts) => retryDelay(attempts, config)),
      [1000, 2000, 4000, 8000],
    );
  });

  test('stops at the ceiling and stays there for any number of attempts', () => {
    assert.equal(retryDelay(20, config), 300000);
    assert.equal(retryDelay(1000, config), 300000);
  });
});
