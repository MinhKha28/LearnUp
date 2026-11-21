import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRuntimeConfig } from '../../src/runtime.config';

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
