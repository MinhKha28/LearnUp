import { describe, expect, it } from 'vitest';
import { constantTimeSecretEqual } from '../src/security/index.js';

describe('constantTimeSecretEqual', () => {
  it.each([
    ['equal credentials', 'internal-key', 'internal-key', true],
    ['different credentials of the same length', 'internal-keX', 'internal-key', false],
    ['shorter credential', 'short', 'internal-key', false],
    ['longer credential', 'internal-key-extra', 'internal-key', false],
    ['empty provided credential', '', 'internal-key', false],
    ['empty expected credential', 'internal-key', '', false],
    ['both empty', '', '', false],
    ['undefined provided credential', undefined, 'internal-key', false],
    ['undefined expected credential', 'internal-key', undefined, false],
    ['both undefined', undefined, undefined, false],
    ['array header', ['internal-key'], 'internal-key', false],
    ['null provided credential', null, 'internal-key', false],
    ['numeric expected credential', '123', 123, false],
    ['blank configured credential', '   ', '   ', false],
    ['equal multibyte credentials', 'khóa-🔑', 'khóa-🔑', true],
    ['different multibyte credentials', 'khóa-🔒', 'khóa-🔑', false],
    ['equal character counts with different byte counts', 'é', 'e', false],
    ['matching surrounding whitespace', ' internal-key ', ' internal-key ', true],
    ['leading whitespace is not trimmed', ' internal-key', 'internal-key', false],
    ['trailing whitespace is not trimmed', 'internal-key ', 'internal-key', false],
    ['expected whitespace is not trimmed', 'internal-key', ' internal-key ', false],
  ])('%s', (_name, provided, expected, matches) => {
    expect(constantTimeSecretEqual(provided, expected)).toBe(matches);
  });
});
