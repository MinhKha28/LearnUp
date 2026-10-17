/**
 * UC30.2 through the real HTTP API and a real Postgres: only a Finalized submission has a result (PRE-1), the result
 * shows the final score, the averages per criterion and the comments (BR-208, BR-322) and never a reviewer (BR-191).
 * Enrollment is answered by the fake client (ENROLLMENT_CLIENT_MODE=fake). The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  INSTRUCTOR,
  LEARNER,
  ORG,
  startCourseStub,
  startService,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const OTHER_LEARNER = '00000000-0000-4000-8000-0000000000c2';
const PEER_1 = '00000000-0000-4000-8000-0000000000d1';
const PEER_2 = '00000000-0000-4000-8000-0000000000d2';
const as = (user: string) => identity({ user, role: 'LEARNER' });

describe('UC30.2 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignmentId: string;
  let submissionId: string;
  let criteria: { id: string }[];

  const submit = async (id: string, user: string) => {
    const form = new FormData();
    form.append('content', 'my work');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${id}/submissions`,
      { method: 'POST', headers: as(user), body: form },
    );
    const json = (await response.json()) as { data: { id: string } };
    assert.equal(response.status, 201, JSON.stringify(json));
    return json.data.id;
  };
  const resultPath = (sub: string) =>
    `/learner/assignments/${assignmentId}/submissions/${sub}/result`;
  const result = (sub: string, user = LEARNER) =>
    api('GET', resultPath(sub), undefined, as(user));

  const review = async (
    role: string,
    reviewer: string,
    points: number[],
    comment: string,
    status = 'Completed',
  ) => {
    const [{ id }] = await db.query(
      `INSERT INTO submission_reviews (id, organization_id, submission_id, reviewer_id, reviewer_role, status, comment, completed_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now(), now()) RETURNING id`,
      [ORG, submissionId, reviewer, role, status, comment],
    );
    for (const [i, p] of points.entries()) {
      await db.query(
        `INSERT INTO submission_review_scores (id, organization_id, review_id, criterion_id, points, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())`,
        [ORG, id, criteria[i].id, p],
      );
    }
  };

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
      rubric: [
        { name: 'Content', description: 'c', maxPoints: 10 },
        { name: 'Style', description: 's', maxPoints: 10 },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assignmentId = created.data.id;
    submissionId = await submit(assignmentId, LEARNER);
    criteria = (await db.query(
      'SELECT id FROM rubric_criteria WHERE assessment_id = $1 ORDER BY position',
      [assignmentId],
    )) as { id: string }[];
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  test('PRE-1: a submission that is not Finalized has no result yet (409)', async () => {
    const r = await result(submissionId);
    assert.equal(r.status, 409);
    assert.equal(r.code, 'SUBMISSION_NOT_FINALIZED');
  });

  test('guards: Learners only (403), a UUID (400), a submission of someone else (404)', async () => {
    assert.equal((await api('GET', resultPath(submissionId))).status, 403);
    assert.equal((await result('abc')).status, 400);
    const other = await result(submissionId, OTHER_LEARNER);
    assert.equal(other.status, 404);
    assert.equal(other.code, 'SUBMISSION_NOT_FOUND');
  });

  test('a Finalized submission shows the final score, the averages per criterion and the comments, without reviewers', async () => {
    await review('LEARNER', PEER_1, [8, 6], 'Clear structure');
    await review('LEARNER', PEER_2, [6, 6], 'Needs more examples');
    await review('Instructor', INSTRUCTOR, [10, 8], 'Good work overall');
    // not valid: never completed, so it must not count
    await review('LEARNER', PEER_2, [0, 0], 'Never finished', 'Pending');
    await db.query(
      `UPDATE submissions SET grading_status = 'Finalized', final_score = 80, finalization_comment = 'Raised for the effort',
         finalized_at = now(), finalized_by = $2 WHERE id = $1`,
      [submissionId, INSTRUCTOR],
    );

    const r = await result(submissionId);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.finalScore, 80);
    assert.equal(r.data.passed, true);
    assert.equal(r.data.finalizationComment, 'Raised for the effort');
    assert.equal(r.data.assignment.passingScore, 70);
    assert.deepEqual(
      r.data.criteria.map((c: any) => [c.name, c.maxPoints, c.averagePoints]),
      [
        ['Content', 10, 8],
        ['Style', 10, 6.67],
      ],
    );
    assert.deepEqual(
      r.data.comments.map((c: any) => [c.source, c.comment]).sort(),
      [
        ['INSTRUCTOR', 'Good work overall'],
        ['PEER', 'Clear structure'],
        ['PEER', 'Needs more examples'],
      ],
    );
    // BR-191: no reviewer id or role anywhere in the answer
    const text = JSON.stringify(r.json);
    for (const hidden of [PEER_1, PEER_2, INSTRUCTOR, 'reviewerId', 'reviewerRole']) {
      assert.equal(text.includes(hidden), false, hidden);
    }
  });

  test('below the passing score the result says not passed', async () => {
    await db.query('UPDATE submissions SET final_score = 55 WHERE id = $1', [
      submissionId,
    ]);
    const r = await result(submissionId);
    assert.equal(r.data.finalScore, 55);
    assert.equal(r.data.passed, false);
  });
});
