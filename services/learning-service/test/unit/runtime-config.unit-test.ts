import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRuntimeConfig } from '../../src/runtime.config';
import { readRelayConfig } from '../../src/modules/outbox/relay.config';

const otherConfig = {};

test('rejects the default when NODE_ENV is unset', () => {
  assert.throws(
    () =>
      validateRuntimeConfig({
        ...otherConfig,
        INTERNAL_SERVICE_KEY: 'learnup-internal-secret',
      }),
    /INTERNAL_SERVICE_KEY/,
  );
});
test('allows the default in explicit test mode', () => {
  assert.doesNotThrow(() =>
    validateRuntimeConfig({
      ...otherConfig,
      NODE_ENV: 'test',
      INTERNAL_SERVICE_KEY: 'learnup-internal-secret',
    }),
  );
});
test('returns the same environment object', () => {
  const environment = { ...otherConfig, INTERNAL_SERVICE_KEY: 's'.repeat(32) };
  assert.equal(validateRuntimeConfig(environment), environment);
});

test('starts relay configuration with malformed leftover topic-shape environment values', () => {
  for (const value of ['abc', '-1', '0', '32768']) {
    const environment = {
      NODE_ENV: 'test',
      INTERNAL_SERVICE_KEY: 's'.repeat(32),
      OUTBOX_RELAY_ENABLED: 'true',
      OUTBOX_REPLICATION_FACTOR: value,
      ASSESSMENT_OUTBOX_REPLICATION_FACTOR: value,
      ENROLLMENT_EVENTS_DLT_PARTITIONS: value,
      ENROLLMENT_EVENTS_DLT_REPLICAS: value,
      SUBMISSION_FINALIZED_DLT_PARTITIONS: value,
      SUBMISSION_FINALIZED_DLT_REPLICAS: value,
    };
    const validated = validateRuntimeConfig(environment);
    const config = readRelayConfig(
      (key) => validated[key] as string | undefined,
    );
    assert.equal(config.enabled, true);
  }
});
