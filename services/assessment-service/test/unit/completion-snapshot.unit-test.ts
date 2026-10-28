/** The completion snapshot (CT-1): the rules of the score and of peer review, and that learning's validator accepts it. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildCompletionSnapshot,
  peerReviewOf,
  recordedAttempt,
  scoreText,
  uuidV5,
  type AssignmentFacts,
  type QuizFacts,
} from '../../src/modules/completion-snapshot/completion-snapshot';
import { CompletionSnapshotRepository } from '../../src/modules/completion-snapshot/completion-snapshot.repository';
import { brokenRules } from './completion-contract';

const ORG = '00000000-0000-4000-8000-000000000001';
const LEARNER = '00000000-0000-4000-8000-0000000000c1';
const COURSE = '00000000-0000-4000-8000-000000000004';
const NOW = new Date('2026-10-27T10:00:00.000Z');
const PAST = new Date('2026-10-20T00:00:00.000Z');
const FUTURE = new Date('2026-11-20T00:00:00.000Z');
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const quiz = (n: number, passing: string, scores: (string | null)[]) =>
  ({
    assessmentId: id(100 + n),
    passingScore: passing,
    attempts: scores.map((score, i) => ({
      id: id(1000 + n * 10 + i),
      attemptNumber: i + 1,
      score,
    })),
  }) satisfies QuizFacts;

const assignment = (
  n: number,
  passing: string,
  latest: AssignmentFacts['latest'],
  reviews: AssignmentFacts['reviews'] = [],
): AssignmentFacts => ({
  assessmentId: id(200 + n),
  passingScore: passing,
  latest,
  reviews,
});
const finalized = (score: string): AssignmentFacts['latest'] => ({
  id: id(5000),
  gradingStatus: 'Finalized',
  finalScore: score,
  finalizedAt: new Date('2026-10-25T08:30:00.000Z'),
});

const build = (quizzes: QuizFacts[], assignments: AssignmentFacts[]) =>
  buildCompletionSnapshot({
    organizationId: ORG,
    learnerId: LEARNER,
    courseId: COURSE,
    quizzes,
    assignments,
    now: NOW,
  });
const accepted = (snapshot: unknown) =>
  assert.deepEqual(brokenRules(snapshot, ORG, LEARNER, COURSE), []);

describe('the score of a Quiz (BR-198)', () => {
  test('is the best submitted attempt', () => {
    const snapshot = build([quiz(1, '70', ['40', '85.5', '60'])], []);
    assert.equal(snapshot.quizzes[0].recordedScore, '85.50');
    assert.equal(snapshot.quizzes[0].attemptId, id(1000 + 10 + 1));
    assert.equal(snapshot.quizzes[0].passed, true);
    accepted(snapshot);
  });

  test('on a tie the earlier attempt is the recorded one', () => {
    const best = recordedAttempt([
      { id: 'b', attemptNumber: 2, score: '90' },
      { id: 'a', attemptNumber: 1, score: '90.00' },
      { id: 'c', attemptNumber: 3, score: '90' },
    ]);
    assert.equal(best?.id, 'a');
  });

  test('no scored attempt is not passed, with no attempt and no score', () => {
    const snapshot = build([quiz(1, '70', [null]), quiz(2, '70', [])], []);
    for (const q of snapshot.quizzes) {
      assert.equal(q.attemptId, null);
      assert.equal(q.recordedScore, null);
      assert.equal(q.passed, false);
    }
    assert.equal(snapshot.eligible, false);
    accepted(snapshot);
  });

  test('an attempt that scored 0 is a result: it has an attempt and a score of 0.00, and passes only a passing score of 0', () => {
    const fails = build([quiz(1, '70', ['0'])], []).quizzes[0];
    assert.equal(fails.recordedScore, '0.00');
    assert.notEqual(fails.attemptId, null);
    assert.equal(fails.passed, false);
    const passes = build([quiz(1, '0', ['0'])], []);
    assert.equal(passes.quizzes[0].passed, true);
    accepted(passes);
  });

  test('exactly the passing score passes; one hundredth under does not', () => {
    const at = build([quiz(1, '70', ['70'])], []);
    const under = build([quiz(1, '70', ['69.99'])], []);
    assert.equal(at.quizzes[0].passed, true);
    assert.equal(under.quizzes[0].passed, false);
    accepted(at);
    accepted(under);
  });
});

describe('the score of an Assignment (BR-212)', () => {
  test('only a finalized grade is a result', () => {
    const waiting = build(
      [],
      [
        assignment(1, '70', {
          id: id(5001),
          gradingStatus: 'AwaitingInstructor',
          finalScore: null,
          finalizedAt: null,
        }),
      ],
    );
    assert.equal(waiting.assignments[0].submissionId, id(5001));
    assert.equal(waiting.assignments[0].finalScore, null);
    assert.equal(waiting.assignments[0].finalizedAt, null);
    assert.equal(waiting.assignments[0].passed, false);
    accepted(waiting);
  });

  test('a score without a finalized status is not shown (it would be a draft)', () => {
    const snapshot = build(
      [],
      [
        assignment(1, '70', {
          id: id(5002),
          gradingStatus: 'AwaitingFinalization',
          finalScore: '95',
          finalizedAt: null,
        }),
      ],
    );
    assert.equal(snapshot.assignments[0].finalScore, null);
    assert.equal(snapshot.assignments[0].passed, false);
    accepted(snapshot);
  });

  test('a finalized grade shows the score, the time and passes when it reaches the passing score', () => {
    const snapshot = build([], [assignment(1, '70', finalized('72.25'))]);
    const a = snapshot.assignments[0];
    assert.equal(a.finalScore, '72.25');
    assert.equal(a.finalizedAt, '2026-10-25T08:30:00.000Z');
    assert.equal(a.passed, true);
    accepted(snapshot);
  });

  test('Finalized without a score or without a time is not a result (the row is incomplete, never guess)', () => {
    for (const latest of [
      { ...finalized('90')!, finalScore: null },
      { ...finalized('90')!, finalizedAt: null },
    ]) {
      const snapshot = build([], [assignment(1, '70', latest)]);
      const a = snapshot.assignments[0];
      assert.equal(a.submissionId, latest.id);
      assert.equal(a.finalScore, null);
      assert.equal(a.finalizedAt, null);
      assert.equal(a.passed, false);
      accepted(snapshot);
    }
  });

  test('never submitted: no submission, not passed', () => {
    const snapshot = build([], [assignment(1, '70', null)]);
    assert.equal(snapshot.assignments[0].submissionId, null);
    assert.equal(snapshot.assignments[0].passed, false);
    accepted(snapshot);
  });
});

describe('peer review of an Assignment', () => {
  const r = (status: string, due: Date | null = FUTURE) => ({
    status,
    reviewDueAt: due,
  });
  const of = (reviews: ReturnType<typeof r>[]) => peerReviewOf(reviews, NOW);

  test('no review owed is NotApplicable, 0 of 0', () => {
    assert.deepEqual(of([]), {
      status: 'NotApplicable',
      requiredCount: 0,
      completedCount: 0,
    });
  });

  test('all done is Satisfied', () => {
    assert.deepEqual(of([r('Completed'), r('Completed')]), {
      status: 'Satisfied',
      requiredCount: 2,
      completedCount: 2,
    });
  });

  test('some still to do before the deadline is Pending', () => {
    assert.deepEqual(of([r('Completed'), r('Pending')]), {
      status: 'Pending',
      requiredCount: 2,
      completedCount: 1,
    });
  });

  test('a Pending review past its deadline is Missed at once, before the schedule marks it', () => {
    assert.equal(of([r('Completed'), r('Pending', PAST)]).status, 'Missed');
  });

  test('a review the schedule already marked Missed makes it Missed, and Missed beats the rest', () => {
    const state = of([r('Completed'), r('Missed', PAST), r('Pending')]);
    assert.equal(state.status, 'Missed');
    assert.equal(state.completedCount, 1);
    assert.equal(state.requiredCount, 3);
  });

  test('Pending with no deadline known is not Missed', () => {
    assert.equal(of([r('Pending', null)]).status, 'Pending');
  });

  describe('across cycles: only the latest cycle with assignments counts (BR-236, BR-238, BR-239)', () => {
    // review of the cycle n (a later n closes later); the status and the deadline as in the cycle
    const c = (status: string, n: number, due: Date | null = FUTURE) => ({
      status,
      reviewDueAt: due,
      cycleId: id(900 + n),
      cycleClosesAt: new Date(Date.UTC(2026, 9, 10 + 7 * n)),
    });

    test('Missed in cycle 1 and every review of cycle 2 Completed is Satisfied, counted over cycle 2', () => {
      assert.deepEqual(
        of([
          c('Missed', 1, PAST),
          c('Missed', 1, PAST),
          c('Completed', 2),
          c('Completed', 2),
        ]),
        { status: 'Satisfied', requiredCount: 2, completedCount: 2 },
      );
    });

    test('the order of the rows does not matter', () => {
      assert.deepEqual(
        of([
          c('Completed', 2),
          c('Missed', 1, PAST),
          c('Completed', 2),
          c('Missed', 1, PAST),
        ]),
        { status: 'Satisfied', requiredCount: 2, completedCount: 2 },
      );
    });

    test('Missed in cycle 1 and Missed again in cycle 2 stays Missed', () => {
      assert.equal(
        of([c('Missed', 1, PAST), c('Missed', 2, PAST), c('Completed', 2)])
          .status,
        'Missed',
      );
    });

    test('Missed in cycle 1 and still to do in cycle 2 is Pending: the Learner is on the way out of the debt', () => {
      assert.deepEqual(
        of([c('Missed', 1, PAST), c('Completed', 2), c('Pending', 2)]),
        { status: 'Pending', requiredCount: 2, completedCount: 1 },
      );
    });

    test('a cycle with no assignment for this Learner changes nothing: the Missed of the earlier cycle stays (BR-242)', () => {
      // the recovery cycle had too few submissions, so it has no row here at all
      assert.equal(of([c('Missed', 1, PAST), c('Missed', 1, PAST)]).status, 'Missed');
    });

    test('three cycles: the third one decides', () => {
      assert.equal(
        of([
          c('Missed', 1, PAST),
          c('Missed', 2, PAST),
          c('Completed', 3),
        ]).status,
        'Satisfied',
      );
    });
  });
});

describe('eligible', () => {
  test('a Course with nothing required is eligible (0 components)', () => {
    const snapshot = build([], []);
    assert.equal(snapshot.eligible, true);
    assert.equal(snapshot.requiredComponentCount, 0);
    accepted(snapshot);
  });

  test('everything passed and peer review Satisfied or NotApplicable is eligible', () => {
    const snapshot = build(
      [quiz(1, '70', ['80'])],
      [
        assignment(1, '70', finalized('90'), [
          { status: 'Completed', reviewDueAt: PAST },
        ]),
        assignment(2, '70', finalized('90')),
      ],
    );
    assert.equal(snapshot.eligible, true);
    assert.equal(snapshot.requiredComponentCount, 3);
    accepted(snapshot);
  });

  test('a passed Assignment with the peer review Pending or Missed is not eligible', () => {
    for (const status of ['Pending', 'Missed']) {
      const snapshot = build(
        [],
        [
          assignment(1, '70', finalized('90'), [
            { status, reviewDueAt: status === 'Missed' ? PAST : FUTURE },
          ]),
        ],
      );
      assert.equal(snapshot.eligible, false, status);
      accepted(snapshot);
    }
  });

  test('one Quiz not passed is enough to be not eligible', () => {
    const snapshot = build(
      [quiz(1, '70', ['80']), quiz(2, '70', ['10'])],
      [assignment(1, '70', finalized('90'))],
    );
    assert.equal(snapshot.eligible, false);
    accepted(snapshot);
  });
});

describe('the identity of a snapshot', () => {
  test('the same content gives the same revision and id; asOf may differ', () => {
    const a = build([quiz(1, '70', ['80'])], []);
    const b = buildCompletionSnapshot({
      organizationId: ORG,
      learnerId: LEARNER,
      courseId: COURSE,
      quizzes: [quiz(1, '70', ['80'])],
      assignments: [],
      now: new Date('2026-10-28T00:00:00.000Z'),
    });
    assert.equal(a.revision, b.revision);
    assert.equal(a.snapshotId, b.snapshotId);
    assert.notEqual(a.asOf, b.asOf);
  });

  test('a change of what the Learner did changes both', () => {
    const a = build([quiz(1, '70', ['80'])], []);
    const b = build([quiz(1, '70', ['80', '95'])], []);
    assert.notEqual(a.revision, b.revision);
    assert.notEqual(a.snapshotId, b.snapshotId);
  });

  test('another Learner never gets the same id', () => {
    const a = build([], []);
    const b = buildCompletionSnapshot({
      organizationId: ORG,
      learnerId: id(777),
      courseId: COURSE,
      quizzes: [],
      assignments: [],
      now: NOW,
    });
    assert.notEqual(a.snapshotId, b.snapshotId);
  });

  test('uuidV5 is the standard one (RFC 4122 test vector: the DNS namespace and "www.example.com")', () => {
    assert.equal(
      uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  test('scores are two decimals, never a leading zero', () => {
    assert.equal(scoreText('0'), '0.00');
    assert.equal(scoreText('7.5'), '7.50');
    assert.equal(scoreText('100'), '100.00');
  });
});

describe('what learning accepts', () => {
  test('many Courses of every shape are accepted by the validator of learning', () => {
    let seed = 7;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const scores = [null, '0', '33.3', '69.99', '70', '70.01', '100'];
    const states = ['Completed', 'Pending', 'Missed'];
    for (let run = 0; run < 300; run++) {
      const quizzes = Array.from({ length: next(4) }, (_, i) =>
        quiz(
          i + 1,
          ['0', '50', '70', '100'][next(4)],
          Array.from({ length: next(4) }, () => scores[next(scores.length)]),
        ),
      );
      const assignments = Array.from({ length: next(4) }, (_, i) =>
        assignment(
          i + 1,
          ['0', '70', '100'][next(3)],
          next(4) === 0
            ? null
            : {
                id: id(6000 + i),
                gradingStatus:
                  next(3) === 0 ? 'AwaitingInstructor' : 'Finalized',
                finalScore: scores[next(scores.length)],
                finalizedAt: next(5) === 0 ? null : PAST,
              },
          Array.from({ length: next(4) }, () => ({
            status: states[next(3)],
            reviewDueAt: next(2) === 0 ? PAST : FUTURE,
          })),
        ),
      );
      const snapshot = build(quizzes, assignments);
      assert.deepEqual(
        brokenRules(snapshot, ORG, LEARNER, COURSE),
        [],
        `run ${run}: ${JSON.stringify(snapshot)}`,
      );
    }
  });
});

describe('the copy of the validator of learning rejects what learning rejects (the guard of the guard)', () => {
  const good = () =>
    build([quiz(1, '70', ['80'])], [assignment(1, '70', finalized('90'))]);
  const broken = (change: (value: Record<string, any>) => void) => {
    const value = JSON.parse(JSON.stringify(good())) as Record<string, any>;
    change(value);
    return brokenRules(value, ORG, LEARNER, COURSE);
  };

  test('the good one passes', () => accepted(good()));
  test('an unknown field', () =>
    assert.ok(broken((v) => (v.extra = 1)).length > 0));
  test('another schemaVersion', () =>
    assert.ok(broken((v) => (v.schemaVersion = 2)).length > 0));
  test('a score with three decimals', () =>
    assert.ok(
      broken((v) => (v.quizzes[0].recordedScore = '80.001')).length > 0,
    ));
  test('a score with a leading zero', () =>
    assert.ok(
      broken((v) => (v.quizzes[0].recordedScore = '080.00')).length > 0,
    ));
  test('a wrong requiredComponentCount', () =>
    assert.ok(broken((v) => (v.requiredComponentCount = 5)).length > 0));
  test('a wrong passed on a Quiz', () =>
    assert.ok(broken((v) => (v.quizzes[0].passed = false)).length > 0));
  test('a wrong eligible', () =>
    assert.ok(broken((v) => (v.eligible = false)).length > 0));
  test('Waived (learning does not accept it until L22)', () =>
    assert.ok(
      broken((v) => (v.assignments[0].peerReview.status = 'Waived')).length > 0,
    ));
  test('Satisfied with fewer done than required', () =>
    assert.ok(
      broken((v) => {
        v.assignments[0].peerReview = {
          status: 'Satisfied',
          requiredCount: 2,
          completedCount: 1,
        };
      }).length > 0,
    ));
  test('a finalizedAt that does not end in Z', () =>
    assert.ok(
      broken(
        (v) => (v.assignments[0].finalizedAt = '2026-10-25T08:30:00+07:00'),
      ).length > 0,
    ));
  test('another Learner', () =>
    assert.ok(brokenRules(good(), ORG, id(9), COURSE).length > 0));
});

describe('settleExpiredAttempts (the frame for UC29.1)', () => {
  const NOW_ = new Date('2026-10-27T10:00:00.000Z');
  const build_ = () => {
    const calls: any[] = [];
    const prisma = {
      quizAttempt: {
        count: (args: unknown) => {
          calls.push(args);
          return Promise.resolve(2);
        },
        updateMany: () => {
          throw new Error('the frame must not write');
        },
      },
    };
    return {
      calls,
      repository: new CompletionSnapshotRepository(prisma as never),
    };
  };

  test('looks only at the attempts of this Learner, in this Organization and Course, never submitted and past the deadline', async () => {
    const { repository, calls } = build_();
    assert.equal(
      await repository.settleExpiredAttempts(ORG, LEARNER, COURSE, NOW_),
      2,
    );
    assert.deepEqual(calls[0], {
      where: {
        organizationId: ORG,
        learnerId: LEARNER,
        assessment: { courseId: COURSE },
        submittedAt: null,
        deadlineAt: { lte: NOW_ },
      },
    });
  });

  test('calling it again gives the same answer and writes nothing', async () => {
    const { repository } = build_();
    const first = await repository.settleExpiredAttempts(
      ORG,
      LEARNER,
      COURSE,
      NOW_,
    );
    const second = await repository.settleExpiredAttempts(
      ORG,
      LEARNER,
      COURSE,
      NOW_,
    );
    assert.equal(first, second);
  });
});
