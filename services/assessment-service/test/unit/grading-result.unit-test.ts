/** UC30.2: the averages per criterion and the anonymous comments (BR-208, BR-322, BR-191). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildGradingResult } from '../../src/modules/learner-submissions/grading-result';

const rubric = [
  { id: 'c1', name: 'Content', maxPoints: 10 },
  { id: 'c2', name: 'Style', maxPoints: 5 },
];
const at = (day: string) => new Date(`2026-10-${day}T00:00:00Z`);
const review = (
  role: string,
  comment: string | null,
  day: string,
  scores: [number, number] | [] = [],
) => ({
  reviewerRole: role,
  comment,
  completedAt: at(day),
  scores: scores.map((points, i) => ({ criterionId: `c${i + 1}`, points })),
});

describe('buildGradingResult (UC30.2)', () => {
  test('averages each criterion over the reviews and rounds to 2 decimals', () => {
    const { criteria } = buildGradingResult(rubric, [
      review('LEARNER', 'a', '01', [7, 3]),
      review('LEARNER', 'b', '02', [8, 3]),
      review('Instructor', 'c', '03', [8, 4]),
    ]);
    assert.deepEqual(
      criteria.map((c) => c.averagePoints),
      [7.67, 3.33],
    );
  });

  test('a criterion nobody scored has no average', () => {
    const { criteria } = buildGradingResult(rubric, []);
    assert.deepEqual(
      criteria.map((c) => c.averagePoints),
      [null, null],
    );
  });

  test('the role of the Instructor is the one UC32.2 writes, whatever the case', () => {
    for (const role of ['Instructor', 'INSTRUCTOR']) {
      const { comments } = buildGradingResult(rubric, [review(role, 'x', '01')]);
      assert.equal(comments[0].source, 'INSTRUCTOR', role);
    }
    const { comments } = buildGradingResult(rubric, [review('Learner', 'y', '01')]);
    assert.equal(comments[0].source, 'PEER');
  });

  test('comments say peer or Instructor, are in the order written, and empty ones are left out', () => {
    const { comments } = buildGradingResult(rubric, [
      review('Instructor', 'second', '02'),
      review('LEARNER', 'first', '01'),
      review('LEARNER', '   ', '03'),
      review('LEARNER', null, '04'),
    ]);
    assert.deepEqual(
      comments.map((c) => [c.source, c.comment]),
      [
        ['PEER', 'first'],
        ['INSTRUCTOR', 'second'],
      ],
    );
    assert.deepEqual(Object.keys(comments[0]).sort(), [
      'comment',
      'completedAt',
      'source',
    ]);
  });
});
