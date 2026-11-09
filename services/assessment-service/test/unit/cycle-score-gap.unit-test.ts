/** UC33.1, BR-252, BR-253: which submissions of a cycle the Instructor has to look at again for the gap of the scores. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  needsScoreReview,
  scoreSpread,
} from '../../src/modules/peer-review/cycle-detail';

describe('scoreSpread', () => {
  test('is the highest minus the lowest of the valid scores', () => {
    assert.deepEqual(scoreSpread(['80.00', '55.50', '70']), {
      lowest: 55.5,
      highest: 80,
      gap: 24.5,
    });
  });

  test('has no gap with fewer than two scores: there is nothing to compare', () => {
    assert.equal(scoreSpread([]), null);
    assert.equal(scoreSpread(['90.00']), null);
  });

  test('two equal scores have a gap of 0', () => {
    assert.equal(scoreSpread([70, 70])?.gap, 0);
  });

  test('does not drift on decimals: 1.15 - 1.00 is exactly 0.15, not 0.14999999999999991', () => {
    assert.equal(scoreSpread(['1.15', '1.00'])?.gap, 0.15);
  });
});

describe('needsScoreReview', () => {
  test('is true above the threshold', () => {
    assert.equal(needsScoreReview(20.01, 20, false), true);
  });

  test('is false at the threshold: the rule says greater than (BR-253)', () => {
    assert.equal(needsScoreReview(20, 20, false), false);
  });

  test('is false below the threshold', () => {
    assert.equal(needsScoreReview(5, 20, false), false);
  });

  test('is false with no gap', () => {
    assert.equal(needsScoreReview(null, 20, false), false);
  });

  test('is false once the Instructor finalized the submission', () => {
    assert.equal(needsScoreReview(60, 20, true), false);
  });

  test('is exact on decimals: a gap of 0.15 from 1.15 and 1.00 does not pass a threshold of 0.15', () => {
    const spread = scoreSpread(['1.15', '1.00']);
    assert.equal(needsScoreReview(spread?.gap ?? null, 0.15, false), false);
  });
});
