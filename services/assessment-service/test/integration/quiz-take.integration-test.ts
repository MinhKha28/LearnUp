/**
 * UC29.1 through the real HTTP API and a real Postgres: a Learner starts a Quiz, the choices are saved as they are made,
 * the attempt is submitted and graded, counts for the lock (n attempts in a row, then m hours), and an attempt that ran
 * out of time is submitted by the system. Enrollment is answered by a fake Learning Service. The clock of the server
 * cannot be moved, so time passes by writing the deadline of the attempt into the past. The tests are one story and
 * share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  LEARNER,
  ORG,
  OTHER_ORG,
  startCourseStub,
  startLearningStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';
import { brokenRules } from '../unit/completion-contract';

const LEARNER_2 = '00000000-0000-4000-8000-0000000000c2';
const as = (user: string, org = ORG) =>
  identity({ user, role: 'LEARNER', org });
const HOUR = 3_600_000;

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${(0x5000 + n).toString(16).padStart(12, '0')}`;

/** The Quiz of the tests: 4 questions of 25 points each. */
const QUESTIONS = [
  { id: uuid(1), type: 'SingleChoice', options: ['A', 'B'], correct: [0] },
  {
    id: uuid(2),
    type: 'MultipleChoice',
    options: ['X', 'Y', 'Z'],
    correct: [0, 1],
  },
  { id: uuid(3), type: 'TrueFalse', options: ['True', 'False'], correct: [0] },
  { id: uuid(4), type: 'SingleChoice', options: ['M', 'N'], correct: [1] },
];
const optionId = (q: number, o: number) => uuid(100 + q * 10 + o);

describe('UC29.1 taking a Quiz over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: LearningStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let quizId: string;
  let emptyQuizId: string;
  let attempt1: string;
  let attempt2: string;

  const quizUrl = (id = quizId) => `/learner/quizzes/${id}`;
  const getQuiz = (user = LEARNER, id = quizId) =>
    api('GET', quizUrl(id), undefined, as(user));
  const start = (user = LEARNER, id = quizId) =>
    api('POST', `${quizUrl(id)}/attempts`, undefined, as(user));
  const attemptUrl = (id: string) => `/learner/quizzes/attempts/${id}`;
  const getAttempt = (id: string, user = LEARNER) =>
    api('GET', attemptUrl(id), undefined, as(user));
  const save = (id: string, q: number, options: number[], user = LEARNER) =>
    api(
      'PUT',
      `${attemptUrl(id)}/answers/${QUESTIONS[q].id}`,
      { optionIds: options.map((o) => optionId(q, o)) },
      as(user),
    );
  const submit = (id: string, user = LEARNER) =>
    api('POST', `${attemptUrl(id)}/submit`, undefined, as(user));
  const row = async (sql: string, params: unknown[] = []) =>
    (await db.query(sql, params))[0] as Record<string, any>;
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await row(sql, params)).count);
  const events = async (reason: string, who = LEARNER, id = quizId) =>
    (await db.query(
      `SELECT payload FROM outbox_events
        WHERE event_type = 'LearnerAssessmentStatusChanged' AND payload->>'reason' = $1
          AND payload->>'assessmentId' = $2 AND payload->>'learnerId' = $3
        ORDER BY occurred_at, id`,
      [reason, id, who],
    )) as { payload: Record<string, any> }[];
  const state = (who = LEARNER, id = quizId) =>
    row(
      `SELECT consecutive_count, locked_until, recorded_attempt_id, first_activity_at
         FROM learner_assessment_states WHERE assessment_id = $1 AND learner_id = $2`,
      [id, who],
    );
  const dbAttempt = (id: string) =>
    row(`SELECT * FROM quiz_attempts WHERE id = $1`, [id]);
  /** Lets the time pass: the attempt began and ends `minutes` earlier than it did. */
  const ageAttempt = (id: string, minutes: number) =>
    db.query(
      `UPDATE quiz_attempts SET started_at = started_at - ($2 || ' minutes')::interval,
              deadline_at = deadline_at - ($2 || ' minutes')::interval WHERE id = $1`,
      [id, String(minutes)],
    );
  const snapshot = async (who = LEARNER) => {
    const response = await fetch(
      `${service.baseUrl}/api/v1/internal/learners/${who}/courses/${COURSE}/completion-snapshot`,
      {
        headers: {
          'x-internal-key': 'integration-test-key',
          'x-organization-id': ORG,
        },
      },
    );
    const json = (await response.json()) as { data: any };
    assert.equal(response.status, 200, JSON.stringify(json));
    assert.deepEqual(brokenRules(json.data, ORG, who, COURSE), []);
    return json.data;
  };

  const addQuestions = async (id: string, withQuestions = QUESTIONS) => {
    for (const [q, question] of withQuestions.entries()) {
      await db.query(
        `INSERT INTO quiz_questions (id, organization_id, assessment_id, question_type, content, position, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [question.id, ORG, id, question.type, `Question ${q + 1}?`, q + 1],
      );
      for (const [o, text] of question.options.entries()) {
        await db.query(
          `INSERT INTO quiz_question_options (id, organization_id, question_id, content, is_correct, position, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [
            optionId(q, o),
            ORG,
            question.id,
            text,
            question.correct.includes(o),
            o + 1,
          ],
        );
      }
    }
  };

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    learning = await startLearningStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'http',
      LEARNING_SERVICE_URL: learning.url,
      PEER_REVIEW_TICK_MS: '3600000',
    });
    api = apiFor(service.baseUrl);
    const create = async (title: string) => {
      const r = await api('POST', '/quizzes', {
        courseId: COURSE,
        title,
        timeLimitMinutes: 10,
        passingScore: 70,
        isRequired: true,
        maxConsecutiveAttempts: 2,
        lockoutHours: 1,
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.id as string;
    };
    quizId = await create('Safety quiz');
    emptyQuizId = await create('Empty quiz');
    await addQuestions(quizId);
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await learning?.stop();
    await db?.drop();
  });

  describe('who may take it', () => {
    test('a call without the internal key is refused (401), only a Learner may take a Quiz (403)', async () => {
      assert.equal((await api('GET', quizUrl(), undefined, {})).status, 401);
      for (const role of ['INSTRUCTOR', 'ORGANIZER', 'ADMIN']) {
        const r = await api(
          'POST',
          `${quizUrl()}/attempts`,
          undefined,
          identity({ role }),
        );
        assert.equal(r.status, 403, role);
      }
    });

    test('ids must be UUIDs (400); an unknown Quiz, a Quiz of another Organization and an unknown attempt are 404', async () => {
      assert.equal(
        (await api('GET', '/learner/quizzes/abc', undefined, as(LEARNER)))
          .status,
        400,
      );
      assert.equal((await getQuiz(LEARNER, UNKNOWN)).status, 404);
      assert.equal((await start(LEARNER, UNKNOWN)).status, 404);
      const foreign = await api(
        'GET',
        quizUrl(),
        undefined,
        as(LEARNER, OTHER_ORG),
      );
      assert.equal(foreign.status, 404);
      assert.equal((await getAttempt(UNKNOWN)).status, 404);
    });

    test('a Learner who is not enrolled (403), whose Enrollment is halted or withdrawn (409), gets nothing', async () => {
      learning.setAnswer(LEARNER, COURSE, 'NotFound');
      let r = await getQuiz();
      assert.equal(r.status, 403);
      assert.equal(r.code, 'NOT_ENROLLED');
      learning.setAnswer(LEARNER, COURSE, 'None');
      r = await start();
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ENROLLMENT_NOT_ACTIVE');
      learning.reset();
      assert.equal(await count('SELECT count(*) FROM quiz_attempts'), 0);
    });

    test('a Quiz with no question cannot be started (422)', async () => {
      const r = await start(LEARNER, emptyQuizId);
      assert.equal(r.status, 422);
      assert.equal(r.code, 'QUIZ_HAS_NO_QUESTIONS');
      assert.equal(await count('SELECT count(*) FROM quiz_attempts'), 0);
      assert.equal(
        await count('SELECT count(*) FROM learner_assessment_states'),
        0,
      );
    });
  });

  describe('before the first attempt', () => {
    test('the Quiz shows its rules and that nothing was done', async () => {
      const r = await getQuiz();
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(
        {
          title: r.data.title,
          passingScore: r.data.passingScore,
          timeLimitMinutes: r.data.timeLimitMinutes,
          questionCount: r.data.questionCount,
          isRequired: r.data.isRequired,
          readOnly: r.data.readOnly,
          inProgressAttemptId: r.data.inProgressAttemptId,
          recordedScore: r.data.recordedScore,
          passed: r.data.passed,
          submittedAttemptCount: r.data.submittedAttemptCount,
        },
        {
          title: 'Safety quiz',
          passingScore: 70,
          timeLimitMinutes: 10,
          questionCount: 4,
          isRequired: true,
          readOnly: false,
          inProgressAttemptId: null,
          recordedScore: null,
          passed: null,
          submittedAttemptCount: 0,
        },
      );
      assert.equal(r.data.attempts.remainingAttempts, 2);
      assert.equal(r.data.attempts.lockedUntil, null);
      assert.ok(
        !JSON.stringify(r.json).includes('Question 1'),
        'the questions are not shown before starting',
      );
    });
  });

  describe('starting', () => {
    test('starting opens an attempt with a fixed deadline, the questions in order and no answer key', async () => {
      const before = Date.now();
      const r = await start();
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.data.status, 'InProgress');
      assert.equal(r.data.attemptNumber, 1);
      assert.equal(r.data.resumed, undefined);
      attempt1 = r.data.attemptId;
      const limit =
        new Date(r.data.deadlineAt).getTime() -
        new Date(r.data.startedAt).getTime();
      assert.equal(limit, 10 * 60_000);
      assert.ok(new Date(r.data.startedAt).getTime() >= before - 5000);
      assert.ok(
        r.data.remainingSeconds > 590 && r.data.remainingSeconds <= 600,
      );
      assert.deepEqual(
        r.data.questions.map((q: any) => [
          q.position,
          q.type,
          q.options.length,
          q.selectedOptionIds.length,
        ]),
        [
          [1, 'SingleChoice', 2, 0],
          [2, 'MultipleChoice', 3, 0],
          [3, 'TrueFalse', 2, 0],
          [4, 'SingleChoice', 2, 0],
        ],
      );
      assert.deepEqual(
        r.data.questions[1].options.map((o: any) => o.content),
        ['X', 'Y', 'Z'],
      );
      const text = JSON.stringify(r.json);
      assert.ok(
        !/isCorrect|is_correct|correct/i.test(text),
        'the answer key never reaches the Learner',
      );
    });

    test('the attempt counts at once (BR-201): one try used, the first activity is recorded, QUIZ_STARTED is in the outbox', async () => {
      const s = await state();
      assert.equal(s.consecutive_count, 1);
      assert.equal(s.locked_until, null);
      assert.ok(s.first_activity_at);
      assert.equal((await getQuiz()).data.attempts.remainingAttempts, 1);
      assert.equal((await getQuiz()).data.inProgressAttemptId, attempt1);
      const started = await events('QUIZ_STARTED');
      assert.equal(started.length, 1);
      assert.deepEqual(
        {
          status: started[0].payload.status,
          kind: started[0].payload.kind,
          attemptId: started[0].payload.attemptId,
          organizationId: started[0].payload.organizationId,
        },
        {
          status: 'Started',
          kind: 'QUIZ',
          attemptId: attempt1,
          organizationId: ORG,
        },
      );
      assert.equal(
        started[0].payload.firstActivityAt,
        new Date(s.first_activity_at).toISOString(),
      );
    });

    test('asking again while the attempt runs gives that attempt back: one attempt at a time (BR-201)', async () => {
      const again = await start();
      assert.equal(again.status, 201);
      assert.equal(again.data.attemptId, attempt1);
      assert.equal(again.data.resumed, true);
      const results = await Promise.all([start(), start(), start(), start()]);
      assert.ok(results.every((r) => r.data.attemptId === attempt1));
      assert.equal(await count('SELECT count(*) FROM quiz_attempts'), 1);
      assert.equal((await state()).consecutive_count, 1);
      assert.equal((await events('QUIZ_STARTED')).length, 1);
    });

    test('another Learner starts their own attempt, and cannot read, save or submit the first one', async () => {
      const other = await start(LEARNER_2);
      assert.equal(other.status, 201);
      assert.notEqual(other.data.attemptId, attempt1);
      assert.equal(other.data.attemptNumber, 1);
      assert.equal((await getAttempt(attempt1, LEARNER_2)).status, 404);
      assert.equal((await save(attempt1, 0, [0], LEARNER_2)).status, 404);
      assert.equal((await submit(attempt1, LEARNER_2)).status, 404);
      assert.equal((await getAttempt(attempt1, LEARNER)).status, 200);
      // the other Learner's attempt is thrown away so the numbers below stay simple
      await db.query('DELETE FROM quiz_attempts WHERE id = $1', [
        other.data.attemptId,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER_2],
      );
      await db.query(
        `DELETE FROM outbox_events WHERE payload->>'learnerId' = $1`,
        [LEARNER_2],
      );
    });
  });

  describe('saving the choices', () => {
    test('each choice is saved at once and comes back when the attempt is read again', async () => {
      let r = await save(attempt1, 0, [0]);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(r.data.selectedOptionIds, [optionId(0, 0)]);
      assert.ok(r.data.remainingSeconds > 0);
      assert.equal((await save(attempt1, 1, [0, 1])).status, 200);
      assert.equal((await save(attempt1, 2, [1])).status, 200);
      r = await getAttempt(attempt1);
      assert.equal(r.status, 200);
      assert.deepEqual(
        r.data.questions.map((q: any) => q.selectedOptionIds.sort()),
        [
          [optionId(0, 0)],
          [optionId(1, 0), optionId(1, 1)].sort(),
          [optionId(2, 1)],
          [],
        ],
      );
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempt_answers WHERE attempt_id = $1',
          [attempt1],
        ),
        4,
      );
    });

    test('a new choice replaces the old one, and an empty list clears the answer', async () => {
      await save(attempt1, 0, [1]);
      assert.deepEqual(
        (await getAttempt(attempt1)).data.questions[0].selectedOptionIds,
        [optionId(0, 1)],
      );
      await save(attempt1, 1, [2]);
      assert.deepEqual(
        (await getAttempt(attempt1)).data.questions[1].selectedOptionIds,
        [optionId(1, 2)],
      );
      assert.equal((await save(attempt1, 1, [])).status, 200);
      assert.deepEqual(
        (await getAttempt(attempt1)).data.questions[1].selectedOptionIds,
        [],
      );
      // back to the answers the story needs: q1 right, q2 right, q3 wrong, q4 blank = 50
      await save(attempt1, 0, [0]);
      await save(attempt1, 1, [0, 1]);
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempt_answers WHERE attempt_id = $1',
          [attempt1],
        ),
        4,
      );
    });

    test('saving the same answer twice or at the same moment leaves one set of rows', async () => {
      await Promise.all([
        save(attempt1, 0, [0]),
        save(attempt1, 0, [0]),
        save(attempt1, 0, [0]),
      ]);
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempt_answers WHERE attempt_id = $1 AND question_id = $2',
          [attempt1, QUESTIONS[0].id],
        ),
        1,
      );
    });

    test('a wrong choice is refused and changes nothing: another question’s option, two options for a single-choice, an unknown question, a bad body', async () => {
      const before = await count(
        'SELECT count(*) FROM quiz_attempt_answers WHERE attempt_id = $1',
        [attempt1],
      );
      let r = await api(
        'PUT',
        `${attemptUrl(attempt1)}/answers/${QUESTIONS[0].id}`,
        { optionIds: [optionId(1, 0)] },
        as(LEARNER),
      );
      assert.equal(r.status, 422);
      assert.equal(r.code, 'OPTION_NOT_IN_QUESTION');
      r = await save(attempt1, 0, [0, 1]);
      assert.equal(r.status, 422);
      assert.equal(r.code, 'TOO_MANY_OPTIONS');
      r = await save(attempt1, 2, [0, 1]);
      assert.equal(
        r.code,
        'TOO_MANY_OPTIONS',
        'true/false takes one answer too',
      );
      r = await api(
        'PUT',
        `${attemptUrl(attempt1)}/answers/${UNKNOWN}`,
        { optionIds: [] },
        as(LEARNER),
      );
      assert.equal(r.status, 404);
      assert.equal(r.code, 'QUESTION_NOT_FOUND');
      for (const body of [
        {},
        { optionIds: 'a' },
        { optionIds: ['not-a-uuid'] },
        { optionIds: [optionId(0, 0), optionId(0, 0)] },
      ]) {
        r = await api(
          'PUT',
          `${attemptUrl(attempt1)}/answers/${QUESTIONS[0].id}`,
          body,
          as(LEARNER),
        );
        assert.equal(r.status, 400, JSON.stringify(body));
      }
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempt_answers WHERE attempt_id = $1',
          [attempt1],
        ),
        before,
      );
    });
  });

  describe('submitting', () => {
    test('submitting grades at once: 2 of 4 right is 50 and not passed', async () => {
      const r = await submit(attempt1);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(
        {
          status: r.data.status,
          score: r.data.score,
          passed: r.data.passed,
          correct: r.data.correctCount,
          total: r.data.totalQuestions,
          kind: r.data.submissionKind,
          number: r.data.attemptNumber,
          recorded: r.data.recordedScore,
          recordedPassed: r.data.recordedPassed,
          again: r.data.alreadySubmitted,
        },
        {
          status: 'Submitted',
          score: 50,
          passed: false,
          correct: 2,
          total: 4,
          kind: 'Manual',
          number: 1,
          recorded: 50,
          recordedPassed: false,
          again: undefined,
        },
      );
      assert.equal(r.data.attempts.remainingAttempts, 1);
      const a = await dbAttempt(attempt1);
      assert.equal(Number(a.score), 50);
      assert.equal(a.submission_kind, 'Manual');
      assert.ok(a.submitted_at);
      assert.ok(!JSON.stringify(r.json).includes('isCorrect'));
    });

    test('it is told to Learning Service in the same transaction: QUIZ_SUBMITTED with the score and the kind', async () => {
      const sent = await events('QUIZ_SUBMITTED');
      assert.equal(sent.length, 1);
      assert.deepEqual(
        {
          status: sent[0].payload.status,
          kind: sent[0].payload.kind,
          attemptId: sent[0].payload.attemptId,
          score: sent[0].payload.score,
          submissionKind: sent[0].payload.submissionKind,
          lockedUntil: sent[0].payload.lockedUntil,
        },
        {
          status: 'Submitted',
          kind: 'QUIZ',
          attemptId: attempt1,
          score: 50,
          submissionKind: 'Manual',
          lockedUntil: null,
        },
      );
      assert.match(sent[0].payload.revision, /\S/);
      const s = await state();
      assert.equal(s.consecutive_count, 1);
      assert.equal(s.locked_until, null);
      assert.equal(s.recorded_attempt_id, attempt1);
    });

    test('submitting again, even at the same moment, gives the same result and counts nothing twice', async () => {
      const results = await Promise.all([
        submit(attempt1),
        submit(attempt1),
        submit(attempt1),
      ]);
      for (const r of results) {
        assert.equal(r.status, 200);
        assert.equal(r.data.score, 50);
        assert.equal(r.data.alreadySubmitted, true);
      }
      assert.equal((await events('QUIZ_SUBMITTED')).length, 1);
      assert.equal((await state()).consecutive_count, 1);
    });

    test('a submitted attempt is a result when read, and takes no more choices (409)', async () => {
      const r = await getAttempt(attempt1);
      assert.equal(r.data.status, 'Submitted');
      assert.equal(r.data.score, 50);
      assert.equal(
        r.data.questions,
        undefined,
        'the questions are not sent again with the result',
      );
      const refused = await save(attempt1, 0, [1]);
      assert.equal(refused.status, 409);
      assert.equal(refused.code, 'ATTEMPT_SUBMITTED');
      assert.equal(Number((await dbAttempt(attempt1)).score), 50);
    });

    test('the Course list (UC29) shows it: Completed, the score, 50 does not pass', async () => {
      const list = await api(
        'GET',
        `/learner/courses/${COURSE}/assessments`,
        undefined,
        as(LEARNER),
      );
      const quiz = list.data.items.find((i: any) => i.id === quizId);
      assert.equal(quiz.status, 'Completed');
      assert.equal(quiz.recordedScore, 50);
      assert.equal(quiz.passed, false);
      assert.equal(quiz.attempts.remainingAttempts, 1);
    });
  });

  describe('trying again, the best attempt and the lock (BR-198, BR-218)', () => {
    test('a second attempt is attempt 2; with every answer right it scores 100 and becomes the recorded one', async () => {
      const r = await start();
      assert.equal(r.status, 201);
      assert.equal(r.data.attemptNumber, 2);
      attempt2 = r.data.attemptId;
      assert.equal((await state()).consecutive_count, 2);
      await save(attempt2, 0, [0]);
      await save(attempt2, 1, [1, 0]);
      await save(attempt2, 2, [0]);
      await save(attempt2, 3, [1]);
      const done = await submit(attempt2);
      assert.equal(done.data.score, 100);
      assert.equal(done.data.passed, true);
      assert.equal(done.data.recordedScore, 100);
      assert.equal((await state()).recorded_attempt_id, attempt2);
    });

    test('the n-th attempt starts the lock for m hours from its submission, and the screen says when it opens again', async () => {
      const s = await state();
      const lockedUntil = new Date(s.locked_until).getTime();
      const submittedAt = new Date(
        (await dbAttempt(attempt2)).submitted_at,
      ).getTime();
      assert.equal(lockedUntil - submittedAt, HOUR);
      const q = await getQuiz();
      assert.equal(q.data.attempts.remainingAttempts, 0);
      assert.equal(
        q.data.attempts.lockedUntil,
        new Date(lockedUntil).toISOString(),
      );
      assert.equal(q.data.recordedScore, 100);
      assert.equal(q.data.passed, true);
      const sent = await events('QUIZ_SUBMITTED');
      assert.equal(
        sent[1].payload.lockedUntil,
        new Date(lockedUntil).toISOString(),
      );
    });

    test('while locked no attempt can be started (409) and nothing is counted; it is only for this Learner (BR-220)', async () => {
      const r = await start();
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ASSESSMENT_LOCKED');
      assert.ok(
        r.json.error.lockedUntil ??
          r.json.lockedUntil ??
          JSON.stringify(r.json).includes('lockedUntil'),
      );
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempts WHERE learner_id = $1',
          [LEARNER],
        ),
        2,
      );
      assert.equal((await state()).consecutive_count, 2);
      const other = await start(LEARNER_2);
      assert.equal(other.status, 201, 'another Learner is not locked');
      await db.query('DELETE FROM quiz_attempts WHERE id = $1', [
        other.data.attemptId,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER_2],
      );
      await db.query(
        `DELETE FROM outbox_events WHERE payload->>'learnerId' = $1`,
        [LEARNER_2],
      );
    });

    test('after m hours the Quiz opens again and counting starts from zero; a lower score does not lower the recorded one', async () => {
      await db.query(
        `UPDATE learner_assessment_states SET locked_until = now() - interval '1 minute' WHERE learner_id = $1 AND assessment_id = $2`,
        [LEARNER, quizId],
      );
      assert.equal((await getQuiz()).data.attempts.remainingAttempts, 2);
      const r = await start();
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.data.attemptNumber, 3);
      const s = await state();
      assert.equal(s.consecutive_count, 1);
      assert.equal(s.locked_until, null);
      await save(r.data.attemptId, 0, [0]);
      const done = await submit(r.data.attemptId);
      assert.equal(done.data.score, 25);
      assert.equal(done.data.recordedScore, 100);
      assert.equal((await state()).recorded_attempt_id, attempt2);
      assert.equal((await getQuiz()).data.recordedScore, 100);
    });

    test('on a tie the earlier attempt stays the recorded one', async () => {
      const r = await start();
      assert.equal(r.status, 201);
      for (const [q, o] of [
        [0, [0]],
        [1, [0, 1]],
        [2, [0]],
        [3, [1]],
      ] as [number, number[]][]) {
        await save(r.data.attemptId, q, o);
      }
      const done = await submit(r.data.attemptId);
      assert.equal(done.data.score, 100);
      assert.equal((await state()).recorded_attempt_id, attempt2);
      // that was the 2nd attempt in a row since the lock opened: locked again
      assert.ok((await state()).locked_until);
    });
  });

  describe('time (BR-200)', () => {
    const open = async (user = LEARNER, id = quizId) => {
      await db.query(
        `UPDATE learner_assessment_states SET locked_until = NULL, consecutive_count = 0 WHERE learner_id = $1 AND assessment_id = $2`,
        [user, id],
      );
      const r = await start(user, id);
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.attemptId as string;
    };

    test('an attempt past its deadline is submitted when read: what was saved is graded, at the deadline, as TimedOut', async () => {
      const id = await open();
      await save(id, 0, [0]);
      await save(id, 3, [1]);
      await ageAttempt(id, 11);
      const before = await dbAttempt(id);
      assert.equal(before.submitted_at, null);
      const r = await getAttempt(id);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(
        {
          status: r.data.status,
          score: r.data.score,
          kind: r.data.submissionKind,
          correct: r.data.correctCount,
        },
        { status: 'Submitted', score: 50, kind: 'TimedOut', correct: 2 },
      );
      const after = await dbAttempt(id);
      assert.equal(
        new Date(after.submitted_at).getTime(),
        new Date(after.deadline_at).getTime(),
      );
      assert.equal(Number(after.score), 50);
    });

    test('it counts for the lock like any other, and QUIZ_SUBMITTED is sent once however many times it is read', async () => {
      const id = (
        await row(
          `SELECT id FROM quiz_attempts WHERE learner_id = $1 ORDER BY attempt_number DESC LIMIT 1`,
          [LEARNER],
        )
      ).id;
      const sent = async () =>
        (await events('QUIZ_SUBMITTED')).filter(
          (e) => e.payload.attemptId === id,
        );
      assert.equal((await sent()).length, 1);
      await Promise.all([getAttempt(id), getAttempt(id), getQuiz()]);
      assert.equal((await sent()).length, 1);
      assert.equal((await sent())[0].payload.submissionKind, 'TimedOut');
      assert.equal((await state()).consecutive_count, 1);
    });

    test('the n-th attempt that times out locks the Quiz from its deadline, not from the moment it was noticed', async () => {
      const first = (
        await row(
          `SELECT id FROM quiz_attempts WHERE learner_id = $1 ORDER BY attempt_number DESC LIMIT 1`,
          [LEARNER],
        )
      ).id;
      const second = (await start()).data.attemptId;
      assert.notEqual(second, first);
      assert.equal((await state()).consecutive_count, 2);
      await ageAttempt(second, 11);
      await getQuiz(); // reading the Quiz is enough to settle it
      const a = await dbAttempt(second);
      assert.ok(a.submitted_at);
      const lockedUntil = new Date((await state()).locked_until).getTime();
      assert.equal(lockedUntil - new Date(a.deadline_at).getTime(), HOUR);
      assert.equal((await start()).code, 'ASSESSMENT_LOCKED');
    });

    test('a choice after the deadline is refused (409) and the attempt is submitted with what was saved', async () => {
      const id = await open();
      await save(id, 1, [0, 1]);
      await ageAttempt(id, 11);
      const r = await save(id, 0, [0]);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ATTEMPT_EXPIRED');
      const a = await dbAttempt(id);
      assert.ok(a.submitted_at, 'the refusal also settled the attempt');
      assert.equal(a.submission_kind, 'TimedOut');
      assert.equal(Number(a.score), 25, 'the late choice did not count');
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempt_answers WHERE attempt_id = $1',
          [id],
        ),
        2,
      );
    });

    test('pressing submit after the deadline gives a TimedOut result at the deadline, not a Manual one', async () => {
      const id = await open();
      await save(id, 0, [0]);
      await ageAttempt(id, 12);
      const r = await submit(id);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.submissionKind, 'TimedOut');
      assert.equal(r.data.score, 25);
      assert.equal(
        new Date(r.data.submittedAt).getTime(),
        new Date((await dbAttempt(id)).deadline_at).getTime(),
      );
    });

    test('starting settles an expired attempt first: it does not stay open next to the new one, and when it was the n-th the Quiz is locked', async () => {
      // not the n-th: the old attempt is submitted at its deadline, the new one is attempt 2 and counts
      await db.query('DELETE FROM quiz_attempts WHERE learner_id = $1', [
        LEARNER,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      const old = await open();
      await save(old, 0, [0]);
      await ageAttempt(old, 11);
      const fresh = await start();
      assert.equal(fresh.status, 201, JSON.stringify(fresh.json));
      assert.equal(fresh.data.attemptNumber, 2);
      assert.equal(fresh.data.resumed, undefined);
      const settled = await dbAttempt(old);
      assert.equal(settled.submission_kind, 'TimedOut');
      assert.equal(Number(settled.score), 25);
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempts WHERE learner_id = $1 AND submitted_at IS NULL',
          [LEARNER],
        ),
        1,
      );
      assert.equal((await state()).consecutive_count, 2);

      // the n-th: it locks from its deadline, and no new attempt is opened
      await ageAttempt(fresh.data.attemptId, 11);
      const refused = await start();
      assert.equal(refused.status, 409);
      assert.equal(refused.code, 'ASSESSMENT_LOCKED');
      const last = await dbAttempt(fresh.data.attemptId);
      assert.equal(last.submission_kind, 'TimedOut');
      assert.equal(
        new Date((await state()).locked_until).getTime() -
          new Date(last.deadline_at).getTime(),
        HOUR,
      );
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempts WHERE learner_id = $1',
          [LEARNER],
        ),
        2,
      );
    });

    test('an expired attempt is settled before the Course list and the completion snapshot read the scores', async () => {
      await db.query('DELETE FROM quiz_attempts WHERE learner_id = $1', [
        LEARNER,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      const id = await open();
      for (const [q, o] of [
        [0, [0]],
        [1, [0, 1]],
        [2, [0]],
        [3, [1]],
      ] as [number, number[]][]) {
        await save(id, q, o);
      }
      await ageAttempt(id, 30);
      assert.equal((await dbAttempt(id)).submitted_at, null);
      const snap = await snapshot();
      assert.equal((await dbAttempt(id)).submission_kind, 'TimedOut');
      const q = snap.quizzes.find((x: any) => x.assessmentId === quizId);
      assert.equal(Number(q.recordedScore), 100);
      assert.equal(q.passed, true);
      assert.equal(q.attemptId, id);

      await db.query('DELETE FROM quiz_attempts WHERE learner_id = $1', [
        LEARNER,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      const id2 = await open();
      await save(id2, 0, [0]);
      await ageAttempt(id2, 30);
      const list = await api(
        'GET',
        `/learner/courses/${COURSE}/assessments`,
        undefined,
        as(LEARNER),
      );
      const item = list.data.items.find((i: any) => i.id === quizId);
      assert.equal(item.status, 'Completed');
      assert.equal(item.recordedScore, 25);
      assert.equal((await dbAttempt(id2)).submission_kind, 'TimedOut');
    });

    test('an attempt of the list is InProgress while it runs', async () => {
      await db.query('DELETE FROM quiz_attempts WHERE learner_id = $1', [
        LEARNER,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      await open();
      const list = await api(
        'GET',
        `/learner/courses/${COURSE}/assessments`,
        undefined,
        as(LEARNER),
      );
      assert.equal(
        list.data.items.find((i: any) => i.id === quizId).status,
        'InProgress',
      );
    });
  });

  describe('when the Enrollment changes (BR-210, BR-211)', () => {
    test('Completed: the attempt that was running is finished and graded, a new one cannot be started (409)', async () => {
      await db.query('DELETE FROM quiz_attempts WHERE learner_id = $1', [
        LEARNER,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      const running = (await start()).data.attemptId;
      await save(running, 0, [0]);
      learning.setAnswer(LEARNER, COURSE, 'ReadOnly');
      const quiz = await getQuiz();
      assert.equal(quiz.data.readOnly, true);
      assert.equal(quiz.data.inProgressAttemptId, running);
      assert.equal(
        (await start()).data.attemptId,
        running,
        'the running attempt may be continued',
      );
      assert.equal((await save(running, 1, [0, 1])).status, 200);
      const done = await submit(running);
      assert.equal(done.status, 200);
      assert.equal(done.data.score, 50);
      const fresh = await start();
      assert.equal(fresh.status, 409);
      assert.equal(fresh.code, 'ENROLLMENT_COMPLETED');
      assert.equal(
        await count(
          'SELECT count(*) FROM quiz_attempts WHERE learner_id = $1',
          [LEARNER],
        ),
        1,
      );
      learning.reset();
    });

    test('Halted or Withdrawn closes the attempt screens too (409)', async () => {
      const running = (await start()).data.attemptId;
      learning.setAnswer(LEARNER, COURSE, 'None');
      for (const r of [
        await getAttempt(running),
        await save(running, 0, [0]),
        await submit(running),
      ]) {
        assert.equal(r.status, 409);
        assert.equal(r.code, 'ENROLLMENT_NOT_ACTIVE');
      }
      learning.reset();
      assert.equal((await dbAttempt(running)).submitted_at, null);
    });

    test('a disabled Quiz cannot be started (409)', async () => {
      await db.query(
        `UPDATE quiz_attempts SET submitted_at = now(), submission_kind = 'Manual', score = 0 WHERE learner_id = $1 AND submitted_at IS NULL`,
        [LEARNER],
      );
      await db.query(
        `UPDATE learner_assessment_states SET locked_until = NULL, consecutive_count = 0 WHERE learner_id = $1`,
        [LEARNER],
      );
      await db.query(
        `UPDATE assessments SET disabled_at = now() WHERE id = $1`,
        [quizId],
      );
      const r = await start();
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ASSESSMENT_DISABLED');
      await db.query(
        `UPDATE assessments SET disabled_at = NULL WHERE id = $1`,
        [quizId],
      );
    });
  });

  describe('UC29.2 the history of a Quiz', () => {
    const LEARNER_3 = '00000000-0000-4000-8000-0000000000c3';
    const history = (user = LEARNER_2, id = quizId) =>
      api('GET', `${quizUrl(id)}/history`, undefined, as(user));
    const answerAll = async (id: string, right: boolean, user = LEARNER_2) => {
      const choices = right
        ? ([
            [0, [0]],
            [1, [0, 1]],
            [2, [0]],
            [3, [1]],
          ] as [number, number[]][])
        : ([
            [0, [0]],
            [1, [0, 1]],
            [2, [1]],
          ] as [number, number[]][]);
      for (const [q, o] of choices) await save(id, q, o, user);
    };

    test('who may read it: a Learner of the Course only; ids are checked', async () => {
      assert.equal(
        (await api('GET', `${quizUrl()}/history`, undefined, {})).status,
        401,
      );
      assert.equal(
        (
          await api(
            'GET',
            `${quizUrl()}/history`,
            undefined,
            identity({ role: 'INSTRUCTOR' }),
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await api(
            'GET',
            '/learner/quizzes/abc/history',
            undefined,
            as(LEARNER_2),
          )
        ).status,
        400,
      );
      assert.equal((await history(LEARNER_2, UNKNOWN)).status, 404);
      assert.equal(
        (
          await api(
            'GET',
            `${quizUrl()}/history`,
            undefined,
            as(LEARNER_2, OTHER_ORG),
          )
        ).status,
        404,
      );
      learning.setAnswer(LEARNER_2, COURSE, 'NotFound');
      assert.equal((await history()).status, 403);
      learning.setAnswer(LEARNER_2, COURSE, 'None');
      assert.equal((await history()).code, 'ENROLLMENT_NOT_ACTIVE');
      learning.reset();
    });

    test('before any attempt: nothing to list, all tries left, no recorded score', async () => {
      const r = await history();
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(r.data.items, []);
      assert.equal(r.data.recordedScore, null);
      assert.equal(r.data.passed, null);
      assert.equal(r.data.attempts.remainingAttempts, 2);
      assert.equal(r.data.attempts.lockedUntil, null);
      assert.equal(r.data.title, 'Safety quiz');
      assert.equal(r.data.passingScore, 70);
    });

    test('a submitted attempt shows its score and how it was submitted; the running one has no score; newest first', async () => {
      const first = (await start(LEARNER_2)).data.attemptId as string;
      await answerAll(first, false);
      await submit(first, LEARNER_2);
      const second = (await start(LEARNER_2)).data.attemptId as string;
      await save(second, 0, [0], LEARNER_2);
      const r = await history();
      assert.deepEqual(
        r.data.items.map((i: any) => [
          i.attemptNumber,
          i.status,
          i.score,
          i.passed,
          i.correctCount,
          i.submissionKind,
          i.isRecorded,
        ]),
        [
          [2, 'InProgress', null, null, null, null, false],
          [1, 'Submitted', 50, false, 2, 'Manual', true],
        ],
      );
      assert.equal(r.data.items[1].totalQuestions, 4);
      assert.ok(r.data.items[1].submittedAt && r.data.items[1].startedAt);
      assert.equal(r.data.recordedScore, 50);
      assert.equal(r.data.passed, false);
      assert.equal(
        r.data.attempts.remainingAttempts,
        0,
        'both tries are used: the running one counts',
      );
      assert.ok(
        !/isCorrect|is_correct/i.test(JSON.stringify(r.json)),
        'no answer key',
      );
    });

    test('the best attempt is marked, and the lock with the time it opens again is shown after the n-th', async () => {
      const running = (await getQuiz(LEARNER_2)).data
        .inProgressAttemptId as string;
      await answerAll(running, true);
      await submit(running, LEARNER_2);
      const r = await history();
      assert.deepEqual(
        r.data.items.map((i: any) => [i.attemptNumber, i.score, i.isRecorded]),
        [
          [2, 100, true],
          [1, 50, false],
        ],
      );
      assert.equal(r.data.recordedScore, 100);
      assert.equal(r.data.attempts.remainingAttempts, 0);
      const lockedUntil = new Date(
        (await state(LEARNER_2)).locked_until,
      ).toISOString();
      assert.equal(r.data.attempts.lockedUntil, lockedUntil);
    });

    test('a tie is marked on the earlier attempt', async () => {
      await db.query(
        'UPDATE quiz_attempts SET score = 100 WHERE learner_id = $1 AND attempt_number = 1',
        [LEARNER_2],
      );
      const r = await history();
      assert.deepEqual(
        r.data.items.map((i: any) => [i.attemptNumber, i.isRecorded]),
        [
          [2, false],
          [1, true],
        ],
      );
      assert.equal(r.data.items.filter((i: any) => i.isRecorded).length, 1);
    });

    test('an attempt that ran out of time is in the history with its score, as TimedOut', async () => {
      await db.query(
        'UPDATE learner_assessment_states SET locked_until = NULL, consecutive_count = 0 WHERE learner_id = $1 AND assessment_id = $2',
        [LEARNER_2, quizId],
      );
      const third = (await start(LEARNER_2)).data.attemptId as string;
      await save(third, 0, [0], LEARNER_2);
      await ageAttempt(third, 11);
      const r = await history();
      const item = r.data.items[0];
      assert.deepEqual(
        [
          item.attemptNumber,
          item.status,
          item.submissionKind,
          item.score,
          item.correctCount,
        ],
        [3, 'Submitted', 'TimedOut', 25, 1],
      );
      assert.equal(r.data.items.length, 3);
    });

    test('it is the Learner’s own: another Learner has an empty history, and a Completed Course still shows it (read only)', async () => {
      const other = await history(LEARNER_3);
      assert.equal(other.status, 200);
      assert.deepEqual(other.data.items, []);
      learning.setAnswer(LEARNER_2, COURSE, 'ReadOnly');
      const r = await history();
      assert.equal(r.status, 200);
      assert.equal(r.data.readOnly, true);
      assert.equal(r.data.items.length, 3);
      learning.reset();
    });
  });

  describe('the job', () => {
    test('submits the attempts that ran out of time without anybody reading them, and a second run finds nothing', async () => {
      await db.query('DELETE FROM quiz_attempts WHERE learner_id = $1', [
        LEARNER,
      ]);
      await db.query(
        'DELETE FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      const id = (await start()).data.attemptId;
      await save(id, 0, [0]);
      await ageAttempt(id, 20);
      const job = await startService(db.url, {
        COURSE_SERVICE_URL: course.url,
        ENROLLMENT_CLIENT_MODE: 'http',
        LEARNING_SERVICE_URL: learning.url,
        PEER_REVIEW_TICK_MS: '3600000',
        QUIZ_SETTLE_TICK_MS: '300',
      });
      try {
        for (
          let i = 0;
          i < 50 && (await dbAttempt(id)).submitted_at === null;
          i += 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const a = await dbAttempt(id);
        assert.ok(a.submitted_at, 'the job submitted it');
        assert.equal(a.submission_kind, 'TimedOut');
        assert.equal(Number(a.score), 25);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const sent = (await events('QUIZ_SUBMITTED')).filter(
          (e) => e.payload.attemptId === id,
        );
        assert.equal(sent.length, 1, 'many runs, one event');
      } finally {
        await job.stop();
      }
    });
  });

  describe('the data stays in order', () => {
    test('after all of this: no attempt has two answers rows for one option, no state counts above n, and every submitted attempt has a score and a kind', async () => {
      assert.equal(
        await count(
          `SELECT count(*) FROM (SELECT attempt_id, question_id, option_id FROM quiz_attempt_answers GROUP BY 1, 2, 3 HAVING count(*) > 1) d`,
        ),
        0,
      );
      assert.equal(
        await count(
          `SELECT count(*) FROM learner_assessment_states WHERE consecutive_count > 2`,
        ),
        0,
      );
      assert.equal(
        await count(
          `SELECT count(*) FROM quiz_attempts WHERE submitted_at IS NOT NULL AND (score IS NULL OR submission_kind IS NULL)`,
        ),
        0,
      );
      assert.equal(
        await count(
          `SELECT count(*) FROM quiz_attempts WHERE submitted_at IS NULL AND submission_kind IS NOT NULL`,
        ),
        0,
      );
    });
  });
});
