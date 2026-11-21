import { expect, it } from '@jest/globals';
import { validateRuntimeConfig } from './runtime.config';

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
