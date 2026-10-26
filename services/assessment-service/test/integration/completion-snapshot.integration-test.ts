/**
 * The completion snapshot (CT-1) through the real HTTP API and a real Postgres: the way learning-service calls it (the
 * internal key and the Organization, no user), what it counts, and that every answer passes the validator of learning.
 * The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { brokenRules } from '../unit/completion-contract';
import {
  COURSE,
  createTestDatabase,
  KEY,
  LEARNER,
  ORG,
  OTHER_ORG,
  startService,
  type RunningService,
  type TestDatabase,
} from './harness';

const OTHER_LEARNER = '00000000-0000-4000-8000-0000000000c2';
const OTHER_COURSE = '00000000-0000-4000-8000-0000000000e9';

describe('completion snapshot over HTTP (CT-1)', () => {
  let db: TestDatabase;
  let service: RunningService;
  let requiredQuiz: string;
  let optionalQuiz: string;
  let assignment: string;
  let disabledAssignment: string;
  let cycle: string;
  let submission: string;

  const call = (
    learner = LEARNER,
    course = COURSE,
    headers: Record<string, string> = {
      'x-internal-key': KEY,
      'x-organization-id': ORG,
    },
    query = '',
  ) =>
    fetch(
      `${service.baseUrl}/api/v1/internal/learners/${learner}/courses/${course}/completion-snapshot${query}`,
      { headers },
    );
  /** A 200 answer, checked against the rules of learning at the same time. */
  const snapshot = async (learner = LEARNER, course = COURSE, org = ORG) => {
    const response = await call(learner, course, {
      'x-internal-key': KEY,
      'x-organization-id': org,
    });
    const json = (await response.json()) as { data: any };
    assert.equal(response.status, 200, JSON.stringify(json));
    assert.deepEqual(
      brokenRules(json.data, org, learner, course),
      [],
      JSON.stringify(json.data),
    );
    return json.data;
  };
  const assessment = async (
    kind: string,
    required: boolean,
    position: number,
    disabled = false,
  ) => {
    const [{ id }] = await db.query(
      `INSERT INTO assessments (id, organization_id, course_id, kind, title, position, passing_score, max_consecutive_attempts,
                                lockout_hours, is_required, peer_review_enabled, disabled_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 70, 3, 24, $6, $7, $8, now(), now()) RETURNING id`,
      [
        ORG,
        COURSE,
        kind,
        `${kind} ${position}`,
        position,
        required,
        kind === 'ASSIGNMENT',
        disabled ? new Date() : null,
      ],
    );
    return id as string;
  };

  before(async () => {
    db = await createTestDatabase();
    service = await startService(db.url, { ENROLLMENT_CLIENT_MODE: 'fake' });
  });
  after(async () => {
    await service?.stop();
    await db?.drop();
  });

  test('the caller sends the internal key and the Organization, and no user: 200', async () => {
    const data = await snapshot();
    assert.equal(data.schemaVersion, 1);
    assert.equal(data.learnerId, LEARNER);
  });

  test('without the key, with a wrong key, or without the Organization: 401', async () => {
    assert.equal(
      (await call(LEARNER, COURSE, { 'x-organization-id': ORG })).status,
      401,
    );
    assert.equal(
      (
        await call(LEARNER, COURSE, {
          'x-internal-key': 'wrong',
          'x-organization-id': ORG,
        })
      ).status,
      401,
    );
    assert.equal(
      (await call(LEARNER, COURSE, { 'x-internal-key': KEY })).status,
      401,
    );
    assert.equal(
      (
        await call(LEARNER, COURSE, {
          'x-internal-key': KEY,
          'x-organization-id': 'not-a-uuid',
        })
      ).status,
      401,
    );
  });

  test('the other routes still ask for a user: the key and the Organization alone do not open them', async () => {
    const serviceCaller = { 'x-internal-key': KEY, 'x-organization-id': ORG };
    for (const path of [
      `/api/v1/assessments/assignments?courseId=${COURSE}`,
      `/api/v1/assessments/quizzes?courseId=${COURSE}`,
      `/api/v1/assessments/learner/courses/${COURSE}/assessments`,
      `/api/v1/internal/learners/${LEARNER}/courses/${COURSE}/assessment-activity`,
    ]) {
      const response = await fetch(`${service.baseUrl}${path}`, {
        headers: serviceCaller,
      });
      assert.equal(response.status, 401, path);
    }
  });

  test('an Organization in the query that differs from the header is 404; the same one is 200; bad IDs are 400', async () => {
    const headers = { 'x-internal-key': KEY, 'x-organization-id': ORG };
    assert.equal(
      (await call(LEARNER, COURSE, headers, `?organizationId=${OTHER_ORG}`))
        .status,
      404,
    );
    assert.equal(
      (await call(LEARNER, COURSE, headers, `?organizationId=${ORG}`)).status,
      200,
    );
    assert.equal((await call('nope', COURSE)).status, 400);
    assert.equal((await call(LEARNER, 'nope')).status, 400);
  });

  test('a Course with no Assessment at all: eligible, nothing required', async () => {
    const data = await snapshot(LEARNER, OTHER_COURSE);
    assert.equal(data.eligible, true);
    assert.equal(data.requiredComponentCount, 0);
  });

  test('only the required components count: Assignments, required Quizzes; not optional Quizzes or Disabled ones', async () => {
    requiredQuiz = await assessment('QUIZ', true, 1);
    optionalQuiz = await assessment('QUIZ', false, 2);
    assignment = await assessment('ASSIGNMENT', true, 3);
    disabledAssignment = await assessment('ASSIGNMENT', true, 4, true);
    const data = await snapshot();
    assert.equal(data.requiredComponentCount, 2);
    assert.deepEqual(
      [
        ...data.quizzes.map((q: any) => q.assessmentId),
        ...data.assignments.map((a: any) => a.assessmentId),
      ].sort(),
      [requiredQuiz, assignment].sort(),
    );
    assert.ok(
      ![optionalQuiz, disabledAssignment].includes(
        data.quizzes[0].assessmentId,
      ),
    );
    assert.equal(data.eligible, false);
  });

  test('a Quiz: an open attempt is no result; the best submitted attempt is; passing ends the Quiz', async () => {
    const attempt = (n: number, score: string | null, submitted: boolean) =>
      db.query(
        `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at,
                                    submitted_at, score, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now() - interval '1 hour', now() - interval '50 minutes',
                 ${submitted ? "now() - interval '55 minutes'" : 'NULL'}, $5, now(), now())`,
        [ORG, requiredQuiz, LEARNER, n, score],
      );
    await attempt(1, null, false);
    let q = (await snapshot()).quizzes[0];
    assert.equal(q.attemptId, null);
    assert.equal(q.passed, false);

    await attempt(2, '55.5', true);
    await attempt(3, '80', true);
    await attempt(4, '60', true);
    q = (await snapshot()).quizzes[0];
    assert.equal(q.recordedScore, '80.00');
    assert.equal(q.passingScore, '70.00');
    assert.equal(q.passed, true);
    const [{ id }] = await db.query(
      'SELECT id FROM quiz_attempts WHERE assessment_id = $1 AND attempt_number = 3',
      [requiredQuiz],
    );
    assert.equal(q.attemptId, id);
  });

  test('an Assignment waiting for a grade shows the submission and no score; a replaced one is ignored', async () => {
    const insert = (
      n: number,
      status: string,
      replaced: boolean,
      score?: string,
    ) =>
      db.query(
        `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content, submitted_at,
                                  superseded_at, grading_status, final_score, finalized_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'work', now() - interval '3 days', ${replaced ? 'now()' : 'NULL'},
                 $5, $6, ${score ? "now() - interval '1 day'" : 'NULL'}, now(), now()) RETURNING id`,
        [ORG, assignment, LEARNER, n, status, score ?? null],
      );
    await insert(1, 'Finalized', true, '99'); // replaced: its score must not count
    submission = (await insert(2, 'AwaitingInstructor', false))[0].id as string;
    const a = (await snapshot()).assignments[0];
    assert.equal(a.submissionId, submission);
    assert.equal(a.finalScore, null);
    assert.equal(a.finalizedAt, null);
    assert.equal(a.passed, false);
  });

  test('the Instructor finalizes the grade: passed, with its score and time; the Course is eligible once peer review allows', async () => {
    await db.query(
      `UPDATE submissions SET grading_status = 'Finalized', final_score = 88.5, finalized_at = '2026-10-25T08:30:00Z' WHERE id = $1`,
      [submission],
    );
    const data = await snapshot();
    const a = data.assignments[0];
    assert.equal(a.finalScore, '88.50');
    assert.equal(a.finalizedAt, '2026-10-25T08:30:00.000Z');
    assert.equal(a.passed, true);
    assert.equal(a.peerReview.status, 'NotApplicable'); // no review owed yet
    assert.equal(data.eligible, true);
  });

  test('peer review: owing a review blocks, doing it frees, missing it blocks; the Instructor review is not counted', async () => {
    cycle = (
      await db.query(
        `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
                                       reviewers_per_submission, score_gap, reminder_hours, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '9 days', now() - interval '2 days', now() + interval '3 days',
               2, 20, 24, 'Assigned', now(), now()) RETURNING id`,
        [ORG, assignment],
      )
    )[0].id as string;
    const review = (role: string, reviewer: string, status: string) =>
      db.query(
        `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status,
                                         created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now()) RETURNING id`,
        [ORG, submission, cycle, reviewer, role, status],
      );
    // someone else's work, which LEARNER has to review
    const [{ id: other }] = await db.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content, submitted_at,
                                cycle_id, grading_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, 'other', now() - interval '3 days', $4, 'AwaitingPeerReview', now(), now())
       RETURNING id`,
      [ORG, assignment, OTHER_LEARNER, cycle],
    );
    await db.query(
      `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status,
                                       created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', 'Pending', now(), now())`,
      [ORG, other, cycle, LEARNER],
    );
    await review('Instructor', LEARNER, 'Pending'); // an Instructor row never counts
    let data = await snapshot();
    assert.deepEqual(data.assignments[0].peerReview, {
      status: 'Pending',
      requiredCount: 1,
      completedCount: 0,
    });
    assert.equal(data.eligible, false);

    await db.query(
      `UPDATE submission_reviews SET status = 'Completed', completed_at = now() WHERE submission_id = $1 AND reviewer_id = $2 AND reviewer_role = 'Learner'`,
      [other, LEARNER],
    );
    data = await snapshot();
    assert.deepEqual(data.assignments[0].peerReview, {
      status: 'Satisfied',
      requiredCount: 1,
      completedCount: 1,
    });
    assert.equal(data.eligible, true);

    await db.query(
      `UPDATE submission_reviews SET status = 'Pending', completed_at = NULL WHERE submission_id = $1 AND reviewer_id = $2 AND reviewer_role = 'Learner'`,
      [other, LEARNER],
    );
    await db.query(
      `UPDATE peer_review_cycles SET review_due_at = now() - interval '1 hour' WHERE id = $1`,
      [cycle],
    );
    data = await snapshot(); // the deadline passed and nothing marked the review yet: Missed on read
    assert.equal(data.assignments[0].peerReview.status, 'Missed');
    assert.equal(data.eligible, false);
  });

  test('another Learner, another Organization and another Course see none of this', async () => {
    const stranger = await snapshot(OTHER_LEARNER);
    assert.equal(stranger.quizzes[0].attemptId, null);
    assert.equal(stranger.assignments[0].peerReview.status, 'NotApplicable');
    assert.equal(stranger.eligible, false);
    const elsewhere = await snapshot(LEARNER, COURSE, OTHER_ORG);
    assert.equal(elsewhere.requiredComponentCount, 0);
  });

  test('asked twice with nothing changed: the same revision and id', async () => {
    const first = await snapshot();
    const second = await snapshot();
    assert.equal(first.revision, second.revision);
    assert.equal(first.snapshotId, second.snapshotId);
    assert.ok(Date.parse(second.asOf) >= Date.parse(first.asOf));
  });

  test('forty readings at the same time all answer the same', async () => {
    const all = await Promise.all(Array.from({ length: 40 }, () => snapshot()));
    assert.equal(new Set(all.map((s) => s.revision)).size, 1);
  });
});
