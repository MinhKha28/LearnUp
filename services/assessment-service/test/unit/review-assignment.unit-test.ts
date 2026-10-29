/** UC33: the ring of reviews (BR-242, BR-248, BR-249) for many sizes of the set of submitters. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assignReviews,
  canAssign,
  shuffle,
} from '../../src/modules/peer-review/review-assignment';

const learners = (count: number) =>
  Array.from({ length: count }, (_, i) => `L${i}`);

/** A small seeded generator, so a failing size can be run again. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('assignReviews', () => {
  test('every submission gets exactly N different reviewers, never its author, and everyone reviews N', () => {
    for (let n = 1; n <= 5; n += 1) {
      for (let m = n + 1; m <= 25; m += 1) {
        const ring = shuffle(learners(m), seeded(m * 31 + n));
        const pairs = assignReviews(ring, n);

        assert.equal(pairs.length, m * n, `m=${m} n=${n}`);
        const reviewersOf = new Map<string, Set<string>>();
        const workOf = new Map<string, number>();
        for (const { authorId, reviewerId } of pairs) {
          assert.notEqual(authorId, reviewerId, `own work m=${m} n=${n}`);
          reviewersOf.set(
            authorId,
            (reviewersOf.get(authorId) ?? new Set()).add(reviewerId),
          );
          workOf.set(reviewerId, (workOf.get(reviewerId) ?? 0) + 1);
        }
        for (const id of ring) {
          assert.equal(
            reviewersOf.get(id)?.size,
            n,
            `reviewers of ${id} m=${m} n=${n}`,
          );
          assert.equal(workOf.get(id), n, `work of ${id} m=${m} n=${n}`);
        }
      }
    }
  });

  test('fewer than N + 1 submitters: nothing is assigned (BR-242)', () => {
    for (let n = 1; n <= 5; n += 1) {
      for (let m = 0; m <= n; m += 1) {
        assert.equal(canAssign(m, n), false);
        assert.deepEqual(assignReviews(learners(m), n), []);
      }
      assert.equal(canAssign(n + 1, n), true);
    }
  });

  test('the same permutation gives the same pairs: closing again changes nothing', () => {
    const ring = shuffle(learners(9), seeded(7));
    assert.deepEqual(assignReviews(ring, 3), assignReviews([...ring], 3));
  });

  test('the ring follows the permutation, not the order of submission (BR-249)', () => {
    assert.deepEqual(assignReviews(['C', 'A', 'B'], 1), [
      { authorId: 'C', reviewerId: 'A' },
      { authorId: 'A', reviewerId: 'B' },
      { authorId: 'B', reviewerId: 'C' },
    ]);
  });
});

describe('shuffle', () => {
  test('keeps every element once and leaves the input alone', () => {
    const input = learners(12);
    const out = shuffle(input, seeded(3));
    assert.deepEqual([...out].sort(), [...input].sort());
    assert.deepEqual(input, learners(12));
  });

  test('different random numbers give different orders', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed += 1)
      seen.add(shuffle(learners(8), seeded(seed)).join());
    assert.ok(seen.size > 10);
  });
});
