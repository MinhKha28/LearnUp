const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  blockingLimits,
  remainingDays,
  upgradeAmount,
} = require('../dist/src/modules/subscriptions/upgrade.policy');

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-30T00:00:00.000Z');

test('BR-19: a partial day counts as a whole day, a past expiry as zero', () => {
  assert.equal(remainingDays(new Date(now.getTime() + 10 * DAY_MS), now), 10);
  assert.equal(remainingDays(new Date(now.getTime() + 1), now), 1);
  assert.equal(
    remainingDays(new Date(now.getTime() + 10 * DAY_MS + 1), now),
    11,
  );
  assert.equal(remainingDays(new Date(now.getTime() - DAY_MS), now), 0);
});

test('BR-19: amount is the daily price difference times the remaining days', () => {
  assert.equal(
    upgradeAmount(
      { price: 6000n, durationDays: 30 },
      { price: 3000n, durationDays: 30 },
      10,
    ),
    1000n,
  );
});

test('BR-19: daily prices of different durations are compared exactly and rounded up', () => {
  assert.equal(
    upgradeAmount(
      { price: 1000n, durationDays: 7 },
      { price: 1000n, durationDays: 30 },
      3,
    ),
    329n,
  );
  assert.equal(
    upgradeAmount(
      { price: 10n, durationDays: 3 },
      { price: 0n, durationDays: 30 },
      1,
    ),
    4n,
  );
});

test('BR-19: a non-positive result needs no payment', () => {
  assert.equal(
    upgradeAmount(
      { price: 3000n, durationDays: 30 },
      { price: 3000n, durationDays: 30 },
      10,
    ),
    0n,
  );
  assert.equal(
    upgradeAmount(
      { price: 12000n, durationDays: 365 },
      { price: 3000n, durationDays: 30 },
      10,
    ),
    0n,
  );
  assert.equal(
    upgradeAmount(
      { price: 6000n, durationDays: 30 },
      { price: 3000n, durationDays: 30 },
      0,
    ),
    0n,
  );
});

test('BR-18, BR-21: each limit must reach both current usage and the held limit', () => {
  const held = { learners: 50, instructors: 5, courses: 5, storageBytes: 100 };
  const usage = {
    learners: 80,
    instructors: 2,
    courses: null,
    storageBytes: 10,
  };
  assert.deepEqual(
    blockingLimits(
      { learners: 80, instructors: 5, courses: 5, storageBytes: 100 },
      held,
      usage,
    ),
    [],
  );
  assert.deepEqual(
    blockingLimits(
      { learners: 79, instructors: 4, courses: 5, storageBytes: 100 },
      held,
      usage,
    ),
    [
      { limit: 'learners', newLimit: 79, required: 80 },
      { limit: 'instructors', newLimit: 4, required: 5 },
    ],
  );
});
