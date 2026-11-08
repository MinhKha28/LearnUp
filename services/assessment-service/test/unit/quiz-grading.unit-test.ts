/** UC29.1, BR-197 / BR-198: how a Quiz attempt is scored and which attempt is the one that counts. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  allowsSeveralOptions,
  bestAttemptOf,
  gradeAttempt,
  roundScore,
} from '../../src/modules/quiz-attempts/quiz-grading';

const questions = [
  { id: 'q1', correctOptionIds: ['a'] },
  { id: 'q2', correctOptionIds: ['x', 'y'] },
  { id: 'q3', correctOptionIds: ['t'] },
  { id: 'q4', correctOptionIds: ['m'] },
];
const answers = (entries: Record<string, string[]>) =>
  new Map(Object.entries(entries));

describe('gradeAttempt (BR-197)', () => {
  test('every question right: 100', () => {
    assert.deepEqual(
      gradeAttempt(
        questions,
        answers({ q1: ['a'], q2: ['x', 'y'], q3: ['t'], q4: ['m'] }),
      ),
      { correct: 4, total: 4, score: 100 },
    );
  });

  test('nothing answered: 0, not an error', () => {
    assert.deepEqual(gradeAttempt(questions, answers({})), {
      correct: 0,
      total: 4,
      score: 0,
    });
  });

  test('a question is right only when the set of options is exactly the key (no partial credit)', () => {
    const r = gradeAttempt(
      questions,
      answers({ q1: ['a'], q2: ['x'], q3: ['f'], q4: [] }),
    );
    assert.equal(r.correct, 1); // q2 has one of two right options: wrong
    assert.equal(r.score, 25);
    // one right option plus a wrong one is wrong too
    assert.equal(
      gradeAttempt(questions, answers({ q2: ['x', 'y', 'z'] })).correct,
      0,
    );
  });

  test('the order of the options chosen does not matter, and a repeated option counts once', () => {
    assert.equal(
      gradeAttempt(questions, answers({ q2: ['y', 'x'] })).correct,
      1,
    );
    assert.equal(
      gradeAttempt(questions, answers({ q2: ['x', 'x', 'y'] })).correct,
      1,
    );
  });

  test('answers for a question that is not in the Quiz are ignored', () => {
    assert.deepEqual(gradeAttempt(questions, answers({ other: ['a'] })), {
      correct: 0,
      total: 4,
      score: 0,
    });
  });

  test('rounds to 2 decimal places: 1 right of 3 is 33.33, 2 of 3 is 66.67', () => {
    const three = questions.slice(0, 3);
    assert.equal(gradeAttempt(three, answers({ q1: ['a'] })).score, 33.33);
    assert.equal(
      gradeAttempt(three, answers({ q1: ['a'], q3: ['t'] })).score,
      66.67,
    );
  });

  test('a Quiz without question scores 0 and does not divide by zero', () => {
    assert.deepEqual(gradeAttempt([], answers({})), {
      correct: 0,
      total: 0,
      score: 0,
    });
  });

  test('a question whose key is empty is never right, whatever is chosen', () => {
    assert.equal(
      gradeAttempt([{ id: 'q', correctOptionIds: [] }], answers({ q: [] }))
        .correct,
      0,
    );
  });
});

describe('roundScore', () => {
  test('2 decimal places, the half goes up', () => {
    assert.equal(roundScore(66.666), 66.67);
    assert.equal(roundScore(1.005), 1.01);
    assert.equal(roundScore(100), 100);
    assert.equal(roundScore(0), 0);
  });
});

describe('allowsSeveralOptions', () => {
  test('only the multiple-choice question takes several options', () => {
    assert.equal(allowsSeveralOptions('MultipleChoice'), true);
    assert.equal(allowsSeveralOptions('SingleChoice'), false);
    assert.equal(allowsSeveralOptions('TrueFalse'), false);
  });
});

describe('bestAttemptOf (BR-198)', () => {
  const at = (n: number) => new Date(`2026-11-0${n}T10:00:00Z`);
  const attempt = (
    id: string,
    attemptNumber: number,
    score: number | null,
    submitted = true,
  ) => ({
    id,
    attemptNumber,
    score,
    submittedAt: submitted ? at(attemptNumber) : null,
  });

  test('the highest score wins, even when a later attempt is lower', () => {
    assert.equal(
      bestAttemptOf([
        attempt('a', 1, 50),
        attempt('b', 2, 90),
        attempt('c', 3, 70),
      ]),
      'b',
    );
  });

  test('on a tie the earlier attempt wins, in whatever order they come', () => {
    assert.equal(
      bestAttemptOf([attempt('b', 2, 80), attempt('a', 1, 80)]),
      'a',
    );
    assert.equal(
      bestAttemptOf([attempt('a', 1, 80), attempt('b', 2, 80)]),
      'a',
    );
  });

  test('an attempt still running does not count, nor one without a score', () => {
    assert.equal(
      bestAttemptOf([attempt('a', 1, 10), attempt('b', 2, 99, false)]),
      'a',
    );
    assert.equal(bestAttemptOf([attempt('a', 1, null)]), null);
  });

  test('nothing submitted: null', () => {
    assert.equal(bestAttemptOf([]), null);
  });

  test('a score of 0 is a score', () => {
    assert.equal(bestAttemptOf([attempt('a', 1, 0)]), 'a');
  });
});
