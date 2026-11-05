/**
 * UC28.1 through the real HTTP API and a real Postgres: the internal endpoint learning-service calls to show a Learner
 * the scores of the Quizzes and Assignments done in a Course, against the passing score. The attempts and submissions
 * are written straight into the database in the state the grading would have left them. The tests are one story and
 * share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
// the validator learning-service applies to the answer: the contract is checked against the real response
import { validateAssessmentResults } from '../../../learning-service/src/infrastructure/clients/assessment/assessment-results.client';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  KEY,
  LEARNER,
  ORG,
  OTHER_ORG,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const LEARNER_2 = '00000000-0000-4000-8000-0000000000c2';
const OTHER_COURSE = '00000000-0000-4000-8000-0000000000d4';
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${(0x7000 + n).toString(16).padStart(12, '0')}`;

describe('UC28.1 the results of a Learner in a Course over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let quiz1: string;
  let quiz2: string;
  let quizOptional: string;
  let asg1: string;
  let asg2: string;
  let asgPending: string;

  const url = (learner = LEARNER, courseId = COURSE) =>
    `${service.baseUrl}/api/v1/internal/learners/${learner}/courses/${courseId}/assessment-results`;
  const asLearner = (user = LEARNER, org = ORG) =>
    identity({ user, role: 'LEARNER', org });
  const results = async (
    learner = LEARNER,
    courseId = COURSE,
    headers: Record<string, string> = asLearner(learner),
  ) => {
    const response = await fetch(url(learner, courseId), { headers });
    const json = (await response.json().catch(() => ({}))) as Record<
      string,
      any
    >;
    return { status: response.status, json, data: json.data };
  };
  const find = (data: any, id: string) =>
    (data.items as any[]).find((i) => i.assessmentId === id);

  const attempt = (
    assessmentId: string,
    learner: string,
    number: number,
    score: number | null,
    kind: string | null = score === null ? null : 'Manual',
    minutesAgo = 60,
  ) =>
    db.query(
      `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at,
              submitted_at, submission_kind, score, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now() - ($5 || ' minutes')::interval,
               now() - ($5 || ' minutes')::interval + interval '10 minutes',
               ${score === null ? 'NULL' : "now() - ($5 || ' minutes')::interval + interval '5 minutes'"}, $6, $7, now(), now())
       RETURNING id`,
      [ORG, assessmentId, learner, number, String(minutesAgo), kind, score],
    );
  const submission = (
    assessmentId: string,
    learner: string,
    number: number,
    status: string,
    finalScore: number | null,
    superseded = false,
    minutesAgo = 30,
  ) =>
    db.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content, submitted_at,
              grading_status, final_score, superseded_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'work', now() - ($5 || ' minutes')::interval, $6, $7,
               ${superseded ? 'now()' : 'NULL'}, now(), now())`,
      [
        ORG,
        assessmentId,
        learner,
        number,
        String(minutesAgo),
        status,
        finalScore,
      ],
    );

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      PEER_REVIEW_TICK_MS: '3600000',
    });
    api = apiFor(service.baseUrl);
    const makeQuiz = async (title: string, isRequired: boolean) => {
      const r = await api('POST', '/quizzes', {
        courseId: COURSE,
        title,
        timeLimitMinutes: 10,
        passingScore: 70,
        isRequired,
        maxConsecutiveAttempts: 3,
        lockoutHours: 1,
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.id as string;
    };
    const makeAssignment = async (title: string, passingScore: number) => {
      const r = await api('POST', '/assignments', {
        courseId: COURSE,
        title,
        prompt: 'Write it',
        passingScore,
        expectedDurationMinutes: 30,
        rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.id as string;
    };
    quiz1 = await makeQuiz('Quiz an toàn', true);
    quiz2 = await makeQuiz('Quiz hết giờ', true);
    quizOptional = await makeQuiz('Quiz tự kiểm tra', false);
    asg1 = await makeAssignment('Bài luận', 60);
    asg2 = await makeAssignment('Bài thực hành', 60);
    asgPending = await makeAssignment('Bài chưa nộp', 60);
    // quiz2 has one question with a right option, so an attempt that ran out of time has something to be graded on
    await db.query(
      `INSERT INTO quiz_questions (id, organization_id, assessment_id, question_type, content, position, updated_at)
       VALUES ($1, $2, $3, 'SingleChoice', 'Q?', 1, now())`,
      [uuid(1), ORG, quiz2],
    );
    for (const [i, id] of [uuid(2), uuid(3)].entries()) {
      await db.query(
        `INSERT INTO quiz_question_options (id, organization_id, question_id, content, is_correct, position, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [id, ORG, uuid(1), `Option ${i}`, i === 0, i + 1],
      );
    }
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  describe('who may ask', () => {
    test('a call without the internal key is refused (401); a caller who speaks for another Learner is refused (403)', async () => {
      assert.equal((await results(LEARNER, COURSE, {})).status, 401);
      assert.equal(
        (
          await results(LEARNER, COURSE, {
            ...asLearner(LEARNER),
            'x-internal-key': 'wrong',
          })
        ).status,
        401,
      );
      const other = await results(LEARNER, COURSE, asLearner(LEARNER_2));
      assert.equal(other.status, 403);
      assert.equal(other.json.error?.code, 'FORBIDDEN');
    });

    test('a call without an Organization is refused, and ids must be UUIDs (400)', async () => {
      const noOrg = await fetch(url(), {
        headers: {
          'x-internal-key': KEY,
          'x-user-id': LEARNER,
          'x-user-role': 'LEARNER',
        },
      });
      assert.ok([401, 403].includes(noOrg.status), String(noOrg.status));
      assert.equal((await results('abc')).status, 400);
      assert.equal((await results(LEARNER, 'abc', asLearner())).status, 400);
    });
  });

  describe('what is there', () => {
    test('a Learner who did nothing has an empty list, not an error', async () => {
      const r = await results();
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.courseId, COURSE);
      assert.deepEqual(r.data.items, []);
    });

    test('a Quiz with several attempts shows the best one, its number, every attempt, and the pass against the passing score', async () => {
      await attempt(quiz1, LEARNER, 1, 50, 'Manual', 120);
      await attempt(quiz1, LEARNER, 2, 85, 'Manual', 100);
      await attempt(quiz1, LEARNER, 3, 60, 'TimedOut', 80);
      const r = await results();
      const item = find(r.data, quiz1);
      assert.ok(item);
      assert.equal(item.kind, 'QUIZ');
      assert.equal(item.title, 'Quiz an toàn');
      assert.equal(item.status, 'Completed');
      assert.equal(item.recordedScore, 85);
      assert.equal(item.passed, true);
      assert.equal(item.passingScore, 70);
      assert.equal(item.isRequired, true);
      assert.equal(item.disabled, false);
      assert.equal(item.attemptCount, 3);
      assert.equal(item.quiz.bestAttemptNumber, 2);
      assert.deepEqual(
        item.quiz.attempts.map((a: any) => [
          a.attemptNumber,
          a.score,
          a.submissionKind,
        ]),
        [
          [1, 50, 'Manual'],
          [2, 85, 'Manual'],
          [3, 60, 'TimedOut'],
        ],
      );
      assert.equal(item.assignment, null);
    });

    test('a Quiz and an Assignment nobody touched are not listed', async () => {
      const r = await results();
      for (const id of [quizOptional, asgPending, asg1, asg2])
        assert.equal(find(r.data, id), undefined, id);
    });

    test('an attempt that is running makes the Quiz InProgress, with no score of its own', async () => {
      await attempt(quizOptional, LEARNER, 1, null, null, 2);
      const item = find((await results()).data, quizOptional);
      assert.equal(item.status, 'InProgress');
      assert.equal(item.recordedScore, null);
      assert.equal(item.passed, null);
      assert.equal(item.attemptCount, 0);
      assert.equal(item.isRequired, false);
    });

    test('an Assignment waiting for a grade has no score and is not "failed"; once Finalized it has the score set against the passing score', async () => {
      await submission(asg1, LEARNER, 1, 'AwaitingInstructor', null);
      let item = find((await results()).data, asg1);
      assert.equal(item.kind, 'ASSIGNMENT');
      assert.equal(item.status, 'AwaitingResult');
      assert.equal(item.recordedScore, null);
      assert.equal(item.passed, null);
      assert.equal(item.assignment.gradingStatus, 'AwaitingInstructor');
      assert.equal(item.isRequired, true);
      await db.query(
        `UPDATE submissions SET grading_status = 'Finalized', final_score = 59 WHERE assessment_id = $1`,
        [asg1],
      );
      item = find((await results()).data, asg1);
      assert.deepEqual(
        [item.status, item.recordedScore, item.passed, item.passingScore],
        ['Completed', 59, false, 60],
      );
      await db.query(
        `UPDATE submissions SET final_score = 60 WHERE assessment_id = $1`,
        [asg1],
      );
      item = find((await results()).data, asg1);
      assert.deepEqual([item.recordedScore, item.passed], [60, true]);
    });

    test('a resubmission replaces the earlier one: its own state counts, not the old score (BR-170, BR-212)', async () => {
      await db.query(
        `UPDATE submissions SET superseded_at = now() WHERE assessment_id = $1`,
        [asg1],
      );
      await submission(asg1, LEARNER, 2, 'AwaitingInstructor', null, false, 5);
      const item = find((await results()).data, asg1);
      assert.equal(item.status, 'AwaitingResult');
      assert.equal(item.recordedScore, null);
      assert.equal(item.attemptCount, 2);
      assert.equal(item.assignment.latestSubmissionNumber, 2);
    });

    test('the most recent activity comes first', async () => {
      await submission(asg2, LEARNER, 1, 'Finalized', 90, false, 1);
      const items = (await results()).data.items as any[];
      assert.equal(items[0].assessmentId, asg2);
      const times = items.map((i) => new Date(i.lastActivityAt).getTime());
      assert.deepEqual(
        times,
        [...times].sort((a, b) => b - a),
      );
    });

    test('a disabled component keeps its score and is marked (BR-296)', async () => {
      await db.query(
        `UPDATE assessments SET disabled_at = now() WHERE id = $1`,
        [quiz1],
      );
      const item = find((await results()).data, quiz1);
      assert.equal(item.disabled, true);
      assert.equal(item.recordedScore, 85);
      await db.query(
        `UPDATE assessments SET disabled_at = NULL WHERE id = $1`,
        [quiz1],
      );
    });
  });

  describe('time (BR-200)', () => {
    test('an attempt that ran out of time is submitted first, so the results have its score and the kind', async () => {
      const [{ id }] = (await attempt(
        quiz2,
        LEARNER,
        1,
        null,
        null,
        30,
      )) as any[];
      await db.query(
        `INSERT INTO quiz_attempt_answers (id, organization_id, attempt_id, question_id, option_id, updated_at)
                      VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        [ORG, id, uuid(1), uuid(2)],
      );
      assert.equal(
        (
          await db.query(
            `SELECT submitted_at FROM quiz_attempts WHERE id = $1`,
            [id],
          )
        )[0].submitted_at,
        null,
      );
      const item = find((await results()).data, quiz2);
      assert.equal(item.status, 'Completed');
      assert.equal(item.recordedScore, 100);
      assert.equal(item.passed, true);
      assert.deepEqual(
        item.quiz.attempts.map((a: any) => a.submissionKind),
        ['TimedOut'],
      );
      const row = (
        await db.query(
          `SELECT submission_kind, submitted_at, deadline_at FROM quiz_attempts WHERE id = $1`,
          [id],
        )
      )[0];
      assert.equal(row.submission_kind, 'TimedOut');
      assert.equal(
        new Date(row.submitted_at as string).getTime(),
        new Date(row.deadline_at as string).getTime(),
      );
    });
  });

  describe('whose results', () => {
    test('another Learner sees nothing of these, and has their own', async () => {
      assert.deepEqual((await results(LEARNER_2)).data.items, []);
      await attempt(quiz1, LEARNER_2, 1, 30);
      const mine = find((await results(LEARNER_2)).data, quiz1);
      assert.equal(mine.recordedScore, 30);
      assert.equal(find((await results()).data, quiz1).recordedScore, 85);
    });

    test('the real answer passes the check learning-service makes of it (the contract)', async () => {
      const r = await results();
      assert.ok((r.data.items as unknown[]).length >= 4);
      assert.doesNotThrow(() => validateAssessmentResults(r.data, COURSE));
      assert.doesNotThrow(() =>
        validateAssessmentResults({ courseId: COURSE, items: [] }, COURSE),
      );
    });

    test('the Organization is part of every question: rows of the same Learner in another Organization do not open the components', async () => {
      // an attempt with the Organization of the caller on a component of another Organization is still not shown
      await db.query(
        `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at,
                submitted_at, submission_kind, score, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 9, now() - interval '2 hours', now() - interval '110 minutes',
                 now() - interval '115 minutes', 'Manual', 99, now(), now())`,
        [OTHER_ORG, quiz1, LEARNER],
      );
      const foreign = await results(
        LEARNER,
        COURSE,
        asLearner(LEARNER, OTHER_ORG),
      );
      assert.deepEqual(foreign.data.items, []);
      assert.equal(
        find((await results()).data, quiz1).attemptCount,
        3,
        'and it does not leak into the right Organization',
      );
      await db.query('DELETE FROM quiz_attempts WHERE attempt_number = 9');
    });

    test('another Course and another Organization see nothing', async () => {
      assert.deepEqual((await results(LEARNER, OTHER_COURSE)).data.items, []);
      const foreign = await results(
        LEARNER,
        COURSE,
        asLearner(LEARNER, OTHER_ORG),
      );
      assert.equal(foreign.status, 200);
      assert.deepEqual(foreign.data.items, []);
      assert.deepEqual((await results(LEARNER, UNKNOWN)).data.items, []);
    });

    test('the answer carries no answer key and nothing of the Instructor’s grading beyond the state', async () => {
      const text = JSON.stringify((await results()).json);
      assert.ok(
        !/isCorrect|is_correct|comment|content|reviewer/i.test(text),
        text.slice(0, 300),
      );
    });
  });
});
