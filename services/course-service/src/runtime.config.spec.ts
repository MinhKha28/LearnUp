import { expect, it } from '@jest/globals';
import { validateRuntimeConfig } from './runtime.config';
import { readRelayConfig } from './modules/outbox/relay.config';

it('rejects the default when NODE_ENV is unset', () => {
  expect(() =>
    validateRuntimeConfig({ INTERNAL_SERVICE_KEY: 'learnup-internal-secret' }),
  ).toThrow(/INTERNAL_SERVICE_KEY/);
});
it('allows the default in explicit test mode', () => {
  expect(() =>
    validateRuntimeConfig({
      NODE_ENV: 'test',
      INTERNAL_SERVICE_KEY: 'learnup-internal-secret',
    }),
  ).not.toThrow();
});
it('returns the same environment object', () => {
  const environment = { INTERNAL_SERVICE_KEY: 's'.repeat(32) };
  expect(validateRuntimeConfig(environment)).toBe(environment);
});

it('starts relay configuration with malformed leftover topic-shape environment values', () => {
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
    expect(config.enabled).toBe(true);
  }
});
