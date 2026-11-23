/**
 * UC32.4 through the real HTTP API and a real Postgres: the Instructor filters the submissions of an Assignment by
 * Learner, by grading status, by score and by "has to be graded by me". The submissions are written straight into the
 * database in the state the grading would have left them; the names of the Learners come from the fake tenant client
 * ("Learner XXXX", learner.xxxx@demo.local, XXXX = the last four characters of the id).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  ORG,
  OTHER_INSTRUCTOR,
  OTHER_ORG,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const learner = (i: number) =>
  `00000000-0000-4000-8000-${(0xf0 + i).toString(16).padStart(12, '0')}`;

describe('UC32.4 searching the submissions of an Assignment over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignment: string;
  let other: string;

  /**
   * learner(0) 90 Finalized         learner(1) 55 Finalized        learner(2) 70 Finalized (exactly the limit)
   * learner(3) AwaitingInstructor   learner(4) AwaitingFinalization (no score yet)
   * learner(5) AwaitingPeerReview   learner(0) also has a first submission (#1, 40 Finalized) replaced by #2
   */
  const submission = async (
    assessmentId: string,
    who: string,
    number: number,
    status: string,
    score: number | null,
    reason: string | null = null,
  ) => {
    const [row] = await db.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
              submitted_at, grading_status, intervention_reason, final_score, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'answer', now() - ($4::int || ' hours')::interval, $5, $6, $7, now(), now())
       RETURNING id`,
      [ORG, assessmentId, who, number, status, reason, score],
    );
    return row.id as string;
  };

  const list = (query: string, id = assignment, headers = identity()) =>
    api('GET', `/assignments/${id}/submissions${query}`, undefined, headers);
  const learnersOf = (result: { data: Record<string, any> }) =>
    (result.data.items as { learner: { id: string } }[])
      .map((item) => item.learner.id)
      .sort();

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      TENANT_CLIENT_MODE: 'fake',
      PEER_REVIEW_TICK_MS: '3600000',
    });
    api = apiFor(service.baseUrl);
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
    assignment = await create('Search me');
    other = await create('Another Assignment');
    await submission(assignment, learner(0), 1, 'Finalized', 40);
    await submission(assignment, learner(0), 2, 'Finalized', 90);
    await submission(assignment, learner(1), 1, 'Finalized', 55);
    await submission(assignment, learner(2), 1, 'Finalized', 70);
    await submission(
      assignment,
      learner(3),
      1,
      'AwaitingInstructor',
      null,
      'SCORE_GAP_EXCEEDED',
    );
    await submission(assignment, learner(4), 1, 'AwaitingFinalization', null);
    await submission(assignment, learner(5), 1, 'AwaitingPeerReview', null);
    await submission(other, learner(1), 1, 'Finalized', 10);
  });

  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  test('without a filter: the latest submission of each Learner, with the count of each status', async () => {
    const r = await list('');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.total, 6);
    assert.deepEqual(learnersOf(r), [0, 1, 2, 3, 4, 5].map(learner).sort());
    assert.deepEqual(r.data.statusCounts, {
      Finalized: 3,
      AwaitingInstructor: 1,
      AwaitingFinalization: 1,
      AwaitingPeerReview: 1,
    });
  });

  test('by Learner: only that Learner, and both submissions when the replaced ones are asked for', async () => {
    const latest = await list(`?learnerId=${learner(0)}`);
    assert.equal(latest.data.total, 1);
    assert.equal(latest.data.items[0].submissionNumber, 2);
    const all = await list(`?learnerId=${learner(0)}&latestOnly=false`);
    assert.deepEqual(
      all.data.items.map((i: any) => i.submissionNumber).sort(),
      [1, 2],
    );
    const nobody = await list(`?learnerId=${UNKNOWN}`);
    assert.equal(nobody.status, 200);
    assert.equal(nobody.data.total, 0);
  });

  test('by grading status', async () => {
    const r = await list('?status=Finalized');
    assert.deepEqual(learnersOf(r), [0, 1, 2].map(learner).sort());
    assert.equal((await list('?status=Nothing')).data.total, 0);
  });

  test('needing the Instructor: needsIntervention=true lists only the submissions the Instructor has to grade', async () => {
    const yes = await list('?needsIntervention=true');
    assert.deepEqual(learnersOf(yes), [learner(3)]);
    assert.equal(yes.data.items[0].interventionReason, 'SCORE_GAP_EXCEEDED');
    const no = await list('?needsIntervention=false');
    assert.equal(no.data.total, 5);
    assert.ok(!learnersOf(no).includes(learner(3)));
  });

  test('by score: both limits are included, and a submission without a final score never matches', async () => {
    assert.deepEqual(
      learnersOf(await list('?minScore=70')),
      [0, 2].map(learner).sort(),
    );
    assert.deepEqual(
      learnersOf(await list('?maxScore=70')),
      [1, 2].map(learner).sort(),
    );
    assert.deepEqual(
      learnersOf(await list('?minScore=55&maxScore=70')),
      [1, 2].map(learner).sort(),
    );
    assert.deepEqual(learnersOf(await list('?minScore=70&maxScore=70')), [
      learner(2),
    ]);
    assert.equal((await list('?minScore=0')).data.total, 3);
    assert.equal((await list('?maxScore=100')).data.total, 3);
    assert.equal((await list('?minScore=100')).data.total, 0);
    assert.equal((await list('?minScore=91')).data.total, 0);
    // the replaced submission of learner(0) scored 40: it counts when the replaced ones are asked for
    assert.deepEqual(
      (await list('?maxScore=40&latestOnly=false')).data.items.map(
        (i: any) => i.submissionNumber,
      ),
      [1],
    );
  });

  test('filters are combined, and the name search works with them', async () => {
    const r = await list(
      `?status=Finalized&minScore=60&q=${learner(2).slice(-4)}`,
    );
    assert.deepEqual(learnersOf(r), [learner(2)]);
    const none = await list(
      `?needsIntervention=true&q=${learner(0).slice(-4)}`,
    );
    assert.equal(none.data.total, 0);
    const byEmail = await list(`?q=LEARNER.${learner(1).slice(-4)}@`);
    assert.deepEqual(learnersOf(byEmail), [learner(1)]);
  });

  test('the total follows the filters, the paging cuts the filtered list, the counts of the chips do not move', async () => {
    const first = await list('?minScore=50&pageSize=2&page=1');
    assert.equal(first.data.total, 3);
    assert.equal(first.data.items.length, 2);
    const second = await list('?minScore=50&pageSize=2&page=2');
    assert.equal(second.data.items.length, 1);
    assert.equal(first.data.statusCounts.Finalized, 3);
    assert.equal(first.data.statusCounts.AwaitingInstructor, 1);
  });

  test('a wrong filter is refused with 400, not ignored', async () => {
    const reversed = await list('?minScore=80&maxScore=20');
    assert.equal(reversed.status, 400);
    assert.equal(reversed.code, 'SCORE_RANGE_INVALID');
    for (const query of [
      '?minScore=abc',
      '?maxScore=-1',
      '?minScore=100.01',
      '?maxScore=101',
      '?learnerId=not-a-uuid',
      '?needsIntervention=maybe',
    ]) {
      assert.equal((await list(query)).status, 400, query);
    }
  });

  test('the filters do not open anything else: another Instructor, another organization and a Learner are refused', async () => {
    const query = `?learnerId=${learner(0)}&minScore=0`;
    assert.equal(
      (await list(query, assignment, identity({ user: OTHER_INSTRUCTOR })))
        .status,
      404,
    );
    assert.equal(
      (await list(query, assignment, identity({ org: OTHER_ORG }))).status,
      404,
    );
    assert.equal(
      (await list(query, assignment, identity({ role: 'LEARNER' }))).status,
      403,
    );
    assert.equal((await list(query, UNKNOWN)).status, 404);
  });

  test('only the submissions of this Assignment are searched (learner(1) has a 10 in the other one)', async () => {
    assert.deepEqual(learnersOf(await list('?maxScore=20')), []);
    const r = await list(`?learnerId=${learner(1)}`, other);
    assert.equal(r.data.total, 1);
    assert.equal(r.data.items[0].finalScore, 10);
  });
});
