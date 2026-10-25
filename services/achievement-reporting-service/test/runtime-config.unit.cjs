const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntimeConfig } = require('../dist/src/runtime.config');

const credentials = {
  INTERNAL_SERVICE_KEY: 'synthetic-runtime-test-key',
  DATABASE_URL:
    'postgresql://fixture_user:fixture_password@127.0.0.1:1/fixture',
};

for (const mode of ['production', undefined, '', 'staging']) {
  const environment = mode === undefined ? {} : { NODE_ENV: mode };
  test(
    'requires an explicit internal key with NODE_ENV=' + String(mode),
    () => {
      for (const key of [undefined, '', '   '])
        assert.throws(
          () =>
            validateRuntimeConfig({
              ...credentials,
              ...environment,
              INTERNAL_SERVICE_KEY: key,
            }),
          /INTERNAL_SERVICE_KEY is required/,
        );
    },
  );
  test('requires explicit DB credentials with NODE_ENV=' + String(mode), () => {
    for (const url of [
      undefined,
      '',
      'not-a-url',
      'https://user:pass@host/db',
      'postgresql://127.0.0.1/db',
      'postgresql://user@127.0.0.1/db',
      'postgresql://:pass@127.0.0.1/db',
      'postgresql://user:%20@127.0.0.1/db',
    ])
      assert.throws(
        () =>
          validateRuntimeConfig({
            ...credentials,
            ...environment,
            DATABASE_URL: url,
          }),
        /DATABASE_URL must be a PostgreSQL URL with explicit username and password/,
      );
  });
  test('accepts explicit credentials with NODE_ENV=' + String(mode), () => {
    const config = { ...credentials, ...environment };
    assert.equal(validateRuntimeConfig(config), config);
  });
}

for (const mode of ['development', 'test'])
  test(
    'retains development defaults only with explicit NODE_ENV=' + mode,
    () => {
      const config = { NODE_ENV: mode };
      assert.equal(validateRuntimeConfig(config), config);
    },
  );

test('supports percent-encoded PostgreSQL credentials without rewriting them', () => {
  const config = {
    ...credentials,
    NODE_ENV: 'production',
    DATABASE_URL:
      'postgresql://fixture%20user:fixture%40password@127.0.0.1:1/fixture',
  };
  assert.equal(validateRuntimeConfig(config), config);
});

test('startup diagnostics never expose credential values or connection strings', () => {
  const config = {
    ...credentials,
    DATABASE_URL: 'https://fixture_user:fixture_password@127.0.0.1/fixture',
  };
  assert.throws(
    () => validateRuntimeConfig(config),
    (error) => {
      assert.ok(!error.message.includes('fixture_user'));
      assert.ok(!error.message.includes('fixture_password'));
      assert.ok(!error.message.includes(config.DATABASE_URL));
      return true;
    },
  );
});
