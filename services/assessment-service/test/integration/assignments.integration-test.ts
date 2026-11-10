/**
 * UC19 through the real HTTP API and a real Postgres: guards, validation, every business rule,
 * the outbox rows, the cascade on delete and the race with a concurrent submission.
 * The tests are one story and share state, so keep their order.
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
  type ApiResult,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const valid = {
  courseId: COURSE,
  title: 'Safety',
  prompt: 'Write it',
  passingScore: 70,
  expectedDurationMinutes: 90,
  rubric: [
    { name: 'A', description: 'A desc', maxPoints: 40 },
    { name: 'B', description: 'B desc', maxPoints: 60 },
  ],
};

describe('UC19 over HTTP', () => {
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

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query(sql, params))[0].count);
  const addSubmission = (
    assignmentId: string,
    client: {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    } = db,
  ) =>
    client.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, submitted_at, grading_status, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), 'PENDING', now())`,
      [ORG, assignmentId, LEARNER],
    );

  let first: ApiResult['data'];
  const list = () => api('GET', `/assignments?courseId=${COURSE}`);

  describe('guards and validation', () => {
    test('a call without the internal key is refused (401)', async () => {
      const r = await api(
        'GET',
        `/assignments?courseId=${COURSE}`,
        undefined,
        {},
      );
      assert.equal(r.status, 401);
    });

    test('only an Instructor may use it (403)', async () => {
      for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN']) {
        const r = await api(
          'GET',
          `/assignments?courseId=${COURSE}`,
          undefined,
          identity({ role }),
        );
        assert.equal(r.status, 403, role);
      }
    });

    test('bad input is a 400 before anything is stored', async () => {
      assert.equal((await api('GET', '/assignments?courseId=abc')).status, 400);
      assert.equal(
        (await api('POST', '/assignments', { ...valid, rubric: [] })).status,
        400,
      );
      assert.equal(
        (await api('POST', '/assignments', { ...valid, isRequired: false }))
          .status,
        400,
      );
      assert.equal(
        (await api('POST', '/assignments', { ...valid, passingScore: 101 }))
          .status,
        400,
      );
      const noPrompt = await api('POST', '/assignments', {
        ...valid,
        prompt: undefined,
      });
      assert.equal(noPrompt.status, 400);
      assert.equal(noPrompt.code, 'ASSIGNMENT_PROMPT_REQUIRED');
      assert.equal(await count('SELECT count(*) FROM assessments'), 0);
    });
  });

  describe('create (UC19.2)', () => {
    test('stores the Assignment with its Rubric and the platform defaults', async () => {
      const r = await api('POST', '/assignments', valid);
      assert.equal(r.status, 201, JSON.stringify(r.json));
      first = r.data;

      assert.equal(first.maxConsecutiveAttempts, 3); // BR-175 defaults
      assert.equal(first.lockoutHours, 24);
      assert.deepEqual(
        first.rubric.map((c: { maxPoints: number }) => c.maxPoints),
        [40, 60],
      );
      assert.equal(first.peerReview.enabled, false);
      assert.equal(first.locked, false);
      assert.equal(first.courseLocked, false);
    });

    test('is required (BR-165) and announces its duration to the Course (BR-51)', async () => {
      const [row] = await db.query(
        'SELECT is_required FROM assessments WHERE id = $1',
        [first.id],
      );
      assert.equal(row.is_required, true);
      assert.equal(
        await count(
          `SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'AssignmentMinutesChanged' AND payload->>'change' = 'Created'`,
          [first.id],
        ),
        1,
      );
    });

    test('parallel creates on one Course never share a position', async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          api('POST', '/assignments', { ...valid, title: `P${i}` }),
        ),
      );
      assert.ok(
        results.every((r) => r.status === 201),
        JSON.stringify(results.map((r) => [r.status, r.code])),
      );
      const positions = results
        .map((r) => r.data.position)
        .sort((a, b) => a - b);
      assert.equal(new Set(positions).size, 6, JSON.stringify(positions));
    });
  });

  describe('list and detail (UC19, UC19.1)', () => {
    test('the list is one page with the Course-level flags', async () => {
      const r = await list();
      assert.equal(r.status, 200);
      assert.equal(r.data.items.length, 7);
      assert.deepEqual(r.data.meta, {
        current: 1,
        pageSize: 7,
        pages: 1,
        total: 7,
      });
      assert.equal(r.data.courseLocked, false);
      assert.equal(r.data.courseStatus, 'Draft');
    });

    test('a Course without Assignments gives an empty page', async () => {
      const r = await api('GET', `/assignments?courseId=${UNKNOWN}`);
      assert.equal(r.status, 200);
      assert.deepEqual(r.data.items, []);
      assert.equal(r.data.meta.total, 0);
      assert.equal(r.data.meta.pages, 0);
    });

    test('the detail has the Rubric and the grading settings', async () => {
      const r = await api('GET', `/assignments/${first.id}`);
      assert.equal(r.status, 200);
      assert.equal(r.data.rubric.length, 2);
      assert.equal(r.data.passingScore, 70);
    });

    test('unknown, foreign or other-tenant Assignments are hidden as 404', async () => {
      assert.equal((await api('GET', `/assignments/${UNKNOWN}`)).status, 404);
      assert.equal(
        (
          await api(
            'GET',
            `/assignments/${first.id}`,
            undefined,
            identity({ user: OTHER_INSTRUCTOR }),
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await api(
            'GET',
            `/assignments/${first.id}`,
            undefined,
            identity({ org: OTHER_ORG }),
          )
        ).status,
        404,
      );
    });
  });

  describe('update (UC19.3) and Peer Review (UC19.5) before any submission', () => {
    test('prompt, Rubric, n, m and effort change; the Rubric is replaced', async () => {
      const r = await api('PATCH', `/assignments/${first.id}`, {
        prompt: 'New prompt',
        rubric: [{ name: 'Z', description: 'Z desc', maxPoints: 100 }],
        maxConsecutiveAttempts: 5,
        lockoutHours: 12,
        expectedDurationMinutes: 120,
      });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.prompt, 'New prompt');
      assert.equal(r.data.rubric.length, 1);
      assert.equal(r.data.maxConsecutiveAttempts, 5);
      assert.equal(
        await count(
          'SELECT count(*) FROM rubric_criteria WHERE assessment_id = $1',
          [first.id],
        ),
        1,
      );
      assert.equal(
        await count(
          `SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'AssignmentMinutesChanged' AND payload->>'change' = 'DurationChanged'`,
          [first.id],
        ),
        1,
      );
    });

    test('invalid patches are refused', async () => {
      assert.equal(
        (await api('PATCH', `/assignments/${first.id}`, { courseId: COURSE }))
          .status,
        400,
      );
      const empty = await api('PATCH', `/assignments/${first.id}`, {
        prompt: '  ',
      });
      assert.equal(empty.status, 400);
      assert.equal(empty.code, 'ASSIGNMENT_PROMPT_REQUIRED');
      assert.equal(
        (await api('PATCH', `/assignments/${first.id}`, {})).status,
        200,
      ); // empty patch is fine
    });

    test('Peer Review turns on with the platform defaults (cycle 7, deadline 3)', async () => {
      const r = await api('PUT', `/assignments/${first.id}/peer-review`, {
        enabled: true,
        reviewersPerSubmission: 2,
        scoreGap: 20,
      });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(r.data.peerReview, {
        enabled: true,
        reviewersPerSubmission: 2,
        cycleDays: 7,
        deadlineDays: 3,
        scoreGap: 20,
      });
    });

    test('Peer Review needs the reviewer count and the score gap when on', async () => {
      const r = await api('PUT', `/assignments/${first.id}/peer-review`, {
        enabled: true,
        scoreGap: 20,
      });
      assert.equal(r.status, 400);
    });

    test('Peer Review can be turned off and on again', async () => {
      const off = await api('PUT', `/assignments/${first.id}/peer-review`, {
        enabled: false,
      });
      assert.equal(off.data.peerReview.enabled, false);
      const on = await api('PUT', `/assignments/${first.id}/peer-review`, {
        enabled: true,
        reviewersPerSubmission: 2,
        scoreGap: 20,
      });
      assert.equal(on.data.peerReview.enabled, true);
    });
  });

  describe('after a submission exists (BR-98, BR-173)', () => {
    before(async () => {
      await addSubmission(first.id);
    });

    test('prompt, Rubric, n and m are frozen', async () => {
      const r = await api('PATCH', `/assignments/${first.id}`, {
        prompt: 'Changed after submit',
      });
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ASSIGNMENT_HAS_SUBMISSIONS');
      const [row] = await db.query(
        'SELECT prompt FROM assessments WHERE id = $1',
        [first.id],
      );
      assert.equal(row.prompt, 'New prompt');
    });

    test('sending the current value again is not a change', async () => {
      assert.equal(
        (
          await api('PATCH', `/assignments/${first.id}`, {
            prompt: 'New prompt',
          })
        ).status,
        200,
      );
    });

    test('the estimated effort can still change', async () => {
      assert.equal(
        (
          await api('PATCH', `/assignments/${first.id}`, {
            expectedDurationMinutes: 45,
          })
        ).status,
        200,
      );
    });

    test('the detail shows it as locked', async () => {
      assert.equal(
        (await api('GET', `/assignments/${first.id}`)).data.locked,
        true,
      );
    });
  });

  describe('when the Course is Locked (BR-80)', () => {
    before(() => {
      course.state.locked = true;
    });
    after(() => course.reset());

    test('no new Assignment (BR-318)', async () => {
      const r = await api('POST', '/assignments', valid);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'COURSE_LOCKED');
    });

    test('the passing score is fixed (BR-319)', async () => {
      const r = await api('PATCH', `/assignments/${first.id}`, {
        passingScore: 80,
      });
      assert.equal(r.status, 409);
      assert.equal(r.code, 'PASSING_SCORE_LOCKED');
    });

    test('Peer Review cannot be switched, but its settings can change (BR-185)', async () => {
      const off = await api('PUT', `/assignments/${first.id}/peer-review`, {
        enabled: false,
      });
      assert.equal(off.status, 409);
      assert.equal(off.code, 'PEER_REVIEW_TOGGLE_LOCKED');
      const edit = await api('PUT', `/assignments/${first.id}/peer-review`, {
        enabled: true,
        reviewersPerSubmission: 3,
        scoreGap: 15,
      });
      assert.equal(edit.status, 200);
    });

    test('an Assignment with data cannot be deleted, one without can (BR-92)', async () => {
      const used = await api('DELETE', `/assignments/${first.id}`);
      assert.equal(used.status, 409);
      assert.equal(used.code, 'ASSIGNMENT_HAS_DATA');

      const unused = (await list()).data.items.find(
        (i: { id: string }) => i.id !== first.id,
      );
      const gone = await api('DELETE', `/assignments/${unused.id}`);
      assert.equal(gone.status, 200);
      assert.equal(
        await count('SELECT count(*) FROM assessments WHERE id = $1', [
          unused.id,
        ]),
        0,
      );
      assert.equal(
        await count(
          `SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'AssignmentMinutesChanged' AND payload->>'change' = 'Deleted'`,
          [unused.id],
        ),
        1,
      );
    });

    test('the list says so', async () => {
      assert.equal((await list()).data.courseLocked, true);
    });
  });

  describe('Course status (BR-284)', () => {
    after(() => course.reset());

    test('a Course in review accepts no change', async () => {
      course.state.status = 'Submitted';
      const r = await api('PATCH', `/assignments/${first.id}`, {
        expectedDurationMinutes: 50,
      });
      assert.equal(r.status, 409);
      assert.equal(r.code, 'COURSE_NOT_EDITABLE');
    });

    test('a Published Course that is not Locked is still editable', async () => {
      course.state.status = 'Published';
      const r = await api('PATCH', `/assignments/${first.id}`, {
        expectedDurationMinutes: 50,
      });
      assert.equal(r.status, 200);
    });
  });

  describe('delete (UC19.4)', () => {
    test('an unused Assignment goes with its Rubric', async () => {
      const victim = (await list()).data.items.find(
        (i: { id: string }) => i.id !== first.id,
      );
      const r = await api('DELETE', `/assignments/${victim.id}`);
      assert.equal(r.status, 200);
      assert.equal(
        await count(
          'SELECT count(*) FROM rubric_criteria WHERE assessment_id = $1',
          [victim.id],
        ),
        0,
      );
    });
  });

  describe('a submission arriving at the same moment (row lock)', () => {
    test('an update waits for the open submission, then is refused', async () => {
      const target = (await list()).data.items.find(
        (i: { id: string }) => i.id !== first.id,
      );
      const [before] = await db.query(
        'SELECT prompt FROM assessments WHERE id = $1',
        [target.id],
      );

      const holder = await db.connect();
      await holder.query('BEGIN');
      await addSubmission(target.id, holder);

      const started = Date.now();
      let settled = false;
      const pending = api('PATCH', `/assignments/${target.id}`, {
        prompt: 'race edit',
      }).then((r) => {
        settled = true;
        return r;
      });
      await sleep(800);
      assert.equal(
        settled,
        false,
        'the update must wait for the submission that is being written',
      );

      await holder.query('COMMIT');
      const r = await pending;
      assert.ok(Date.now() - started >= 800);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ASSIGNMENT_HAS_SUBMISSIONS');

      const [after] = await db.query(
        'SELECT prompt FROM assessments WHERE id = $1',
        [target.id],
      );
      assert.equal(
        after.prompt,
        before.prompt,
        'the prompt must not have been overwritten',
      );
    });
  });
});
