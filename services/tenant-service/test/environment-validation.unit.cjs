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
