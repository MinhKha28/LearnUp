const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateRuntimeConfig } = require('../dist/src/runtime.config');

const otherConfig = { EMAIL_OTP_SECRET: 'o'.repeat(32) };

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
