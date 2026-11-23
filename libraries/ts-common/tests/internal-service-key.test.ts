import { describe, expect, it } from 'vitest';
import {
  INTERNAL_SERVICE_KEY_DENYLIST,
  validateInternalServiceKey,
} from '../src/index.js';

const invalidKeys: Array<[string, unknown]> = [
  ['absent', undefined],
  ['null', null],
  ['non-string', 123],
  ['empty', ''],
  ['blank', ' '.repeat(40)],
  ['31 bytes', 'a'.repeat(31)],
  ['30 multibyte bytes', 'é'.repeat(15)],
  ['default', 'learnup-internal-secret'],
  ['padded default', '        learnup-internal-secret        '],
];

it('exports exactly the approved default denylist', () => {
  expect(INTERNAL_SERVICE_KEY_DENYLIST).toEqual(['learnup-internal-secret']);
});

for (const mode of [
  undefined,
  '',
  'staging',
  'production',
  'Development',
  'test ',
]) {
  describe(`enforced mode ${String(mode)}`, () => {
    it.each(invalidKeys)('rejects %s without exposing it', (_name, key) => {
      let caught: unknown;
      try {
        validateInternalServiceKey(key, mode);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toBe(
        'INTERNAL_SERVICE_KEY must be explicitly configured, non-default and at least 32 UTF-8 bytes outside development/test',
      );
      if (typeof key === 'string' && key.trim())
        expect(message).not.toContain(key);
    });
    it.each(['a'.repeat(32), 'é'.repeat(16)])(
      'accepts exactly 32 UTF-8 bytes: %s',
      (key) => {
        expect(new TextEncoder().encode(key).byteLength).toBe(32);
        expect(() => validateInternalServiceKey(key, mode)).not.toThrow();
      },
    );
  });
}

for (const mode of ['development', 'test']) {
  it.each(invalidKeys)(`${mode} skips %s`, (_name, key) => {
    expect(() => validateInternalServiceKey(key, mode)).not.toThrow();
  });
}

it('measures the raw string without trimming or rewriting the key', () => {
  const key = ' '.repeat(31) + 'x';
  expect(() => validateInternalServiceKey(key, undefined)).not.toThrow();
  expect(key).toBe(' '.repeat(31) + 'x');
});
