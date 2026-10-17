/**
 * UC33 through the real HTTP API and a real Postgres: the cycles of an Assignment with their three milestones, the
 * submissions in each and the status (BR-186, BR-200). The submissions come from the Learner API (UC30), so the cycles
 * are the ones the calendar of BR-312 really makes. The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  LEARNER,
  OTHER_INSTRUCTOR,
  OTHER_ORG,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const LEARNERS = [
  LEARNER,
  '00000000-0000-4000-8000-0000000000c2',
  '00000000-0000-4000-8000-0000000000c3',
];

describe('UC33 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let reviewed: string; // peer review on, N = 2
  let direct: string; // peer review off

  const create = async (title: string) => {
    const r = await api('POST', '/assignments', {
      courseId: COURSE,
      title,
      prompt: 'Write it',
      passingScore: 70,
      expectedDurationMinutes: 30,
      rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.data.id as string;
  };
  const submit = async (assignmentId: string, user: string) => {
    const form = new FormData();
    form.append('content', 'my work');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/submissions`,
      {
        method: 'POST',
        headers: identity({ user, role: 'LEARNER' }),
        body: form,
      },
    );
    assert.equal(response.status, 201, await response.text());
  };
  const cycles = (id = reviewed, headers = identity()) =>
    api('GET', `/assignments/${id}/peer-review/cycles`, undefined, headers);

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
    });
    api = apiFor(service.baseUrl);
    reviewed = await create('Reviewed');
    direct = await create('Direct');
    const on = await api('PUT', `/assignments/${reviewed}/peer-review`, {
      enabled: true,
      reviewersPerSubmission: 2,
      scoreGap: 20,
    });
    assert.equal(on.status, 200, JSON.stringify(on.json));
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  test('PRE-1: peer review must be on (409); Instructors in charge only (403, 404)', async () => {
    const off = await cycles(direct);
    assert.equal(off.status, 409);
    assert.equal(off.code, 'PEER_REVIEW_NOT_ENABLED');
    assert.equal(
      (await cycles(reviewed, identity({ user: LEARNER, role: 'LEARNER' })))
        .status,
      403,
    );
    assert.equal((await cycles(reviewed, identity({ user: OTHER_INSTRUCTOR }))).status, 404);
    assert.equal((await cycles(reviewed, identity({ org: OTHER_ORG }))).status, 404);
    assert.equal((await cycles(UNKNOWN)).status, 404);
    assert.equal((await cycles('abc')).status, 400);
  });

  test('no submission yet: no cycle (BR-312 makes a cycle only for a submission)', async () => {
    const r = await cycles();
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.title, 'Reviewed');
    assert.deepEqual(r.data.items, []);
    assert.equal(r.data.settings.reviewersPerSubmission, 2);
    assert.equal(r.data.settings.scoreGap, 20);
  });

  test('a cycle with its three milestones and the submissions, still Open', async () => {
    await submit(reviewed, LEARNERS[0]);
    await submit(reviewed, LEARNERS[1]);
    const { data } = await cycles();
    assert.equal(data.items.length, 1);
    const [cycle] = data.items;
    assert.equal(cycle.submissionCount, 2);
    assert.equal(cycle.status, 'Open');
    const opens = Date.parse(cycle.opensAt);
    const closes = Date.parse(cycle.closesAt);
    const due = Date.parse(cycle.reviewDueAt);
    assert.ok(opens < closes && closes < due, 'opens < closes < review due');
  });

  test('a replaced submission is not counted twice (BR-171)', async () => {
    const form = new FormData();
    form.append('content', 'better');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${reviewed}/resubmissions`,
      {
        method: 'POST',
        headers: identity({ user: LEARNERS[0], role: 'LEARNER' }),
        body: form,
      },
    );
    assert.equal(response.status, 201, await response.text());
    assert.equal((await cycles()).data.items[0].submissionCount, 2);
  });

  test('past the closing line: fewer than N + 1 submissions is InstructorOnly, enough is Assigned (BR-206)', async () => {
    await db.query(
      `UPDATE peer_review_cycles SET opens_at = opens_at - interval '30 days', closes_at = now() - interval '1 day',
         review_due_at = now() + interval '2 days' WHERE assessment_id = $1`,
      [reviewed],
    );
    assert.equal((await cycles()).data.items[0].status, 'InstructorOnly');

    // a third submission in the same cycle: N + 1 = 3, so the closing assigns them
    await db.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content, submitted_at,
                                cycle_id, grading_status, created_at, updated_at)
       SELECT gen_random_uuid(), organization_id, assessment_id, $2, 1, 'third', now() - interval '2 days', id,
              'AwaitingPeerReview', now(), now()
       FROM peer_review_cycles WHERE assessment_id = $1`,
      [reviewed, LEARNERS[2]],
    );
    const { data } = await cycles();
    assert.equal(data.items[0].submissionCount, 3);
    assert.equal(data.items[0].status, 'Assigned');
  });

  test('a status written by the closing is shown, and the cycles are listed oldest first', async () => {
    await db.query(
      `UPDATE peer_review_cycles SET status = 'Completed' WHERE assessment_id = $1`,
      [reviewed],
    );
    const { data } = await cycles();
    assert.ok(data.items.every((c: any) => c.status === 'Completed'));
    const opens = data.items.map((c: any) => Date.parse(c.opensAt));
    assert.deepEqual(opens, [...opens].sort((a, b) => a - b));
  });
});
