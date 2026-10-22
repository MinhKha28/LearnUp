/**
 * UC18.1 through the real HTTP API and a real Postgres: guards, the hiding of other Instructors' Quizzes
 * (BR-79, BR-287), the answer keys in display order, the BR-99 permissions and Course Service being down (BR-78).
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
  OTHER_INSTRUCTOR,
  OTHER_ORG,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const MODULE = '00000000-0000-4000-8000-0000000000e1';

describe('UC18.1 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, { COURSE_SERVICE_URL: course.url });
    api = apiFor(service.baseUrl);
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });
  const reset = () => course.reset();

  const createQuiz = async (title: string, moduleId?: string) => {
    const r = await api('POST', '/quizzes', {
      courseId: COURSE,
      title,
      timeLimitMinutes: 20,
      passingScore: 72.5,
      isRequired: true,
      maxConsecutiveAttempts: 3,
      lockoutHours: 12,
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const id = r.data.id as string;
    // The fake Course Service has no Module tree, so the Module is attached in the database.
    if (moduleId) {
      await db.query('UPDATE assessments SET module_id = $1 WHERE id = $2', [
        moduleId,
        id,
      ]);
    }
    return id;
  };

  /** Questions are written out of order on purpose, to prove the answer sorts them by position. */
  const addQuestions = async (quizId: string) => {
    const question = async (
      position: number,
      type: string,
      content: string,
      options: [string, boolean][],
    ) => {
      const rows = await db.query(
        `INSERT INTO quiz_questions (id, organization_id, assessment_id, question_type, content, position, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now()) RETURNING id`,
        [ORG, quizId, type, content, position],
      );
      const questionId = rows[0].id as string;
      // Options also inserted last-to-first.
      for (let i = options.length - 1; i >= 0; i--) {
        await db.query(
          `INSERT INTO quiz_question_options (id, organization_id, question_id, content, is_correct, position, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
          [ORG, questionId, options[i][0], options[i][1], i + 1],
        );
      }
    };
    await question(3, 'TrueFalse', 'Exits must stay clear.', [
      ['True', true],
      ['False', false],
    ]);
    await question(1, 'SingleChoice', 'Which gear is required?', [
      ['Helmet', true],
      ['Cap', false],
      ['Scarf', false],
    ]);
    await question(2, 'MultipleChoice', 'Pick the fire classes.', [
      ['A', true],
      ['B', true],
      ['Z', false],
    ]);
  };

  const addAttempt = (quizId: string) =>
    db.query(
      `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now() + interval '20 minutes', now())`,
      [ORG, quizId, LEARNER],
    );

  describe('guards', () => {
    test('a call without the internal key is refused (401)', async () => {
      const r = await api('GET', `/quizzes/${UNKNOWN}`, undefined, {});
      assert.equal(r.status, 401);
    });

    test('only an Instructor may look (403), the id must be a UUID (400)', async () => {
      reset();
      const id = await createQuiz('Guarded');
      for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN']) {
        const r = await api(
          'GET',
          `/quizzes/${id}`,
          undefined,
          identity({ role }),
        );
        assert.equal(r.status, 403, role);
        assert.equal(r.data, undefined, 'no Quiz data in a refusal');
      }
      assert.equal((await api('GET', '/quizzes/abc')).status, 400);
    });

    test('unknown, another Instructor’s, another Organization’s or an unknown Course: the same 404 (BR-79, BR-287)', async () => {
      reset();
      const id = await createQuiz('Not yours');
      await addQuestions(id);

      const unknown = await api('GET', `/quizzes/${UNKNOWN}`);
      const otherInstructor = await api(
        'GET',
        `/quizzes/${id}`,
        undefined,
        identity({ user: OTHER_INSTRUCTOR }),
      );
      const otherOrg = await api(
        'GET',
        `/quizzes/${id}`,
        undefined,
        identity({ org: OTHER_ORG }),
      );
      course.state.respond = '404';
      const courseGone = await api('GET', `/quizzes/${id}`);
      reset();

      for (const r of [unknown, otherInstructor, otherOrg, courseGone]) {
        assert.equal(r.status, 404);
        assert.deepEqual(r.json.error, {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found.',
        });
        assert.equal(r.data, undefined);
      }
    });

    test('Course Service down is a 503 without Quiz data (BR-78)', async () => {
      reset();
      const id = await createQuiz('Course Service down');
      course.state.respond = '500';
      const r = await api('GET', `/quizzes/${id}`);
      reset();
      assert.equal(r.status, 503);
      assert.equal(r.code, 'COURSE_SERVICE_UNAVAILABLE');
      assert.equal(r.data, undefined);
    });
  });

  describe('detail (UC18.1)', () => {
    test('configuration, placement and every question with its answer key, in display order', async () => {
      reset();
      const id = await createQuiz('Safety Quiz', MODULE);
      await addQuestions(id);

      const r = await api('GET', `/quizzes/${id}`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.message, 'Quiz retrieved successfully.');
      const quiz = r.data;
      assert.equal(quiz.id, id);
      assert.equal(quiz.courseId, COURSE);
      assert.equal(quiz.moduleId, MODULE);
      assert.equal(quiz.placement, 'MODULE');
      assert.equal(quiz.title, 'Safety Quiz');
      assert.equal(quiz.passingScore, 72.5); // BR-315: a number with 2 decimals, not a string
      assert.equal(quiz.isRequired, true);
      assert.equal(quiz.timeLimitMinutes, 20);
      assert.equal(quiz.maxConsecutiveAttempts, 3);
      assert.equal(quiz.lockoutHours, 12);
      assert.equal(quiz.questionCount, 3);
      assert.equal(quiz.courseStatus, 'Draft');
      assert.equal(quiz.courseLocked, false);
      assert.equal(quiz.disabled, false);
      assert.deepEqual(quiz.lockReasons, []);

      assert.deepEqual(
        quiz.questions.map((q: Record<string, any>) => [
          q.position,
          q.type,
          q.content,
        ]),
        [
          [1, 'SingleChoice', 'Which gear is required?'],
          [2, 'MultipleChoice', 'Pick the fire classes.'],
          [3, 'TrueFalse', 'Exits must stay clear.'],
        ],
      );
      assert.deepEqual(
        quiz.questions[1].options.map((o: Record<string, any>) => [
          o.position,
          o.content,
          o.isCorrect,
        ]),
        [
          [1, 'A', true],
          [2, 'B', true],
          [3, 'Z', false],
        ],
      );
      assert.deepEqual(Object.keys(quiz.questions[0]).sort(), [
        'content',
        'id',
        'options',
        'position',
        'type',
      ]);
      assert.deepEqual(Object.keys(quiz.questions[0].options[0]).sort(), [
        'content',
        'id',
        'isCorrect',
        'position',
      ]);
      assert.equal('organizationId' in quiz, false);

      for (const value of Object.values<{ allowed: boolean }>(
        quiz.permissions,
      )) {
        assert.equal(value.allowed, true);
      }
    });

    test('a Course-level Quiz without questions (BR-154)', async () => {
      reset();
      const id = await createQuiz('Final check');
      const r = await api('GET', `/quizzes/${id}`);
      assert.equal(r.status, 200);
      assert.equal(r.data.moduleId, null);
      assert.equal(r.data.placement, 'COURSE');
      assert.deepEqual(r.data.questions, []);
      assert.equal(r.data.questionCount, 0);
    });

    test('attempts and a Locked Course show up as reasons per change (BR-92, BR-94, BR-96, BR-97, BR-323)', async () => {
      reset();
      const id = await createQuiz('Used');
      await addQuestions(id);
      await addAttempt(id);
      Object.assign(course.state, { status: 'Published', locked: true });

      const r = await api('GET', `/quizzes/${id}`);
      reset();
      assert.equal(r.status, 200);
      const p = r.data.permissions;
      assert.equal(r.data.hasAttempts, true);
      assert.equal(r.data.courseLocked, true);
      assert.deepEqual(r.data.lockReasons, [
        'QUIZ_HAS_ATTEMPTS',
        'COURSE_LOCKED',
      ]);
      assert.deepEqual(p.editQuestions, {
        allowed: false,
        reasons: ['QUIZ_HAS_ATTEMPTS'],
      });
      assert.deepEqual(p.editTimeLimit.reasons, ['QUIZ_HAS_ATTEMPTS']);
      assert.deepEqual(p.editAttemptRule.reasons, ['QUIZ_HAS_ATTEMPTS']);
      assert.deepEqual(p.editPassingScore.reasons, ['COURSE_LOCKED']);
      assert.deepEqual(p.editRequired.reasons, ['COURSE_LOCKED']);
      assert.deepEqual(p.deleteQuiz.reasons, [
        'COURSE_LOCKED',
        'QUIZ_HAS_ATTEMPTS',
      ]);
      assert.deepEqual(p.deleteLastQuestion.reasons, [
        'QUIZ_HAS_ATTEMPTS',
        'COURSE_LEFT_DRAFT',
      ]);
    });

    test('a Submitted, Archived or Disabled Course can be viewed but nothing changed (BR-285)', async () => {
      reset();
      const id = await createQuiz('Frozen');
      for (const [patch, reason] of [
        [{ status: 'Submitted' }, 'COURSE_SUBMITTED'],
        [{ status: 'Archived' }, 'COURSE_NOT_EDITABLE'],
        [{ disabled: true }, 'COURSE_NOT_EDITABLE'],
      ] as const) {
        Object.assign(course.state, patch);
        const r = await api('GET', `/quizzes/${id}`);
        reset();
        assert.equal(r.status, 200, JSON.stringify(patch));
        for (const [key, value] of Object.entries(r.data.permissions)) {
          assert.deepEqual(
            value,
            { allowed: false, reasons: [reason] },
            `${key} ${JSON.stringify(patch)}`,
          );
        }
      }
    });

    test('the UC18 list keeps its row shape next to the new detail', async () => {
      reset();
      const r = await api('GET', `/quizzes?courseId=${COURSE}`);
      assert.equal(r.status, 200);
      for (const row of r.data.items) {
        assert.equal('permissions' in row, false);
        assert.equal('questions' in row, false);
      }
    });
  });
});
