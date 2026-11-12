/**
 * UC18.1.1 through the real HTTP API and a real Postgres: success per question type, every rejection (validation,
 * answer key, guards, hiding, Course state, attempts) and the concurrency guarantees of the row lock: parallel adds
 * get distinct consecutive positions, and a Learner starting the Quiz at the same moment is never slipped past (BR-117).
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
  sleep,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

describe('UC18.1.1 over HTTP', () => {
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

  const createQuiz = async (title: string) => {
    const r = await api('POST', '/quizzes', {
      courseId: COURSE,
      title,
      timeLimitMinutes: 20,
      passingScore: 70,
      isRequired: true,
      maxConsecutiveAttempts: 3,
      lockoutHours: 12,
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.data.id as string;
  };

  const addAttempt = (quizId: string) =>
    db.query(
      `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now() + interval '20 minutes', now())`,
      [ORG, quizId, LEARNER],
    );

  const storedQuestions = (quizId: string) =>
    db.query(
      `SELECT q.position, q.question_type, q.content, q.organization_id,
              json_agg(json_build_array(o.position, o.content, o.is_correct, o.organization_id) ORDER BY o.position) AS options
         FROM quiz_questions q JOIN quiz_question_options o ON o.question_id = q.id
        WHERE q.assessment_id = $1 GROUP BY q.id ORDER BY q.position`,
      [quizId],
    );

  const single = {
    type: 'SingleChoice',
    content: '  Which gear is required?  ',
    options: [
      { content: 'Helmet', isCorrect: true },
      { content: 'Cap', isCorrect: false },
      { content: 'Scarf', isCorrect: false },
    ],
  };

  describe('success', () => {
    test('each type is added at the end, stored with its answer key and shown in the detail', async () => {
      reset();
      const id = await createQuiz('Safety Quiz');

      const r1 = await api('POST', `/quizzes/${id}/questions`, single);
      assert.equal(r1.status, 201, JSON.stringify(r1.json));
      assert.equal(r1.json.message, 'Question added successfully.');
      assert.equal(r1.data.quizId, id);
      assert.equal(r1.data.questionCount, 1);
      assert.equal(r1.data.question.position, 1);
      assert.equal(r1.data.question.type, 'SingleChoice');
      assert.equal(r1.data.question.content, 'Which gear is required?'); // trimmed
      assert.deepEqual(
        r1.data.question.options.map((o: Record<string, any>) => [
          o.position,
          o.content,
          o.isCorrect,
        ]),
        [
          [1, 'Helmet', true],
          [2, 'Cap', false],
          [3, 'Scarf', false],
        ],
      );
      assert.deepEqual(Object.keys(r1.data.question).sort(), [
        'content',
        'id',
        'options',
        'position',
        'type',
      ]);
      assert.deepEqual(Object.keys(r1.data.question.options[0]).sort(), [
        'content',
        'id',
        'isCorrect',
        'position',
      ]);

      const r2 = await api('POST', `/quizzes/${id}/questions`, {
        type: 'MultipleChoice',
        content: 'Pick the fire classes.',
        options: [
          { content: 'A', isCorrect: true },
          { content: 'B', isCorrect: true },
          { content: 'Z', isCorrect: false },
        ],
      });
      assert.equal(r2.status, 201, JSON.stringify(r2.json));
      assert.equal(r2.data.question.position, 2);

      const r3 = await api('POST', `/quizzes/${id}/questions`, {
        type: 'TrueFalse',
        content: 'Exits must stay clear.',
        correctAnswer: true,
      });
      assert.equal(r3.status, 201, JSON.stringify(r3.json));
      assert.equal(r3.data.question.position, 3);
      assert.equal(r3.data.questionCount, 3);
      assert.deepEqual(
        r3.data.question.options.map((o: Record<string, any>) => [
          o.content,
          o.isCorrect,
        ]),
        [
          ['True', true],
          ['False', false],
        ],
      );

      const rows = await storedQuestions(id);
      assert.deepEqual(
        rows.map((q) => [q.position, q.question_type, q.organization_id]),
        [
          [1, 'SingleChoice', ORG],
          [2, 'MultipleChoice', ORG],
          [3, 'TrueFalse', ORG],
        ],
      );
      for (const q of rows) {
        for (const option of q.options as unknown[][]) {
          assert.equal(option[3], ORG, 'options stored in the same tenant');
        }
      }

      const detail = await api('GET', `/quizzes/${id}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.data.questionCount, 3);
      assert.deepEqual(
        detail.data.questions.map((q: Record<string, any>) => q.id),
        [r1.data.question.id, r2.data.question.id, r3.data.question.id],
      );
    });

    test('a Published or Locked Course still accepts questions while nobody started the Quiz', async () => {
      reset();
      const id = await createQuiz('Live');
      for (const patch of [
        { status: 'Rejected' },
        { status: 'Published' },
        { status: 'Published', locked: true },
      ]) {
        Object.assign(course.state, patch);
        const r = await api('POST', `/quizzes/${id}/questions`, single);
        reset();
        assert.equal(r.status, 201, JSON.stringify(patch));
      }
    });
  });

  describe('rejections', () => {
    test('a call without the internal key is refused (401)', async () => {
      const r = await api('POST', `/quizzes/${UNKNOWN}/questions`, single, {});
      assert.equal(r.status, 401);
    });

    test('only an Instructor may add (403), the id must be a UUID (400)', async () => {
      reset();
      const id = await createQuiz('Guarded');
      for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN']) {
        const r = await api(
          'POST',
          `/quizzes/${id}/questions`,
          single,
          identity({ role }),
        );
        assert.equal(r.status, 403, role);
      }
      assert.equal(
        (await api('POST', '/quizzes/abc/questions', single)).status,
        400,
      );
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('malformed requests are a 400 from validation', async () => {
      reset();
      const id = await createQuiz('Validation');
      for (const body of [
        {},
        { ...single, type: 'Essay' },
        { ...single, content: '   ' },
        { ...single, content: 'a'.repeat(2001) },
        { ...single, options: 'Helmet' },
        {
          ...single,
          options: [
            { content: 'a'.repeat(501), isCorrect: true },
            single.options[1],
          ],
        },
        { ...single, options: [{ content: 'A' }, single.options[1]] },
        { ...single, position: 1 },
        { type: 'TrueFalse', content: 'Q', correctAnswer: 'yes' },
      ]) {
        const r = await api('POST', `/quizzes/${id}/questions`, body);
        assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
      }
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('a wrong answer key is a 400 QUIZ_QUESTION_INVALID listing every reason (BR-202)', async () => {
      reset();
      const id = await createQuiz('Answer key');
      const cases: [Record<string, unknown>, string[]][] = [
        [{ type: 'TrueFalse', content: 'Q' }, ['CORRECT_ANSWER_REQUIRED']],
        [
          {
            type: 'TrueFalse',
            content: 'Q',
            correctAnswer: true,
            options: single.options,
          },
          ['OPTIONS_NOT_ALLOWED'],
        ],
        [{ type: 'SingleChoice', content: 'Q' }, ['OPTIONS_REQUIRED']],
        [{ ...single, options: [single.options[0]] }, ['OPTIONS_COUNT']],
        [
          {
            ...single,
            options: [
              { content: 'Helmet', isCorrect: true },
              { content: 'HELMET', isCorrect: false },
            ],
          },
          ['OPTIONS_DUPLICATED'],
        ],
        [
          {
            ...single,
            options: single.options.map((o) => ({ ...o, isCorrect: true })),
          },
          ['SINGLE_CORRECT_COUNT'],
        ],
        [
          {
            type: 'MultipleChoice',
            content: 'Q',
            options: single.options.map((o) => ({ ...o, isCorrect: true })),
          },
          ['MULTIPLE_INCORRECT_COUNT'],
        ],
        [{ ...single, correctAnswer: true }, ['CORRECT_ANSWER_NOT_ALLOWED']],
      ];
      for (const [body, errors] of cases) {
        const r = await api('POST', `/quizzes/${id}/questions`, body);
        assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
        assert.equal(r.code, 'QUIZ_QUESTION_INVALID');
        assert.deepEqual(
          r.json.error.errors,
          errors,
          JSON.stringify(body).slice(0, 80),
        );
      }
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('unknown, another Instructor’s, another Organization’s or an unknown Course: the same 404 (BR-79, BR-287)', async () => {
      reset();
      const id = await createQuiz('Not yours');
      const results = [
        await api('POST', `/quizzes/${UNKNOWN}/questions`, single),
        await api(
          'POST',
          `/quizzes/${id}/questions`,
          single,
          identity({ user: OTHER_INSTRUCTOR }),
        ),
        await api(
          'POST',
          `/quizzes/${id}/questions`,
          single,
          identity({ org: OTHER_ORG }),
        ),
      ];
      course.state.respond = '404';
      results.push(await api('POST', `/quizzes/${id}/questions`, single));
      reset();
      for (const r of results) {
        assert.equal(r.status, 404);
        assert.deepEqual(r.json.error, {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found.',
        });
        assert.equal(r.data, undefined);
      }
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('Course Service down is a 503 and nothing is written (BR-78)', async () => {
      reset();
      const id = await createQuiz('Course Service down');
      course.state.respond = '500';
      const r = await api('POST', `/quizzes/${id}/questions`, single);
      reset();
      assert.equal(r.status, 503);
      assert.equal(r.code, 'COURSE_SERVICE_UNAVAILABLE');
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('a Submitted, Archived or Disabled Course is a 409 COURSE_NOT_EDITABLE (BR-83, BR-285)', async () => {
      reset();
      const id = await createQuiz('Frozen');
      for (const [patch, reason] of [
        [{ status: 'Submitted' }, 'COURSE_SUBMITTED'],
        [{ status: 'Archived' }, 'COURSE_NOT_EDITABLE'],
        [{ disabled: true }, 'COURSE_NOT_EDITABLE'],
      ] as const) {
        Object.assign(course.state, patch);
        const r = await api('POST', `/quizzes/${id}/questions`, single);
        reset();
        assert.equal(r.status, 409, JSON.stringify(patch));
        assert.equal(r.code, 'COURSE_NOT_EDITABLE');
        assert.equal(r.json.error.reason, reason, JSON.stringify(patch));
      }
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('a Quiz a Learner already started, finished or not, is a 409 QUIZ_HAS_ATTEMPTS (BR-117, BR-314)', async () => {
      reset();
      const id = await createQuiz('Started');
      assert.equal(
        (await api('POST', `/quizzes/${id}/questions`, single)).status,
        201,
      );
      await addAttempt(id); // submitted_at stays null: an unfinished attempt counts
      const r = await api('POST', `/quizzes/${id}/questions`, single);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'QUIZ_HAS_ATTEMPTS');
      assert.equal((await storedQuestions(id)).length, 1);
    });
  });

  describe('concurrency', () => {
    test('parallel adds on one Quiz all succeed with distinct consecutive positions', async () => {
      reset();
      const id = await createQuiz('Parallel');
      const n = 8;
      const results = await Promise.all(
        Array.from({ length: n }, (_, i) =>
          api('POST', `/quizzes/${id}/questions`, {
            type: 'TrueFalse',
            content: `Statement ${i}`,
            correctAnswer: i % 2 === 0,
          }),
        ),
      );
      for (const r of results)
        assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.deepEqual(
        results.map((r) => r.data.question.position).sort((a, b) => a - b),
        Array.from({ length: n }, (_, i) => i + 1),
      );
      // Each answer counts the questions as they stood right after its own insert.
      assert.deepEqual(
        results.map((r) => r.data.questionCount).sort((a, b) => a - b),
        Array.from({ length: n }, (_, i) => i + 1),
      );
      const rows = await storedQuestions(id);
      assert.deepEqual(
        rows.map((q) => q.position),
        Array.from({ length: n }, (_, i) => i + 1),
      );
    });

    test('a Learner starting the Quiz while a question is being added: the add waits and is refused (BR-117)', async () => {
      reset();
      const id = await createQuiz('Race');
      const learner = await db.connect();
      try {
        // The attempt insert takes FOR KEY SHARE on the Quiz row; keep it uncommitted while the add runs.
        await learner.query('BEGIN');
        await learner.query(
          `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now() + interval '20 minutes', now())`,
          [ORG, id, LEARNER],
        );

        let settled = false;
        const pending = api('POST', `/quizzes/${id}/questions`, single).then(
          (r) => {
            settled = true;
            return r;
          },
        );
        await sleep(500);
        assert.equal(settled, false, 'the add must wait for the row lock');

        await learner.query('COMMIT');
        const r = await pending;
        assert.equal(r.status, 409, JSON.stringify(r.json));
        assert.equal(r.code, 'QUIZ_HAS_ATTEMPTS');
      } finally {
        await learner.end();
      }
      assert.equal((await storedQuestions(id)).length, 0);
    });

    test('a Learner whose start is rolled back does not block the add', async () => {
      reset();
      const id = await createQuiz('Rolled back');
      const learner = await db.connect();
      try {
        await learner.query('BEGIN');
        await learner.query(
          `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now() + interval '20 minutes', now())`,
          [ORG, id, LEARNER],
        );
        const pending = api('POST', `/quizzes/${id}/questions`, single);
        await sleep(300);
        await learner.query('ROLLBACK');
        const r = await pending;
        assert.equal(r.status, 201, JSON.stringify(r.json));
        assert.equal(r.data.question.position, 1);
      } finally {
        await learner.end();
      }
    });
  });
});
