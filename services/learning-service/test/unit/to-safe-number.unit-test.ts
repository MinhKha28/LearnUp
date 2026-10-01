import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toSafeNumber } from '../../src/common/utils/to-safe-number';

void describe('toSafeNumber', () => {
  void test('0n → 0', () => {
    assert.equal(toSafeNumber(0n), 0);
  });

  void test('86400n (một ngày, đơn vị extension_seconds) → 86400', () => {
    assert.equal(toSafeNumber(86400n), 86400);
  });

  void test('2^53 − 1 vẫn an toàn', () => {
    assert.equal(toSafeNumber(2n ** 53n - 1n), Number.MAX_SAFE_INTEGER);
  });

  void test('2^53 ném lỗi', () => {
    assert.throws(() => toSafeNumber(2n ** 53n), RangeError);
  });

  void test('−2^53 ném lỗi', () => {
    assert.throws(() => toSafeNumber(-(2n ** 53n)), RangeError);
  });
});
