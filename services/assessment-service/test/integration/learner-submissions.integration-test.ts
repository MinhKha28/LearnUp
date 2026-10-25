/**
 * UC30 through the real HTTP API and a real Postgres: the Learner view, the multipart submit, the peer review cycle
 * (BR-312), the lock (BR-176), a Completed Enrollment (BR-210) and the races of parallel submits.
 * Enrollment is answered by a fake Learning Service (assessment-access, ENROLLMENT_CLIENT_MODE=http); the Cloudinary upload itself is covered by
 * the unit tests, so no file is stored here.
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
  startCourseStub,
  startLearningStub,
  startService,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const LEARNER_2 = '00000000-0000-4000-8000-0000000000c2';
const LEARNER_3 = '00000000-0000-4000-8000-0000000000c3';
const LEARNER_4 = '00000000-0000-4000-8000-0000000000c4';

const as = (user: string) => identity({ user, role: 'LEARNER' });

describe('UC30 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: LearningStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let reviewed: string; // Assignment with peer review on
  let direct: string; // Assignment graded by the Instructor

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    learning = await startLearningStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'http',
      LEARNING_SERVICE_URL: learning.url,
    });
    api = apiFor(service.baseUrl);

    const make = async (title: string, extra: object = {}) => {
      const r = await api('POST', '/assignments', {
        courseId: COURSE,
        title,
        prompt: 'Write it',
        passingScore: 70,
        expectedDurationMinutes: 30,
        rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
        ...extra,
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.id as string;
    };
    reviewed = await make('Reviewed');
    const on = await api('PUT', `/assignments/${reviewed}/peer-review`, {
      enabled: true,
      reviewersPerSubmission: 2,
      scoreGap: 20,
    });
    assert.equal(on.status, 200, JSON.stringify(on.json));
    direct = await make('Direct');
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await learning?.stop();
    await db?.drop();
  });

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query(sql, params))[0].count);

  const submit = async (
    assignmentId: string,
    user: string,
    fields: Record<string, string> = {},
    file?: { content: Buffer; name: string },
    headers: Record<string, string> = as(user),
  ) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    if (file) {
      form.append('file', new Blob([new Uint8Array(file.content)]), file.name);
    }
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/submissions`,
      { method: 'POST', headers, body: form },
    );
    const json = (await response.json().catch(() => ({}))) as {
      data?: Record<string, any>;
      error?: { code?: string; lockedUntil?: string };
    };
    return {
      status: response.status,
      code: json.error?.code,
      data: json.data,
      lockedUntil: json.error?.lockedUntil,
    };
  };

  describe('the Learner view', () => {
    test('shows the prompt, the Rubric and the attempts, and is for Learners only', async () => {
      const r = await api(
        'GET',
        `/learner/assignments/${reviewed}`,
        undefined,
        as(LEARNER),
      );
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.title, 'Reviewed');
      assert.equal(r.data.prompt, 'Write it');
      assert.equal(r.data.rubric.length, 1);
      assert.equal(r.data.attempts.remainingAttempts, 3);
      assert.equal(r.data.attempts.lockedUntil, null);
      assert.equal(r.data.readOnly, false);

      const asInstructor = await api('GET', `/learner/assignments/${reviewed}`);
      assert.equal(asInstructor.status, 403);
      const unknown = await api(
        'GET',
        '/learner/assignments/00000000-0000-4000-8000-0000000000ff',
        undefined,
        as(LEARNER),
      );
      assert.equal(unknown.status, 404);
      assert.equal(
        (await api('GET', '/learner/assignments/abc', undefined, as(LEARNER)))
          .status,
        400,
      );
    });
  });

  describe('submit (UC30)', () => {
    test('a text submission joins a new cycle (BR-312) and is counted (BR-176)', async () => {
      const r = await submit(reviewed, LEARNER, { content: 'my answer' });
      assert.equal(r.status, 201, JSON.stringify(r));
      assert.equal(r.data?.gradingStatus, 'AwaitingPeerReview');
      assert.equal(r.data?.submissionNumber, 1);
      assert.equal(r.data?.attempts.remainingAttempts, 2);
      assert.ok(r.data?.cycle);
      assert.equal(
        new Date(r.data?.cycle.closesAt).getTime() -
          new Date(r.data?.cycle.opensAt).getTime() >=
          7 * 23 * 3_600_000,
        true,
        'the cycle is the 7 days of the platform default',
      );

      assert.equal(await count('SELECT count(*) FROM peer_review_cycles'), 1);
      const [row] = await db.query(
        'SELECT consecutive_count, locked_until FROM learner_assessment_states WHERE learner_id = $1',
        [LEARNER],
      );
      assert.equal(row.consecutive_count, 1);
      assert.equal(row.locked_until, null);
      assert.equal(
        await count(
          "SELECT count(*) FROM outbox_events WHERE event_type = 'LearnerAssessmentStatusChanged'",
        ),
        1,
      );
    });

    test('another Learner in the same cycle joins it instead of opening one (BR-167)', async () => {
      const r = await submit(reviewed, LEARNER_2, { content: 'second' });
      assert.equal(r.status, 201);
      assert.equal(await count('SELECT count(*) FROM peer_review_cycles'), 1);
      assert.equal(
        await count('SELECT count(DISTINCT cycle_id) FROM submissions'),
        1,
      );
    });

    test('without peer review the Instructor grades directly', async () => {
      const r = await submit(direct, LEARNER, { content: 'x' });
      assert.equal(r.status, 201);
      assert.equal(r.data?.gradingStatus, 'AwaitingInstructor');
      assert.equal(r.data?.cycle, null);
      const [row] = await db.query(
        'SELECT intervention_reason FROM submissions WHERE assessment_id = $1',
        [direct],
      );
      assert.equal(row.intervention_reason, 'PEER_REVIEW_DISABLED');
    });

    test('the Learner view then shows the submission and the attempts left', async () => {
      const r = await api(
        'GET',
        `/learner/assignments/${reviewed}`,
        undefined,
        as(LEARNER),
      );
      assert.equal(r.data.attempts.remainingAttempts, 2);
      assert.equal(r.data.latestSubmission.gradingStatus, 'AwaitingPeerReview');
    });

    test('a second submission is refused until resubmitting exists (UC30.1)', async () => {
      const r = await submit(reviewed, LEARNER, { content: 'again' });
      assert.equal(r.status, 409);
      assert.equal(r.code, 'SUBMISSION_EXISTS');
      assert.equal(
        await count(
          'SELECT count(*) FROM submissions WHERE assessment_id = $1 AND learner_id = $2',
          [reviewed, LEARNER],
        ),
        1,
      );
    });

    test('guards: Learners only (403), valid ids (400), existing Assignment (404)', async () => {
      assert.equal(
        (
          await submit(
            reviewed,
            LEARNER,
            { content: 'x' },
            undefined,
            identity(),
          )
        ).status,
        403,
      );
      assert.equal(
        (await submit('abc', LEARNER_3, { content: 'x' })).status,
        400,
      );
      assert.equal(
        (
          await submit('00000000-0000-4000-8000-0000000000ff', LEARNER_3, {
            content: 'x',
          })
        ).status,
        404,
      );
    });

    test('empty work and a wrong file are refused and nothing is stored', async () => {
      const before = await count('SELECT count(*) FROM submissions');
      assert.equal(
        (await submit(reviewed, LEARNER_3, { content: '   ' })).code,
        'SUBMISSION_EMPTY',
      );
      const exe = await submit(
        reviewed,
        LEARNER_3,
        {},
        {
          content: Buffer.from('MZ not allowed'),
          name: 'virus.exe',
        },
      );
      assert.equal(exe.status, 400);
      assert.equal(exe.code, 'SUBMISSION_FILE_INVALID');
      const fake = await submit(
        reviewed,
        LEARNER_3,
        {},
        {
          content: Buffer.from('plain text'),
          name: 'fake.pdf',
        },
      );
      assert.equal(fake.code, 'SUBMISSION_FILE_INVALID');
      assert.equal(await count('SELECT count(*) FROM submissions'), before);
      assert.equal(
        await count(
          'SELECT count(*) FROM learner_assessment_states WHERE learner_id = $1',
          [LEARNER_3],
        ),
        0,
        'a refused request leaves no counter behind',
      );
    });

    test('a Completed Enrollment is read-only (BR-210)', async () => {
      learning.setAnswer(LEARNER_3, COURSE, 'ReadOnly');
      const r = await submit(reviewed, LEARNER_3, { content: 'too late' });
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ENROLLMENT_COMPLETED');
      const view = await api(
        'GET',
        `/learner/assignments/${reviewed}`,
        undefined,
        as(LEARNER_3),
      );
      assert.equal(view.data.readOnly, true);
    });
  });

  describe('the lock (BR-176, BR-178, BR-179)', () => {
    test('n submissions lock the Assignment for m hours, for this Learner only', async () => {
      const r = await api('POST', '/assignments', {
        courseId: COURSE,
        title: 'One shot',
        prompt: 'Write it',
        passingScore: 70,
        expectedDurationMinutes: 30,
        maxConsecutiveAttempts: 1,
        lockoutHours: 2,
        rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
      });
      const oneShot = r.data.id as string;

      const done = await submit(oneShot, LEARNER, { content: 'x' });
      assert.equal(done.status, 201);
      assert.equal(done.data?.attempts.remainingAttempts, 0);
      const locked = new Date(done.data?.attempts.lockedUntil).getTime();
      assert.ok(Math.abs(locked - Date.now() - 2 * 3_600_000) < 60_000);

      const again = await submit(oneShot, LEARNER, { content: 'y' });
      assert.equal(again.status, 409);
      assert.equal(again.code, 'ASSESSMENT_LOCKED');
      assert.equal(new Date(again.lockedUntil!).getTime(), locked);

      const view = await api(
        'GET',
        `/learner/assignments/${oneShot}`,
        undefined,
        as(LEARNER),
      );
      assert.equal(view.data.attempts.remainingAttempts, 0);
      assert.equal(new Date(view.data.attempts.lockedUntil).getTime(), locked);

      // the lock is per Learner (BR-178)
      assert.equal(
        (await submit(oneShot, LEARNER_2, { content: 'x' })).status,
        201,
      );
    });
  });

  describe('parallel submits (locks)', () => {
    test('the same Learner twice at once saves exactly one submission', async () => {
      const [a, b] = await Promise.all([
        submit(direct, LEARNER_4, { content: 'one' }),
        submit(direct, LEARNER_4, { content: 'two' }),
      ]);
      assert.deepEqual([a.status, b.status].sort(), [201, 409]);
      assert.equal(
        await count(
          'SELECT count(*) FROM submissions WHERE assessment_id = $1 AND learner_id = $2',
          [direct, LEARNER_4],
        ),
        1,
      );
    });

    test('Learners submitting at once into a day without a cycle open only one cycle', async () => {
      const r = await api('POST', '/assignments', {
        courseId: COURSE,
        title: 'Fresh',
        prompt: 'Write it',
        passingScore: 70,
        expectedDurationMinutes: 30,
        rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
      });
      const fresh = r.data.id as string;
      await api('PUT', `/assignments/${fresh}/peer-review`, {
        enabled: true,
        reviewersPerSubmission: 2,
        scoreGap: 20,
      });
      const users = [LEARNER, LEARNER_2, LEARNER_4];
      const results = await Promise.all(
        users.map((u) => submit(fresh, u, { content: u })),
      );
      assert.deepEqual(
        results.map((x) => x.status),
        [201, 201, 201],
      );
      assert.equal(
        await count(
          'SELECT count(*) FROM peer_review_cycles WHERE assessment_id = $1',
          [fresh],
        ),
        1,
      );
    });
  });
});
