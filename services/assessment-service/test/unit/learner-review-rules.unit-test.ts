/** UC31 and UC31.1: what a Learner may do with a review, where a submission goes when its reviews are all given, and the Rubric score. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  neutralFileName,
  outcomeOfReviews,
  reviewStateOf,
} from '../../src/modules/learner-reviews/review-rules';
import {
  roundScore,
  scoreFromRubric,
} from '../../src/modules/peer-review/rubric-score';

const NOW = new Date('2026-11-02T03:00:00.000Z');
const FUTURE = new Date('2026-11-05T00:00:00.000Z');
const PAST = new Date('2026-10-30T00:00:00.000Z');

describe('reviewStateOf', () => {
  test('a Pending review of a cycle that was handed out, before its deadline, is Open', () => {
    assert.equal(
      reviewStateOf(
        { status: 'Pending' },
        { status: 'Assigned', reviewDueAt: FUTURE },
        NOW,
      ),
      'Open',
    );
  });

  test('a review that was given is Done, whatever the deadline says', () => {
    for (const reviewDueAt of [PAST, FUTURE]) {
      assert.equal(
        reviewStateOf(
          { status: 'Completed' },
          { status: 'Completed', reviewDueAt },
          NOW,
        ),
        'Done',
      );
    }
  });

  test('at the deadline and after it a Pending review is Closed', () => {
    const cycle = { status: 'Assigned', reviewDueAt: NOW };
    assert.equal(reviewStateOf({ status: 'Pending' }, cycle, NOW), 'Closed');
    assert.equal(
      reviewStateOf(
        { status: 'Pending' },
        { status: 'Assigned', reviewDueAt: PAST },
        NOW,
      ),
      'Closed',
    );
  });

  test('a Missed review is Closed even when the deadline is ahead (the Instructor has taken over)', () => {
    assert.equal(
      reviewStateOf(
        { status: 'Missed' },
        { status: 'Assigned', reviewDueAt: FUTURE },
        NOW,
      ),
      'Closed',
    );
  });

  test('a Pending review of a cycle that is not Assigned is Closed', () => {
    for (const status of ['Open', 'Completed', 'InstructorOnly']) {
      assert.equal(
        reviewStateOf(
          { status: 'Pending' },
          { status, reviewDueAt: FUTURE },
          NOW,
        ),
        'Closed',
        status,
      );
    }
    assert.equal(reviewStateOf({ status: 'Pending' }, null, NOW), 'Closed');
  });
});

describe('outcomeOfReviews', () => {
  test('peers within the threshold send the submission to its grade', () => {
    assert.deepEqual(outcomeOfReviews(['80.00', '70.00'], 20), {
      gradingStatus: 'AwaitingFinalization',
      interventionReason: null,
    });
  });

  test('peers that differ by exactly the threshold are still within it (BR-253 says greater than)', () => {
    assert.equal(
      outcomeOfReviews(['90', '70'], 20).gradingStatus,
      'AwaitingFinalization',
    );
  });

  test('peers that differ by more than the threshold send it to the Instructor, with the reason', () => {
    assert.deepEqual(outcomeOfReviews(['90.00', '69.99'], 20), {
      gradingStatus: 'AwaitingInstructor',
      interventionReason: 'SCORE_GAP_EXCEEDED',
    });
  });

  test('one peer only has nobody to differ from: its grade', () => {
    assert.equal(
      outcomeOfReviews(['10'], 0).gradingStatus,
      'AwaitingFinalization',
    );
  });

  test('the gap is the highest minus the lowest of all, not of neighbours', () => {
    assert.equal(
      outcomeOfReviews(['50', '60', '75'], 20).gradingStatus,
      'AwaitingInstructor',
    );
  });
});

describe('neutralFileName', () => {
  test('keeps the kind of file and nothing of the name of the author', () => {
    assert.equal(neutralFileName('application/pdf'), 'submitted-work.pdf');
    assert.equal(neutralFileName('application/zip'), 'submitted-work.zip');
    assert.equal(
      neutralFileName(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
      'submitted-work.docx',
    );
    assert.equal(neutralFileName('APPLICATION/PDF'), 'submitted-work.pdf');
  });

  test('an unknown kind has no extension', () => {
    assert.equal(neutralFileName('text/plain'), 'submitted-work');
    assert.equal(neutralFileName(null), 'submitted-work');
  });
});

describe('scoreFromRubric (BR-257, BR-202)', () => {
  const rubric = [
    { id: 'c1', maxPoints: 10 },
    { id: 'c2', maxPoints: 5 },
  ];
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      if (error instanceof BadRequestException)
        return (error.getResponse() as { code: string }).code;
      throw error;
    }
    return 'no error';
  };

  test('is the points given over the points possible, on 0-100 with two decimals', () => {
    assert.equal(
      scoreFromRubric(rubric, [
        { criterionId: 'c1', points: 7 },
        { criterionId: 'c2', points: 3 },
      ]),
      66.67,
    );
    assert.equal(
      scoreFromRubric(rubric, [
        { criterionId: 'c2', points: 5 },
        { criterionId: 'c1', points: 10 },
      ]),
      100,
    );
    assert.equal(
      scoreFromRubric(rubric, [
        { criterionId: 'c1', points: 0 },
        { criterionId: 'c2', points: 0 },
      ]),
      0,
    );
  });

  test('wants a score for every criterion, none twice, none that is not in the Rubric', () => {
    assert.equal(
      code(() => scoreFromRubric(rubric, [{ criterionId: 'c1', points: 1 }])),
      'RUBRIC_SCORES_INCOMPLETE',
    );
    assert.equal(
      code(() =>
        scoreFromRubric(rubric, [
          { criterionId: 'c1', points: 1 },
          { criterionId: 'c1', points: 2 },
        ]),
      ),
      'RUBRIC_SCORES_INCOMPLETE',
    );
    assert.equal(
      code(() =>
        scoreFromRubric(rubric, [
          { criterionId: 'c1', points: 1 },
          { criterionId: 'other', points: 2 },
        ]),
      ),
      'RUBRIC_SCORES_INCOMPLETE',
    );
  });

  test('refuses more points than the criterion allows, and a Rubric with no criteria', () => {
    assert.equal(
      code(() =>
        scoreFromRubric(rubric, [
          { criterionId: 'c1', points: 11 },
          { criterionId: 'c2', points: 0 },
        ]),
      ),
      'RUBRIC_SCORE_OUT_OF_RANGE',
    );
    assert.equal(
      code(() => scoreFromRubric([], [])),
      'RUBRIC_MISSING',
    );
  });

  test('roundScore keeps two decimals', () => {
    assert.equal(roundScore(66.666), 66.67);
    assert.equal(roundScore(0.1 + 0.2), 0.3);
  });
});
