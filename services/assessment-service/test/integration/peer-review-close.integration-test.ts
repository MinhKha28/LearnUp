/**
 * UC33 closing a cycle through the real HTTP API and a real Postgres (BR-242, BR-248, BR-249): the reviews are handed
 * out around a random ring, too few submissions go to the Instructor, and closing again changes nothing.
 * The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  OTHER_INSTRUCTOR,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const learner = (i: number) =>
  `00000000-0000-4000-8000-${(0xc1 + i).toString(16).padStart(12, '0')}`;

describe('UC33 closing a cycle over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignment: string;
  let direct: string;

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
  const cycles = async () =>
    (await api('GET', `/assignments/${assignment}/peer-review/cycles`)).data
      .items as {
      id: string;
      status: string;
      closed: boolean;
      submissionCount: number;
    }[];
  const close = (cycleId: string, id = assignment, headers = identity()) =>
    api(
      'POST',
      `/assignments/${id}/peer-review/cycles/${cycleId}/close`,
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
    const create = async (title: string) => {
      const r = await api('POST', '/assignments', {
        courseId: COURSE,
        title,
        prompt: 'Write it',
        passingScore: 70,
        expectedDurationMinutes: 30,
        maxConsecutiveAttempts: 50,
        rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.id as string;
    };
    assignment = await create('Reviewed');
    direct = await create('Direct');
    const on = await api('PUT', `/assignments/${assignment}/peer-review`, {
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

  test('refused: peer review off (409), a cycle of nobody (404), a Learner (403), another Instructor (404)', async () => {
    await submit(assignment, learner(0));
    await submit(assignment, learner(1));
    const [cycle] = await cycles();

    const off = await close(cycle.id, direct);
    assert.equal(off.status, 409);
    assert.equal(off.code, 'PEER_REVIEW_NOT_ENABLED');
    assert.equal((await close(UNKNOWN)).status, 404);
    assert.equal(
      (
        await close(
          cycle.id,
          assignment,
          identity({ user: learner(0), role: 'LEARNER' }),
        )
      ).status,
      403,
    );
    assert.equal(
      (await close(cycle.id, assignment, identity({ user: OTHER_INSTRUCTOR })))
        .status,
      404,
    );
    assert.equal((await close('abc')).status, 400);
    assert.equal((await cycles())[0].status, 'Open');
    assert.equal((await cycles())[0].closed, false);
  });

  test('2 submissions, N = 2: nobody to swap with, the Instructor grades them (BR-242)', async () => {
    const [cycle] = await cycles();
    const r = await close(cycle.id);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.status, 'InstructorOnly');
    assert.equal(r.data.submissionCount, 2);
    assert.equal(r.data.reviewCount, 0);
    assert.equal(r.data.alreadyClosed, false);

    const rows = await db.query(
      `SELECT grading_status, intervention_reason FROM submissions WHERE cycle_id = $1`,
      [cycle.id],
    );
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.grading_status, 'AwaitingInstructor');
      assert.equal(row.intervention_reason, 'TOO_FEW_SUBMISSIONS');
    }
    assert.equal((await cycles())[0].status, 'InstructorOnly');
    assert.equal((await cycles())[0].closed, true);
  });

  test('closing again changes nothing', async () => {
    const [cycle] = await cycles();
    const again = await close(cycle.id);
    assert.equal(again.status, 200);
    assert.equal(again.data.alreadyClosed, true);
    assert.equal(again.data.status, 'InstructorOnly');
    assert.equal(again.data.submissionCount, 2);
  });

  test('the closing is now: later submissions fall into a new cycle (BR-208)', async () => {
    for (let i = 2; i <= 6; i += 1) await submit(assignment, learner(i));
    const list = await cycles();
    assert.equal(list.length, 2);
    assert.equal(list[1].status, 'Open');
    assert.equal(list[1].submissionCount, 5);
  });

  test('5 submissions, N = 2: 10 reviews, 2 per submission, none of the author (BR-249)', async () => {
    const cycle = (await cycles())[1];
    const r = await close(cycle.id);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.status, 'Assigned');
    assert.equal(r.data.submissionCount, 5);
    assert.equal(r.data.reviewCount, 10);

    const reviews = await db.query(
      `SELECT r.reviewer_id, s.learner_id AS author_id, r.status, r.reviewer_role
         FROM submission_reviews r JOIN submissions s ON s.id = r.submission_id
        WHERE r.cycle_id = $1`,
      [cycle.id],
    );
    assert.equal(reviews.length, 10);
    const byAuthor = new Map<string, Set<string>>();
    const byReviewer = new Map<string, number>();
    for (const row of reviews) {
      const author = row.author_id as string;
      const reviewer = row.reviewer_id as string;
      assert.notEqual(reviewer, author);
      assert.equal(row.status, 'Pending');
      assert.equal(row.reviewer_role, 'Learner');
      byAuthor.set(author, (byAuthor.get(author) ?? new Set()).add(reviewer));
      byReviewer.set(reviewer, (byReviewer.get(reviewer) ?? 0) + 1);
    }
    assert.equal(byAuthor.size, 5);
    for (const reviewers of byAuthor.values()) assert.equal(reviewers.size, 2);
    for (const count of byReviewer.values()) assert.equal(count, 2);

    // BR-248: the reviewers are the Learners who submitted in this very cycle, not those of the first one
    const first = new Set([learner(0), learner(1)]);
    for (const row of reviews) assert.ok(!first.has(row.reviewer_id as string));

    const [stored] = await db.query(
      `SELECT reviewer_permutation, status, closed_at FROM peer_review_cycles WHERE id = $1`,
      [cycle.id],
    );
    assert.equal((stored.reviewer_permutation as string[]).length, 5);
    assert.equal(stored.status, 'Assigned');
    assert.ok(stored.closed_at);
  });

  test('closing the assigned cycle again keeps the same reviews and the same permutation', async () => {
    const cycle = (await cycles())[1];
    const ids = () =>
      db.query(
        `SELECT id FROM submission_reviews WHERE cycle_id = $1 ORDER BY id`,
        [cycle.id],
      );
    const permutation = () =>
      db.query(
        `SELECT reviewer_permutation FROM peer_review_cycles WHERE id = $1`,
        [cycle.id],
      );
    const [reviewsBefore, permutationBefore] = [
      await ids(),
      await permutation(),
    ];

    const again = await close(cycle.id);
    assert.equal(again.data.alreadyClosed, true);
    assert.equal(again.data.status, 'Assigned');
    assert.equal(again.data.reviewCount, 10);
    assert.deepEqual(await ids(), reviewsBefore);
    assert.deepEqual(await permutation(), permutationBefore);
  });

  test('two closings at the same moment hand out the reviews once', async () => {
    for (let i = 7; i <= 10; i += 1) await submit(assignment, learner(i));
    const cycle = (await cycles())[2];
    const [a, b] = await Promise.all([close(cycle.id), close(cycle.id)]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(
      [a, b].filter((r) => r.data.alreadyClosed === false).length,
      1,
    );
    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM submission_reviews WHERE cycle_id = $1`,
      [cycle.id],
    );
    assert.equal(count, 8);
  });

  test('every Learner who submitted has a state row, so a skipped review can be marked at the deadline', async () => {
    const [{ submitters, states }] = await db.query(
      `SELECT (SELECT count(DISTINCT learner_id) FROM submissions WHERE assessment_id = $1)::int AS submitters,
              (SELECT count(*) FROM learner_assessment_states WHERE assessment_id = $1)::int AS states`,
      [assignment],
    );
    assert.ok((submitters as number) > 0);
    assert.equal(states, submitters);
  });

  test('a closing waits for a submission being placed, and a submission is never left in a closed cycle without reviews', async () => {
    for (let i = 11; i <= 13; i += 1) await submit(assignment, learner(i));
    const target = (await cycles()).find(
      (c) => c.status === 'Open' && c.submissionCount === 3,
    )!;
    // a submission in flight: it holds the lock of the cycles of this Assignment until it commits
    const holder = await db.connect();
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `cycle:${assignment}`,
    ]);
    let closed = false;
    const closing = close(target.id).then((r) => {
      closed = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal(closed, false, 'the closing waits for the lock');
    const [{ status }] = await db.query(
      `SELECT status FROM peer_review_cycles WHERE id = $1`,
      [target.id],
    );
    assert.equal(status, 'Open');

    // one more Learner submits while the closing waits; they take turns when the lock is released
    const late = submit(assignment, learner(14));
    await new Promise((resolve) => setTimeout(resolve, 200));
    await holder.query('COMMIT');
    const [answer] = await Promise.all([closing, late]);
    assert.equal(answer.status, 200);

    const [{ inCycle, reviewed }] = await db.query(
      `SELECT (SELECT count(*) FROM submissions WHERE cycle_id = $1 AND superseded_at IS NULL)::int AS "inCycle",
              (SELECT count(DISTINCT submission_id) FROM submission_reviews WHERE cycle_id = $1)::int AS reviewed`,
      [target.id],
    );
    assert.equal(
      inCycle,
      reviewed,
      'every submission of the closed cycle was handed out for review',
    );
  });
});
