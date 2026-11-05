/** UC28.1: what the results of a Learner in a Course are made of. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildAssessmentResults,
  type ResultAssessment,
  type ResultAttempt,
  type ResultSubmission,
} from '../../src/modules/assessment-results/assessment-results';

const at = (day: number, hour = 10) =>
  new Date(Date.UTC(2026, 10, day, hour, 0, 0));

const quiz = (
  id: string,
  over: Partial<ResultAssessment> = {},
): ResultAssessment => ({
  id,
  kind: 'QUIZ',
  title: `Quiz ${id}`,
  isRequired: true,
  disabledAt: null,
  passingScore: 70,
  ...over,
});
const assignment = (
  id: string,
  over: Partial<ResultAssessment> = {},
): ResultAssessment => ({
  id,
  kind: 'ASSIGNMENT',
  title: `Assignment ${id}`,
  isRequired: false, // an Assignment is required whatever the flag says (BR-206)
  disabledAt: null,
  passingScore: 60,
  ...over,
});
const attempt = (
  assessmentId: string,
  attemptNumber: number,
  score: number | null,
  over: Partial<ResultAttempt> = {},
): ResultAttempt => ({
  assessmentId,
  attemptNumber,
  startedAt: at(attemptNumber),
  submittedAt: score === null ? null : at(attemptNumber, 11),
  submissionKind: score === null ? null : 'Manual',
  score,
  ...over,
});
const submission = (
  assessmentId: string,
  submissionNumber: number,
  over: Partial<ResultSubmission> = {},
): ResultSubmission => ({
  assessmentId,
  submissionNumber,
  submittedAt: at(submissionNumber),
  gradingStatus: 'AwaitingInstructor',
  finalScore: null,
  supersededAt: null,
  ...over,
});

describe('a Quiz in the results', () => {
  test('a Quiz nobody did is not there ("đã thực hiện")', () => {
    assert.deepEqual(buildAssessmentResults([quiz('q')], [], []), []);
    assert.deepEqual(
      buildAssessmentResults([quiz('q')], [attempt('other', 1, 90)], []),
      [],
    );
  });

  test('the recorded score is the best submitted attempt and is set against the passing score (BR-198)', () => {
    const [item] = buildAssessmentResults(
      [quiz('q')],
      [attempt('q', 1, 50), attempt('q', 2, 85), attempt('q', 3, 60)],
      [],
    );
    assert.equal(item.kind, 'QUIZ');
    assert.equal(item.recordedScore, 85);
    assert.equal(item.passed, true);
    assert.equal(item.passingScore, 70);
    assert.equal(item.status, 'Completed');
    assert.equal(item.attemptCount, 3);
    assert.equal(item.quiz?.bestAttemptNumber, 2);
    assert.deepEqual(
      item.quiz?.attempts.map((a) => [a.attemptNumber, a.score]),
      [
        [1, 50],
        [2, 85],
        [3, 60],
      ],
    );
    assert.equal(item.assignment, null);
  });

  test('a tie goes to the earlier attempt, whatever order the rows come in', () => {
    const rows = [
      attempt('q', 3, 80),
      attempt('q', 1, 80),
      attempt('q', 2, 40),
    ];
    assert.equal(
      buildAssessmentResults([quiz('q')], rows, [])[0].quiz?.bestAttemptNumber,
      1,
    );
    assert.equal(
      buildAssessmentResults([quiz('q')], [...rows].reverse(), [])[0].quiz
        ?.bestAttemptNumber,
      1,
    );
  });

  test('the passing score is reached exactly: passed; one point less: not passed; a score of 0 is a score, not "no result"', () => {
    assert.equal(
      buildAssessmentResults([quiz('q')], [attempt('q', 1, 70)], [])[0].passed,
      true,
    );
    assert.equal(
      buildAssessmentResults([quiz('q')], [attempt('q', 1, 69.99)], [])[0]
        .passed,
      false,
    );
    const zero = buildAssessmentResults(
      [quiz('q')],
      [attempt('q', 1, 0)],
      [],
    )[0];
    assert.equal(zero.recordedScore, 0);
    assert.equal(zero.passed, false);
  });

  test('an attempt that is running is InProgress and does not give a score; one submitted before it still does', () => {
    const [onlyRunning] = buildAssessmentResults(
      [quiz('q')],
      [attempt('q', 1, null)],
      [],
    );
    assert.equal(onlyRunning.status, 'InProgress');
    assert.equal(onlyRunning.recordedScore, null);
    assert.equal(
      onlyRunning.passed,
      null,
      'BR-191: no score is "not completed", not "failed"',
    );
    assert.equal(onlyRunning.attemptCount, 0);
    assert.equal(onlyRunning.quiz?.bestAttemptNumber, null);
    assert.deepEqual(onlyRunning.quiz?.attempts, []);

    const [both] = buildAssessmentResults(
      [quiz('q')],
      [attempt('q', 1, 90), attempt('q', 2, null)],
      [],
    );
    assert.equal(both.status, 'InProgress');
    assert.equal(both.recordedScore, 90);
    assert.equal(both.passed, true);
    assert.equal(both.attemptCount, 1);
  });

  test('only a submitted attempt can give a score: a running one that holds a stray score does not count', () => {
    const [item] = buildAssessmentResults(
      [quiz('q')],
      [attempt('q', 1, 40), attempt('q', 2, 95, { submittedAt: null })],
      [],
    );
    assert.equal(item.recordedScore, 40);
    assert.equal(item.quiz?.bestAttemptNumber, 1);
    assert.equal(item.attemptCount, 1);
    assert.deepEqual(
      item.quiz?.attempts.map((a) => a.attemptNumber),
      [1],
    );
    assert.equal(item.status, 'InProgress');
  });

  test('how an attempt was submitted is kept, so a time-out can be told from a submit', () => {
    const [item] = buildAssessmentResults(
      [quiz('q')],
      [
        attempt('q', 1, 40, { submissionKind: 'TimedOut' }),
        attempt('q', 2, 60),
      ],
      [],
    );
    assert.deepEqual(
      item.quiz?.attempts.map((a) => a.submissionKind),
      ['TimedOut', 'Manual'],
    );
  });

  test('a Quiz is required only when its flag says so, and a disabled one is marked but keeps its score (BR-296)', () => {
    const [optional] = buildAssessmentResults(
      [quiz('q', { isRequired: false })],
      [attempt('q', 1, 80)],
      [],
    );
    assert.equal(optional.isRequired, false);
    const [disabled] = buildAssessmentResults(
      [quiz('q', { disabledAt: at(5) })],
      [attempt('q', 1, 80)],
      [],
    );
    assert.equal(disabled.disabled, true);
    assert.equal(disabled.recordedScore, 80);
    assert.equal(
      buildAssessmentResults([quiz('q')], [attempt('q', 1, 80)], [])[0]
        .disabled,
      false,
    );
  });

  test('the last activity is the end of the last attempt, or the start of the one running', () => {
    assert.equal(
      buildAssessmentResults(
        [quiz('q')],
        [attempt('q', 1, 50), attempt('q', 2, 60)],
        [],
      )[0].lastActivityAt,
      at(2, 11).toISOString(),
    );
    assert.equal(
      buildAssessmentResults(
        [quiz('q')],
        [attempt('q', 1, 50), attempt('q', 2, null)],
        [],
      )[0].lastActivityAt,
      at(2).toISOString(),
    );
  });
});

describe('an Assignment in the results', () => {
  test('an Assignment nobody submitted is not there', () => {
    assert.deepEqual(buildAssessmentResults([assignment('a')], [], []), []);
  });

  test('waiting for a grade: AwaitingResult, no score, and not "failed"', () => {
    const [item] = buildAssessmentResults(
      [assignment('a')],
      [],
      [submission('a', 1)],
    );
    assert.equal(item.kind, 'ASSIGNMENT');
    assert.equal(item.status, 'AwaitingResult');
    assert.equal(item.recordedScore, null);
    assert.equal(item.passed, null);
    assert.equal(item.assignment?.gradingStatus, 'AwaitingInstructor');
    assert.equal(item.assignment?.latestSubmissionNumber, 1);
    assert.equal(item.quiz, null);
  });

  test('a Finalized submission gives the score, set against the passing score; every Assignment is required (BR-206)', () => {
    const [pass] = buildAssessmentResults(
      [assignment('a')],
      [],
      [submission('a', 1, { gradingStatus: 'Finalized', finalScore: 60 })],
    );
    assert.equal(pass.status, 'Completed');
    assert.equal(pass.recordedScore, 60);
    assert.equal(pass.passed, true);
    assert.equal(pass.isRequired, true);
    const [fail] = buildAssessmentResults(
      [assignment('a')],
      [],
      [submission('a', 1, { gradingStatus: 'Finalized', finalScore: 59.5 })],
    );
    assert.equal(fail.passed, false);
  });

  test('the latest submission that was not replaced counts; an old finalized one does not (BR-170, BR-212)', () => {
    const [item] = buildAssessmentResults(
      [assignment('a')],
      [],
      [
        submission('a', 1, {
          gradingStatus: 'Finalized',
          finalScore: 90,
          supersededAt: at(3),
        }),
        submission('a', 2, { gradingStatus: 'AwaitingInstructor' }),
      ],
    );
    assert.equal(item.status, 'AwaitingResult');
    assert.equal(
      item.recordedScore,
      null,
      'a resubmission not graded yet has no score',
    );
    assert.equal(item.attemptCount, 2);
    assert.equal(item.assignment?.latestSubmissionNumber, 2);
  });

  test('a Finalized row without a score is not a result', () => {
    const [item] = buildAssessmentResults(
      [assignment('a')],
      [],
      [submission('a', 1, { gradingStatus: 'Finalized', finalScore: null })],
    );
    assert.equal(item.status, 'AwaitingResult');
    assert.equal(item.recordedScore, null);
  });

  test('a score is a result only when the submission is Finalized, whatever a row of another state still holds', () => {
    for (const gradingStatus of [
      'AwaitingPeerReview',
      'AwaitingInstructor',
      'AwaitingFinalization',
    ]) {
      const [item] = buildAssessmentResults(
        [assignment('a')],
        [],
        [submission('a', 1, { gradingStatus, finalScore: 75 })],
      );
      assert.equal(item.status, 'AwaitingResult', gradingStatus);
      assert.equal(item.recordedScore, null, gradingStatus);
      assert.equal(item.passed, null, gradingStatus);
    }
  });

  test('the submissions of another Assignment are not mixed in', () => {
    const items = buildAssessmentResults(
      [assignment('a'), assignment('b')],
      [],
      [submission('a', 1, { gradingStatus: 'Finalized', finalScore: 80 })],
    );
    assert.deepEqual(
      items.map((i) => i.assessmentId),
      ['a'],
    );
  });
});

describe('the list as a whole', () => {
  test('the most recent activity first, then by title; Quizzes and Assignments are mixed', () => {
    const items = buildAssessmentResults(
      [
        quiz('q1', { title: 'B quiz' }),
        quiz('q2', { title: 'A quiz' }),
        assignment('a1', { title: 'Essay' }),
      ],
      [
        attempt('q1', 1, 50, { submittedAt: at(10) }),
        attempt('q2', 1, 50, { submittedAt: at(10) }),
      ],
      [submission('a1', 1, { submittedAt: at(12) })],
    );
    assert.deepEqual(
      items.map((i) => i.title),
      ['Essay', 'A quiz', 'B quiz'],
    );
  });

  test('the sort key does not leak into the answer, and the input is not changed', () => {
    const attempts = [attempt('q', 2, 70), attempt('q', 1, 50)];
    const before = JSON.stringify(attempts);
    const [item] = buildAssessmentResults([quiz('q')], attempts, []);
    assert.equal(JSON.stringify(attempts), before);
    assert.ok(!('sortKey' in item));
    assert.deepEqual(Object.keys(item).sort(), [
      'assessmentId',
      'assignment',
      'attemptCount',
      'disabled',
      'isRequired',
      'kind',
      'lastActivityAt',
      'passed',
      'passingScore',
      'quiz',
      'recordedScore',
      'status',
      'title',
    ]);
  });

  test('a Course with nothing done is an empty list', () => {
    assert.deepEqual(buildAssessmentResults([], [], []), []);
  });
});
