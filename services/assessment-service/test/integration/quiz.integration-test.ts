/**
 * UC18.5 through the real HTTP API and a real Postgres: guards, BR-92 (Locked Course + attempts),
 * the cascade on delete and the race with a Learner who starts the Quiz at the same moment.
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
  sleep,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

describe('UC18.5 over HTTP', () => {
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

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query(sql, params))[0].count);
  const createQuiz = async (title: string) => {
    const r = await api('POST', '/quizzes', {
      courseId: COURSE,
      title,
      timeLimitMinutes: 20,
      passingScore: 70,
      isRequired: false,
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.data.id as string;
  };
  /** One question with one option, and one Learner attempt that answered it. */
  const addData = async (
    quizId: string,
    client: {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    } = db,
  ) => {
    await client.query(
      `INSERT INTO quiz_questions (id, organization_id, assessment_id, question_type, content, position, updated_at)
       VALUES ('00000000-0000-4000-8000-0000000000d1', $1, $2, 'SINGLE', 'Q?', 1, now())`,
      [ORG, quizId],
    );
    await client.query(
      `INSERT INTO quiz_question_options (id, organization_id, question_id, content, is_correct, position, updated_at)
       VALUES ('00000000-0000-4000-8000-0000000000d2', $1, '00000000-0000-4000-8000-0000000000d1', 'A', true, 1, now())`,
      [ORG],
    );
    await client.query(
      `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at, updated_at)
       VALUES ('00000000-0000-4000-8000-0000000000d3', $1, $2, $3, 1, now(), now() + interval '20 minutes', now())`,
      [ORG, quizId, LEARNER],
    );
    await client.query(
      `INSERT INTO quiz_attempt_answers (id, organization_id, attempt_id, question_id, option_id, updated_at)
       VALUES (gen_random_uuid(), $1, '00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d2', now())`,
      [ORG],
    );
  };
  const rows = (quizId: string) =>
    count('SELECT count(*) FROM assessments WHERE id = $1', [quizId]);

  describe('guards', () => {
    test('a call without the internal key is refused (401)', async () => {
      const r = await api('DELETE', `/quizzes/${UNKNOWN}`, undefined, {});
      assert.equal(r.status, 401);
    });

    test('only an Instructor may delete (403), the id must be a UUID (400)', async () => {
      const id = await createQuiz('Guarded');
      for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN']) {
        const r = await api(
          'DELETE',
          `/quizzes/${id}`,
          undefined,
          identity({ role }),
        );
        assert.equal(r.status, 403, role);
      }
      assert.equal((await api('DELETE', '/quizzes/abc')).status, 400);
      assert.equal(await rows(id), 1);
    });

    test('an unknown Quiz or one in another Instructor’s Course is a 404', async () => {
      assert.equal((await api('DELETE', `/quizzes/${UNKNOWN}`)).status, 404);
      const id = await createQuiz('Not yours');
      const r = await api(
        'DELETE',
        `/quizzes/${id}`,
        undefined,
        identity({ user: OTHER_INSTRUCTOR }),
      );
      assert.equal(r.status, 404);
      assert.equal(await rows(id), 1);
    });
  });

  describe('delete (UC18.5)', () => {
    test('a Quiz goes with its questions, options and attempts', async () => {
      reset();
      const id = await createQuiz('Victim');
      await addData(id);
      const r = await api('DELETE', `/quizzes/${id}`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.id, id);
      assert.equal(await rows(id), 0);
      for (const table of [
        'quiz_questions',
        'quiz_question_options',
        'quiz_attempts',
        'quiz_attempt_answers',
      ]) {
        assert.equal(await count(`SELECT count(*) FROM ${table}`), 0, table);
      }
      assert.equal((await api('DELETE', `/quizzes/${id}`)).status, 404);
    });

    test('deleting a Quiz leaves no outbox event (BR-52)', async () => {
      assert.equal(
        await count(
          "SELECT count(*) FROM outbox_events WHERE aggregate_type = 'Quiz'",
        ),
        0,
      );
    });

    test('a Locked Course blocks a Quiz with attempts, not an unused one (BR-92)', async () => {
      reset();
      const used = await createQuiz('Used');
      await addData(used);
      const unused = await createQuiz('Unused');
      course.state.locked = true;

      const blocked = await api('DELETE', `/quizzes/${used}`);
      assert.equal(blocked.status, 409);
      assert.equal(blocked.code, 'QUIZ_HAS_DATA');
      assert.equal(await rows(used), 1);

      assert.equal((await api('DELETE', `/quizzes/${unused}`)).status, 200);
      assert.equal(await rows(unused), 0);

      // the same Quiz can go once the Course is not Locked
      course.state.locked = false;
      assert.equal((await api('DELETE', `/quizzes/${used}`)).status, 200);
    });

    test('a Course in review, archived or disabled accepts no delete (BR-285)', async () => {
      reset();
      const id = await createQuiz('Frozen');
      for (const patch of [
        { status: 'SUBMITTED' },
        { status: 'ARCHIVED' },
        { disabled: true },
      ]) {
        Object.assign(course.state, patch);
        const r = await api('DELETE', `/quizzes/${id}`);
        assert.equal(r.status, 409);
        assert.equal(r.code, 'COURSE_NOT_EDITABLE');
        reset();
      }
      assert.equal(await rows(id), 1);
    });
  });

  describe('an attempt starting at the same moment (row lock)', () => {
    test('the delete waits for the open attempt, then is refused on a Locked Course', async () => {
      reset();
      const id = await createQuiz('Race');
      course.state.locked = true;

      const holder = await db.connect();
      await holder.query('BEGIN');
      await addData(id, holder);

      let settled = false;
      const pending = api('DELETE', `/quizzes/${id}`).then((r) => {
        settled = true;
        return r;
      });
      await sleep(800);
      assert.equal(
        settled,
        false,
        'the delete must wait for the attempt that is being written',
      );

      await holder.query('COMMIT');
      const r = await pending;
      assert.equal(r.status, 409);
      assert.equal(r.code, 'QUIZ_HAS_DATA');
      assert.equal(await rows(id), 1, 'the Quiz must still exist');
    });
  });
});
