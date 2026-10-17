/**
 * The internal endpoint of learning-service (UC25.4, BR-131) through the real HTTP API and a real Postgres: a Quiz
 * attempt, a submission and a given peer review each make a flag true, only inside the Course and the Organization
 * asked about. The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
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
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const OTHER_COURSE = '00000000-0000-4000-8000-0000000000e9';
const OTHER_LEARNER = '00000000-0000-4000-8000-0000000000c2';
const INSTRUCTOR_ID = '00000000-0000-4000-8000-000000000002';
const as = (user: string, org = ORG) =>
  identity({ user, org, role: 'LEARNER' });

describe('assessment activity over HTTP (UC25.4)', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignmentId: string;
  let submissionId: string;

  const activity = (
    learner = LEARNER,
    courseId = COURSE,
    headers = as(learner),
  ) =>
    api(
      'GET',
      `/../internal/learners/${learner}/courses/${courseId}/assessment-activity`,
      undefined,
      headers,
    );

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
    });
    api = apiFor(service.baseUrl);
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Essay',
      prompt: 'Write it',
      passingScore: 70,
      expectedDurationMinutes: 30,
      rubric: [{ name: 'A', description: 'a', maxPoints: 10 }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assignmentId = created.data.id;
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  test('a Learner with nothing in the Course: three false flags (200)', async () => {
    const r = await activity();
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.data, {
      hasQuizAttempt: false,
      hasSubmission: false,
      hasPeerReviewGiven: false,
    });
  });

  test('a submission makes hasSubmission true, a replaced one still counts', async () => {
    const form = new FormData();
    form.append('content', 'first');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/submissions`,
      { method: 'POST', headers: as(LEARNER), body: form },
    );
    assert.equal(response.status, 201, await response.text());
    assert.equal((await activity()).data.hasSubmission, true);

    [{ id: submissionId }] = (await db.query(
      'SELECT id FROM submissions WHERE learner_id = $1',
      [LEARNER],
    )) as { id: string }[];
    await db.query(
      'UPDATE submissions SET superseded_at = now() WHERE id = $1',
      [submissionId],
    );
    const r = await activity();
    assert.deepEqual(r.data, {
      hasQuizAttempt: false,
      hasSubmission: true,
      hasPeerReviewGiven: false,
    });
  });

  test('a Quiz attempt counts from its start, even when it is not finished', async () => {
    const [{ id: quizId }] = await db.query(
      `INSERT INTO assessments (id, organization_id, course_id, kind, title, position, passing_score, max_consecutive_attempts,
                                lockout_hours, is_required, time_limit_minutes, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'QUIZ', 'Quiz', 1, 70, 3, 24, true, 10, now(), now()) RETURNING id`,
      [ORG, COURSE],
    );
    await db.query(
      `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at,
                                  created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, now(), now() + interval '10 minutes', now(), now())`,
      [ORG, quizId, OTHER_LEARNER],
    );
    // the attempt is OTHER_LEARNER's: LEARNER is still without one
    assert.equal((await activity()).data.hasQuizAttempt, false);
    const other = await activity(OTHER_LEARNER);
    assert.equal(other.data.hasQuizAttempt, true);
    assert.equal(other.data.hasSubmission, false);
  });

  test('a peer review counts only when completed and not written as the Instructor (BR-131)', async () => {
    const review = (role: string, reviewer: string, status: string) =>
      db.query(
        `INSERT INTO submission_reviews (id, organization_id, submission_id, reviewer_id, reviewer_role, status, comment, completed_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'c', now(), now(), now())`,
        [ORG, submissionId, reviewer, role, status],
      );
    await review('Learner', OTHER_LEARNER, 'Pending'); // assigned, not given
    await review('Instructor', INSTRUCTOR_ID, 'Completed'); // the Instructor is not a peer
    assert.equal((await activity(OTHER_LEARNER)).data.hasPeerReviewGiven, false);
    await review('Learner', OTHER_LEARNER, 'Completed');
    assert.equal((await activity(OTHER_LEARNER)).data.hasPeerReviewGiven, true);
    // what the author LEARNER received does not make LEARNER a reviewer
    assert.equal((await activity()).data.hasPeerReviewGiven, false);
  });

  test('the answer is about one Course version and one Organization', async () => {
    assert.deepEqual((await activity(LEARNER, OTHER_COURSE)).data, {
      hasQuizAttempt: false,
      hasSubmission: false,
      hasPeerReviewGiven: false,
    });
    const otherOrg = await activity(LEARNER, COURSE, as(LEARNER, OTHER_ORG));
    assert.equal(otherOrg.status, 200);
    assert.equal(otherOrg.data.hasSubmission, false);
  });

  test('guards: a UUID (400), the Learner must be the caller (403), the internal key (401)', async () => {
    assert.equal((await activity('abc' as string)).status, 400);
    const stranger = await activity(
      LEARNER,
      COURSE,
      as('00000000-0000-4000-8000-0000000000ff'),
    );
    assert.equal(stranger.status, 403);
    assert.equal(stranger.code, 'FORBIDDEN');
    const noKey = await activity(LEARNER, COURSE, {
      ...as(LEARNER),
      'x-internal-key': `${KEY}-wrong`,
    });
    assert.equal(noKey.status, 401);
  });
});
