const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  EMAIL_OTP_SECRET_MIN_BYTES,
  validateEnvironment,
} = require('../dist/src/common/utils/otp.util');

const longSecret = 'a'.repeat(EMAIL_OTP_SECRET_MIN_BYTES);

test('accepts a secret of at least 32 bytes and returns the config unchanged', () => {
  const config = { EMAIL_OTP_SECRET: longSecret, PORT: '8084' };
  assert.equal(validateEnvironment(config), config);
});

test('counts bytes, not characters', () => {
  const vietnamese = 'ă'.repeat(16);
  assert.equal(Buffer.byteLength(vietnamese, 'utf8'), 32);
  assert.doesNotThrow(() =>
    validateEnvironment({ EMAIL_OTP_SECRET: vietnamese }),
  );
});

for (const [name, value] of [
  ['missing', undefined],
  ['empty', ''],
  ['only spaces', '   '],
  ['not a string', 123],
]) {
  test(`refuses a ${name} secret and names the variable`, () => {
    assert.throws(
      () => validateEnvironment({ EMAIL_OTP_SECRET: value }),
      /EMAIL_OTP_SECRET is required/,
    );
  });
}

test('refuses a secret shorter than 32 bytes without showing its value', () => {
  const short = 'short-secret-value';
  assert.throws(
    () => validateEnvironment({ EMAIL_OTP_SECRET: short }),
    (error) =>
      /at least 32 bytes/.test(error.message) && !error.message.includes(short),
  );
});

test('AppModule runs the check when it is loaded, so removing the hook fails this test', () => {
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const path = require('node:path');
  const appModule = path.resolve(__dirname, '../dist/src/app.module.js');
  const load = (secret) =>
    spawnSync(
      process.execPath,
      ['-e', `require(${JSON.stringify(appModule)})`],
      {
        cwd: os.tmpdir(),
        env: { ...process.env, EMAIL_OTP_SECRET: secret },
        encoding: 'utf8',
      },
    );

  const refused = load('');
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /EMAIL_OTP_SECRET is required/);

  const loaded = load(longSecret);
  assert.equal(loaded.status, 0, loaded.stderr);
});
