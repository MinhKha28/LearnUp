import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';
import { Reflector } from '@nestjs/core';
import { EnrollmentRateLimitGuard } from '../../src/modules/enrollments/enrollment-rate-limit.guard';
import { EnrollmentRateLimitStorage } from '../../src/modules/enrollments/enrollment-rate-limit.storage';
import { readEnrollmentRateLimit } from '../../src/modules/enrollments/enrollment-rate-limit.config';

class TestGuard extends EnrollmentRateLimitGuard {
  tracker(userId: string) {
    return this.getTracker({ user: { userId } as never });
  }
}

void describe('Enrollment rate limit', () => {
  void test('tracker uses the authenticated user rather than IP', async () => {
    const storage = new EnrollmentRateLimitStorage();
    try {
      const guard = new TestGuard([], storage, new Reflector());
      assert.equal(await guard.tracker('learner-id'), 'learner-id');
    } finally {
      storage.onApplicationShutdown();
    }
  });
  void test('default and integer boundaries', () => {
    assert.equal(readEnrollmentRateLimit(undefined), 10);
    for (const limit of ['1', '10', '1000'])
      assert.equal(readEnrollmentRateLimit(limit), Number(limit));
  });
  void test('invalid env rejects startup configuration', () => {
    for (const limit of [
      '',
      ' ',
      '0',
      '-1',
      '1001',
      '1.5',
      '1e2',
      'NaN',
      'Infinity',
      '10x',
    ]) {
      assert.throws(
        () => readEnrollmentRateLimit(limit),
        /ENROLLMENT_RATE_LIMIT_PER_MINUTE.*1.*1000/,
      );
    }
  });
  void test('fixed 60 second window rounds up, isolates users, and does not extend on rejection', async () => {
    const storage = new EnrollmentRateLimitStorage();
    let now = 0;
    const clock = mock.method(Date, 'now', () => now);
    try {
      for (let i = 0; i < 10; i++)
        assert.equal(
          (await storage.increment('a', 60_000, 10)).isBlocked,
          false,
        );
      now = 10_001;
      assert.equal(
        (await storage.increment('a', 60_000, 10)).timeToBlockExpire,
        50,
      );
      assert.equal((await storage.increment('b', 60_000, 10)).isBlocked, false);
      now = 59_999;
      assert.equal(
        (await storage.increment('a', 60_000, 10)).timeToBlockExpire,
        1,
      );
      now = 60_000;
      assert.deepEqual(await storage.increment('a', 60_000, 10), {
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    } finally {
      clock.mock.restore();
      storage.onApplicationShutdown();
    }
  });
});
