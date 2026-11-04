const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  exceededLimits,
  renewalPeriod,
} = require('../dist/src/modules/subscriptions/renewal.policy');

const DAY_MS = 24 * 60 * 60 * 1000;
const expiresAt = new Date('2026-11-20T00:00:00.000Z');
const paidAt = new Date('2026-11-25T08:00:00.000Z');
const days = (date, count) => new Date(date.getTime() + count * DAY_MS);

test('BR-17: Active renews early as a Scheduled term from the current expiry', () => {
  assert.deepEqual(renewalPeriod({ status: 'Active', expiresAt }, 30, paidAt), {
    status: 'Scheduled',
    startsAt: expiresAt,
    expiresAt: days(expiresAt, 30),
    endsCurrent: false,
  });
});

test('BR-15: Grace counts from the old expiry, so used grace days are lost', () => {
  assert.deepEqual(renewalPeriod({ status: 'Grace', expiresAt }, 30, paidAt), {
    status: 'Active',
    startsAt: expiresAt,
    expiresAt: days(expiresAt, 30),
    endsCurrent: true,
  });
});

test('BR-16: Suspended counts from the payment date', () => {
  assert.deepEqual(
    renewalPeriod({ status: 'Suspended', expiresAt }, 30, paidAt),
    {
      status: 'Active',
      startsAt: paidAt,
      expiresAt: days(paidAt, 30),
      endsCurrent: true,
    },
  );
});

test('other statuses cannot renew', () => {
  for (const status of ['Scheduled', 'Ended', 'Unknown']) {
    assert.equal(renewalPeriod({ status, expiresAt }, 30, paidAt), null);
  }
});

test('BR-4: only limits below current usage are reported', () => {
  assert.deepEqual(
    exceededLimits(
      { learners: 11, instructors: 5, courses: null, storageBytes: 10 },
      { learners: 10, instructors: 5, courses: 1, storageBytes: 20 },
    ),
    [{ limit: 'learners', used: 11, newLimit: 10 }],
  );
});
