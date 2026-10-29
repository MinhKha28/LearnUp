/**
 * UC30.1 through the real HTTP API and a real Postgres: the replacement of the previous submission, the three places a
 * resubmission can go (BR-171, BR-313), the lock after n in a row (BR-176) and the races of parallel resubmits.
 * Enrollment is answered by a fake Learning Service (assessment-access, ENROLLMENT_CLIENT_MODE=http). The tests are one story and share state.
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
const as = (user: string) => identity({ user, role: 'LEARNER' });

describe('UC30.1 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: LearningStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let reviewed: string; // peer review on
  let direct: string; // graded by the Instructor
  let tight: string; // n = 2, m = 3 hours

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
    const make = async (title: string, extra: object = {}, peer = false) => {
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
      if (peer) {
        const on = await api('PUT', `/assignments/${r.data.id}/peer-review`, {
          enabled: true,
          reviewersPerSubmission: 2,
          scoreGap: 20,
        });
        assert.equal(on.status, 200, JSON.stringify(on.json));
      }
      return r.data.id as string;
    };
    reviewed = await make('Reviewed', {}, true);
    direct = await make('Direct');
    tight = await make(
      'Tight',
      { maxConsecutiveAttempts: 2, lockoutHours: 3 },
      true,
    );
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await learning?.stop();
    await db?.drop();
  });

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query(sql, params))[0].count);

  const send = async (
    kind: 'submissions' | 'resubmissions',
    assignmentId: string,
    user: string,
    fields: Record<string, string> = {},
    headers: Record<string, string> = as(user),
  ) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/${kind}`,
      { method: 'POST', headers, body: form },
    );
    const json = (await response.json().catch(() => ({}))) as {
      data?: Record<string, any>;
      error?: { code?: string };
    };
    return { status: response.status, code: json.error?.code, data: json.data };
  };
  const submit = (id: string, user: string, content = 'first') =>
    send('submissions', id, user, { content });
  const resubmit = (id: string, user: string, content = 'again') =>
    send('resubmissions', id, user, { content });
  const view = async (id: string, user = LEARNER) =>
    (await api('GET', `/learner/assignments/${id}`, undefined, as(user))).data;

  describe('guards', () => {
    test('there must be a previous submission (409), Learners only (403), a UUID (400)', async () => {
      const none = await resubmit(reviewed, LEARNER);
      assert.equal(none.status, 409);
      assert.equal(none.code, 'NO_PREVIOUS_SUBMISSION');
      assert.equal(await count('SELECT count(*) FROM submissions'), 0);
      assert.equal(
        await count('SELECT count(*) FROM learner_assessment_states'),
        0,
      );

      const asInstructor = await send(
        'resubmissions',
        reviewed,
        LEARNER,
        { content: 'x' },
        identity(),
      );
      assert.equal(asInstructor.status, 403);
      assert.equal((await resubmit('abc', LEARNER)).status, 400);
    });

    test('before any submission there is nothing to replace, the view has no outlook', async () => {
      assert.equal((await view(reviewed)).resubmission, null);
    });
  });

  describe('the same cycle (BR-171)', () => {
    test('a resubmission replaces the previous one in the same open cycle', async () => {
      const first = await submit(reviewed, LEARNER);
      assert.equal(first.status, 201);
      assert.equal(first.data?.placement, 'OPEN_CYCLE');

      const outlook = (await view(reviewed)).resubmission;
      assert.equal(outlook.placement, 'REPLACES_IN_CYCLE');
      assert.equal(outlook.cycleClosesAt, first.data?.cycle.closesAt);

      const second = await resubmit(reviewed, LEARNER, 'second');
      assert.equal(second.status, 201, JSON.stringify(second));
      assert.equal(second.data?.placement, 'REPLACES_IN_CYCLE');
      assert.equal(second.data?.gradingStatus, 'AwaitingPeerReview');
      assert.equal(second.data?.replacedSubmissionId, first.data?.id);
      assert.equal(second.data?.submissionNumber, 2);
      assert.equal(second.data?.cycle.id, first.data?.cycle.id);
      assert.equal(second.data?.attempts.remainingAttempts, 1);

      const rows = await db.query(
        'SELECT submission_number, superseded_at, cycle_id, content FROM submissions WHERE assessment_id = $1 ORDER BY submission_number',
        [reviewed],
      );
      assert.equal(rows.length, 2);
      assert.ok(rows[0].superseded_at, 'the first one is superseded');
      assert.equal(rows[1].superseded_at, null);
      assert.equal(rows[0].cycle_id, rows[1].cycle_id);
      assert.equal(
        await count(
          'SELECT count(*) FROM peer_review_cycles WHERE assessment_id = $1',
          [reviewed],
        ),
        1,
      );

      const [state] = await db.query(
        'SELECT consecutive_count, latest_submission_id FROM learner_assessment_states WHERE assessment_id = $1 AND learner_id = $2',
        [reviewed, LEARNER],
      );
      assert.equal(state.consecutive_count, 2);
      assert.equal(state.latest_submission_id, second.data?.id);
      assert.equal((await view(reviewed)).latestSubmission.submissionNumber, 2);
      assert.equal(
        await count(
          "SELECT count(*) FROM outbox_events WHERE payload->>'status' = 'Resubmitted' AND payload->>'assessmentId' = $1",
          [reviewed],
        ),
        1,
      );
    });

    test('the first-submission route still refuses someone who has submitted, and says to resubmit', async () => {
      const again = await submit(reviewed, LEARNER, 'dup');
      assert.equal(again.status, 409);
      assert.equal(again.code, 'SUBMISSION_EXISTS');
    });

    test('empty work and a wrong file are refused and change nothing', async () => {
      const before = await count('SELECT count(*) FROM submissions');
      assert.equal(
        (await resubmit(reviewed, LEARNER, '  ')).code,
        'SUBMISSION_EMPTY',
      );
      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(Buffer.from('MZ'))]),
        'virus.exe',
      );
      const res = await fetch(
        `${service.baseUrl}/api/v1/assessments/learner/assignments/${reviewed}/resubmissions`,
        { method: 'POST', headers: as(LEARNER), body: form },
      );
      assert.equal(res.status, 400);
      assert.equal(await count('SELECT count(*) FROM submissions'), before);
    });
  });

  describe('past the closing line (A1, A2)', () => {
    // D10: "owes the reviews of an earlier cycle" is read from the review rows, so the Learner gets a Missed review
    // of someone else's submission, in a cycle of the Assignment
    const owe = (assignmentId: string, learner: string) =>
      db.query(
        `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status, updated_at)
         SELECT gen_random_uuid(), s.organization_id, s.id, s.cycle_id, $2, 'Learner', 'Missed', now()
         FROM submissions s WHERE s.assessment_id = $1 AND s.learner_id <> $2 AND s.cycle_id IS NOT NULL LIMIT 1`,
        [assignmentId, learner],
      );
    // moves the cycle of the Assignment into the past, as if its closing line had gone by
    const closeCycle = (assignmentId: string) =>
      db.query(
        `UPDATE peer_review_cycles SET opens_at = opens_at - interval '30 days', closes_at = now() - interval '2 days',
                review_due_at = now() + interval '1 day' WHERE assessment_id = $1`,
        [assignmentId],
      );

    test('A1: the Instructor grades a resubmission after the closing line (BR-171)', async () => {
      await submit(reviewed, LEARNER_2);
      await closeCycle(reviewed);
      assert.equal(
        (await view(reviewed, LEARNER_2)).resubmission.placement,
        'INSTRUCTOR',
      );

      const r = await resubmit(reviewed, LEARNER_2, 'late');
      assert.equal(r.status, 201, JSON.stringify(r));
      assert.equal(r.data?.placement, 'INSTRUCTOR');
      assert.equal(r.data?.cycle, null);
      assert.equal(r.data?.gradingStatus, 'AwaitingInstructor');
      const [row] = await db.query(
        'SELECT intervention_reason, cycle_id, grading_status FROM submissions WHERE assessment_id = $1 AND learner_id = $2 AND superseded_at IS NULL',
        [reviewed, LEARNER_2],
      );
      assert.equal(row.intervention_reason, 'RESUBMITTED_AFTER_CUTOFF');
      assert.equal(row.cycle_id, null);
      // no new cycle for it, and the earlier cycle is not touched
      assert.equal(
        await count(
          'SELECT count(*) FROM peer_review_cycles WHERE assessment_id = $1',
          [reviewed],
        ),
        1,
      );
    });

    test('A2: a Learner who owes the reviews of an earlier cycle joins the cycle that is open now (BR-313)', async () => {
      await owe(reviewed, LEARNER);
      assert.equal((await view(reviewed)).resubmission.placement, 'OPEN_CYCLE');

      const r = await resubmit(reviewed, LEARNER, 'making up');
      assert.equal(r.status, 201, JSON.stringify(r));
      assert.equal(r.data?.placement, 'OPEN_CYCLE');
      assert.equal(r.data?.gradingStatus, 'AwaitingPeerReview');
      assert.ok(r.data?.cycle);
      assert.equal(
        await count(
          'SELECT count(*) FROM peer_review_cycles WHERE assessment_id = $1',
          [reviewed],
        ),
        2,
      );

      // a duty that was waived gives no second chance
      await owe(reviewed, LEARNER_2);
      await db.query(
        'UPDATE learner_assessment_states SET exempted_at = now() WHERE assessment_id = $1 AND learner_id = $2',
        [reviewed, LEARNER_2],
      );
      await closeCycle(reviewed);
      const waived = await resubmit(reviewed, LEARNER_2, 'late again');
      assert.equal(waived.data?.placement, 'INSTRUCTOR');
    });

    test('without peer review the Instructor grades a resubmission, as the first one', async () => {
      await submit(direct, LEARNER);
      const r = await resubmit(direct, LEARNER);
      assert.equal(r.status, 201);
      assert.equal(r.data?.placement, 'INSTRUCTOR');
      const [row] = await db.query(
        'SELECT intervention_reason FROM submissions WHERE assessment_id = $1 AND superseded_at IS NULL',
        [direct],
      );
      assert.equal(row.intervention_reason, 'PEER_REVIEW_DISABLED');
    });
  });

  describe('the lock and the Enrollment', () => {
    test('n in a row lock the Assignment for m hours, then it opens again (BR-168, BR-176)', async () => {
      await submit(tight, LEARNER);
      const second = await resubmit(tight, LEARNER);
      assert.equal(second.status, 201);
      assert.equal(second.data?.attempts.remainingAttempts, 0);
      const lockedUntil = new Date(second.data?.attempts.lockedUntil).getTime();
      assert.ok(Math.abs(lockedUntil - Date.now() - 3 * 3_600_000) < 60_000);

      const refused = await resubmit(tight, LEARNER);
      assert.equal(refused.status, 409);
      assert.equal(refused.code, 'ASSESSMENT_LOCKED');

      await db.query(
        "UPDATE learner_assessment_states SET locked_until = now() - interval '1 minute' WHERE assessment_id = $1 AND learner_id = $2",
        [tight, LEARNER],
      );
      const again = await resubmit(tight, LEARNER);
      assert.equal(again.status, 201, 'there is no limit on resubmissions');
      assert.equal(again.data?.submissionNumber, 3);
      assert.equal(again.data?.attempts.remainingAttempts, 1);
    });

    test('a Completed Enrollment is read-only (BR-210)', async () => {
      learning.setAnswer(LEARNER, COURSE, 'ReadOnly');
      const r = await resubmit(direct, LEARNER, 'too late');
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ENROLLMENT_COMPLETED');
      assert.equal((await view(direct)).resubmission, null);
      learning.setAnswer(LEARNER, COURSE, 'Full');
    });
  });

  describe('parallel resubmits (locks)', () => {
    test('two resubmissions at once of the same Learner are taken one after the other', async () => {
      await submit(direct, LEARNER_3);
      const [a, b] = await Promise.all([
        resubmit(direct, LEARNER_3, 'one'),
        resubmit(direct, LEARNER_3, 'two'),
      ]);
      assert.deepEqual([a.status, b.status], [201, 201]);
      assert.deepEqual(
        [a.data?.submissionNumber, b.data?.submissionNumber].sort(),
        [2, 3],
      );
      assert.equal(
        await count(
          'SELECT count(*) FROM submissions WHERE assessment_id = $1 AND learner_id = $2 AND superseded_at IS NULL',
          [direct, LEARNER_3],
        ),
        1,
        'exactly one submission counts',
      );
      const [state] = await db.query(
        'SELECT consecutive_count FROM learner_assessment_states WHERE assessment_id = $1 AND learner_id = $2',
        [direct, LEARNER_3],
      );
      assert.equal(state.consecutive_count, 3);
    });
  });
});
