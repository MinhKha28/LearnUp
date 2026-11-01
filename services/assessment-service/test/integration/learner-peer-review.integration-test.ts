/**
 * UC31 and UC31.1 through the real HTTP API and a real Postgres: the Learner sees the reviews handed out to them without
 * the author of the work, gives a review against the Rubric before the deadline of the cycle, and the review that completes
 * the set of a submission decides where the submission goes. The cycle, the submissions and the reviews are written straight
 * into the database in the state the schedule would have left them (the schedule is off); Enrollment is answered by a fake
 * Learning Service. The tests are one story and share state, so keep their order.
 *
 * Three Learners L1, L2, L3 each submitted once; with two reviewers per submission each one reviews the other two:
 *   L1 reviews S2 and S3, L2 reviews S3 and S1, L3 reviews S1 and S2.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  INSTRUCTOR,
  KEY,
  ORG,
  startCourseStub,
  startLearningStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';
import { brokenRules } from '../unit/completion-contract';

const L = [1, 2, 3].map((i) => `00000000-0000-4000-8000-0000000000d${i}`) as [
  string,
  string,
  string,
];
const as = (user: string) => identity({ user, role: 'LEARNER' });

describe('UC31 and UC31.1 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: LearningStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignment: string;
  let cycle: string;
  let criteria: { id: string; maxPoints: number }[];
  /** submission id of L1, L2, L3 */
  const submission: string[] = [];
  /** reviews[i][j]: the review that reviewer Li owes on the submission of author Lj */
  const review: Record<string, string> = {};
  const key = (reviewer: number, author: number) => `${reviewer}->${author}`;

  const queue = (user: string, headers = as(user)) =>
    api('GET', '/learner/peer-reviews', undefined, headers);
  const detail = (id: string, user: string, headers = as(user)) =>
    api('GET', `/learner/peer-reviews/${id}`, undefined, headers);
  /** Gives the review with this much of every criterion, as a fraction of its maximum. */
  const give = (
    id: string,
    user: string,
    fraction: number,
    over: Record<string, unknown> = {},
    headers = as(user),
  ) =>
    api(
      'POST',
      `/learner/peer-reviews/${id}`,
      {
        scores: criteria.map((c) => ({
          criterionId: c.id,
          points: Math.round(c.maxPoints * fraction),
        })),
        comment: 'Clear and well argued.',
        ...over,
      },
      headers,
    );
  const row = async (id: string) =>
    (
      await db.query(
        'SELECT status, score, comment, completed_at FROM submission_reviews WHERE id = $1',
        [id],
      )
    )[0];
  const grading = async (index: number) =>
    (
      await db.query(
        'SELECT grading_status, intervention_reason FROM submissions WHERE id = $1',
        [submission[index]],
      )
    )[0];
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query(sql, params))[0].count);
  const events = (who: string) =>
    db.query(
      `SELECT payload FROM outbox_events
        WHERE event_type = 'LearnerAssessmentStatusChanged' AND payload->>'reason' = 'PEER_REVIEW_COMPLETED'
          AND payload->>'learnerId' = $1 ORDER BY id`,
      [who],
    );
  const snapshot = async (who: string) => {
    const response = await fetch(
      `${service.baseUrl}/api/v1/internal/learners/${who}/courses/${COURSE}/completion-snapshot`,
      { headers: { 'x-internal-key': KEY, 'x-organization-id': ORG } },
    );
    const json = (await response.json()) as { data: any };
    assert.equal(response.status, 200, JSON.stringify(json));
    assert.deepEqual(brokenRules(json.data, ORG, who, COURSE), []);
    return json.data;
  };

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    learning = await startLearningStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'http',
      LEARNING_SERVICE_URL: learning.url,
      PEER_REVIEW_TICK_MS: '3600000', // the schedule stays out of the way: the states are written by the test
    });
    api = apiFor(service.baseUrl);
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Peer reviewed essay',
      prompt: 'Write about <b>peer review</b>',
      passingScore: 70,
      expectedDurationMinutes: 30,
      rubric: [
        { name: 'Argument', description: 'Is it argued?', maxPoints: 10 },
        { name: 'Style', description: 'Is it clear?', maxPoints: 5 },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assignment = created.data.id as string;
    const on = await api('PUT', `/assignments/${assignment}/peer-review`, {
      enabled: true,
      reviewersPerSubmission: 2,
      scoreGap: 20,
    });
    assert.equal(on.status, 200, JSON.stringify(on.json));
    criteria = (
      await db.query(
        'SELECT id, max_points FROM rubric_criteria WHERE assessment_id = $1 ORDER BY position',
        [assignment],
      )
    ).map((c) => ({ id: c.id as string, maxPoints: Number(c.max_points) }));
    assert.equal(criteria.length, 2);

    const [{ id }] = await db.query(
      `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
              reviewers_per_submission, score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '9 days', now() - interval '2 days', now() + interval '100000 hours',
               2, 20, 24, 'Assigned', $3, now(), now()) RETURNING id`,
      [ORG, assignment, L],
    );
    cycle = id as string;
    for (const [i, who] of L.entries()) {
      const [s] = await db.query(
        `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
                submitted_at, cycle_id, grading_status, file_key, file_name, file_mime, file_size_bytes, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, now() - interval '8 days', $5, 'AwaitingPeerReview',
                 $6, 'Nguyen-Van-A-essay.pdf', 'application/pdf', 1234, now(), now())
         RETURNING id`,
        [
          ORG,
          assignment,
          who,
          `Essay number ${i + 1}`,
          cycle,
          `learnup/key/${who}`,
        ],
      );
      submission.push(s.id as string);
      await db.query(
        `INSERT INTO learner_assessment_states (id, organization_id, assessment_id, learner_id, first_activity_at,
                created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now() - interval '8 days', now(), now())`,
        [ORG, assignment, who],
      );
    }
    for (let author = 0; author < 3; author += 1) {
      for (const step of [1, 2]) {
        const reviewer = (author + step) % 3;
        const [r] = await db.query(
          `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role,
                  status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', 'Pending', now(), now()) RETURNING id`,
          [ORG, submission[author], cycle, L[reviewer]],
        );
        review[key(reviewer, author)] = r.id as string;
      }
    }
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await learning?.stop();
    await db?.drop();
  });

  test('refused: an Instructor (403), a review of somebody else (404), an unknown one (404), a bad id (400)', async () => {
    const mine = review[key(0, 1)];
    for (const call of [
      queue(L[0], identity({ user: INSTRUCTOR, role: 'INSTRUCTOR' })),
      detail(mine, L[0], identity({ user: INSTRUCTOR, role: 'INSTRUCTOR' })),
      give(
        mine,
        L[0],
        1,
        {},
        identity({ user: INSTRUCTOR, role: 'INSTRUCTOR' }),
      ),
    ])
      assert.equal((await call).status, 403);
    assert.equal(
      (await detail(mine, L[2])).status,
      404,
      'a review of L1 is not found by L3',
    );
    assert.equal((await give(mine, L[2], 1)).status, 404);
    assert.equal((await detail(UNKNOWN, L[0])).status, 404);
    assert.equal((await detail('abc', L[0])).status, 400);
    assert.equal(
      await count(
        "SELECT count(*) FROM submission_reviews WHERE status <> 'Pending'",
      ),
      0,
    );
  });

  test('the Enrollment decides: not enrolled 403, Halted or Withdrawn 409, Completed still lets it be read', async () => {
    const mine = review[key(0, 1)];
    learning.setAnswer(L[0], COURSE, 'NotFound');
    assert.equal((await detail(mine, L[0])).status, 403);
    learning.setAnswer(L[0], COURSE, 'None');
    const closed = await give(mine, L[0], 1);
    assert.equal(closed.status, 409);
    assert.equal(closed.code, 'ENROLLMENT_NOT_ACTIVE');
    learning.setAnswer(L[0], COURSE, 'ReadOnly');
    assert.equal((await detail(mine, L[0])).status, 200);
    learning.reset();
    assert.equal(
      await count(
        "SELECT count(*) FROM submission_reviews WHERE status <> 'Pending'",
      ),
      0,
    );
  });

  test('UC31: the queue lists the two reviews to give, with the deadline, and names nobody', async () => {
    const r = await queue(L[0]);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.pendingCount, 2);
    assert.equal(r.data.items.length, 2);
    const ids = r.data.items.map((item: any) => item.id).sort();
    assert.deepEqual(ids, [review[key(0, 1)], review[key(0, 2)]].sort());
    for (const item of r.data.items) {
      assert.equal(item.state, 'Open');
      assert.equal(item.status, 'Pending');
      assert.equal(item.assignmentTitle, 'Peer reviewed essay');
      assert.ok(
        Date.parse(item.reviewDueAt) > Date.now(),
        'the deadline of the cycle',
      );
    }
    const text = JSON.stringify(r.json);
    for (const who of [L[1], L[2]])
      assert.equal(text.includes(who), false, 'no author in the queue');
    for (const id of submission)
      assert.equal(text.includes(id), false, 'nor the submission');
  });

  test('UC31: a Learner sees only their own reviews', async () => {
    const other = await queue(L[1]);
    const ids = other.data.items.map((item: any) => item.id);
    assert.equal(ids.includes(review[key(0, 1)]), false);
    assert.equal(other.data.items.length, 2);
  });

  test('UC31: the work to review comes without its author, with the Rubric, and the file has a neutral name (BR-233)', async () => {
    const r = await detail(review[key(0, 1)], L[0]);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.submission.content, 'Essay number 2');
    assert.deepEqual(
      r.data.assignment.rubric.map((c: any) => [c.name, c.maxPoints]),
      [
        ['Argument', 10],
        ['Style', 5],
      ],
    );
    assert.equal(r.data.assignment.prompt, 'Write about <b>peer review</b>');
    assert.equal(r.data.submission.file.fileName, 'submitted-work.pdf');
    assert.equal(
      r.data.submission.file.url,
      `/api/v1/assessments/learner/peer-reviews/${review[key(0, 1)]}/file`,
    );
    assert.equal(r.data.myReview, null);
    assert.equal(r.data.state, 'Open');
    const text = JSON.stringify(r.json);
    for (const hidden of [
      L[1],
      L[2],
      submission[1],
      'Nguyen-Van-A',
      'learnup/key',
    ]) {
      assert.equal(
        text.includes(hidden),
        false,
        `the answer must not contain ${hidden}`,
      );
    }
  });

  test('UC31.1: a review that is not valid is refused and writes nothing (BR-257)', async () => {
    const id = review[key(0, 1)];
    const [a] = criteria;
    const cases: [string, Record<string, unknown>, string | undefined][] = [
      [
        'a criterion left out',
        { scores: [{ criterionId: a.id, points: 3 }] },
        'RUBRIC_SCORES_INCOMPLETE',
      ],
      [
        'a criterion twice',
        {
          scores: [
            { criterionId: a.id, points: 3 },
            { criterionId: a.id, points: 4 },
          ],
        },
        'RUBRIC_SCORES_INCOMPLETE',
      ],
      [
        'points over the maximum',
        {
          scores: [
            { criterionId: a.id, points: 11 },
            { criterionId: criteria[1].id, points: 1 },
          ],
        },
        'RUBRIC_SCORE_OUT_OF_RANGE',
      ],
      [
        'negative points',
        {
          scores: [
            { criterionId: a.id, points: -1 },
            { criterionId: criteria[1].id, points: 1 },
          ],
        },
        undefined,
      ],
      [
        'points that are not whole',
        {
          scores: [
            { criterionId: a.id, points: 2.5 },
            { criterionId: criteria[1].id, points: 1 },
          ],
        },
        undefined,
      ],
      ['no comment', { comment: '' }, undefined],
      ['a comment of spaces only', { comment: '   ' }, undefined],
      ['a comment that is too long', { comment: 'x'.repeat(2001) }, undefined],
      [
        'an unknown criterion',
        {
          scores: [
            { criterionId: UNKNOWN, points: 1 },
            { criterionId: criteria[1].id, points: 1 },
          ],
        },
        'RUBRIC_SCORES_INCOMPLETE',
      ],
    ];
    for (const [name, over, code] of cases) {
      const r = await give(id, L[0], 1, over);
      assert.equal(r.status, 400, `${name}: ${JSON.stringify(r.json)}`);
      if (code) assert.equal(r.code, code, name);
    }
    assert.equal((await row(id)).status, 'Pending');
    assert.equal(
      await count('SELECT count(*) FROM submission_review_scores'),
      0,
    );
    assert.equal(
      await count(
        "SELECT count(*) FROM outbox_events WHERE payload->>'reason' = 'PEER_REVIEW_COMPLETED'",
      ),
      0,
    );
  });

  test('UC31.1: giving a review stores it, scores it on 0-100, tells learning, and counts the rest', async () => {
    const id = review[key(0, 1)]; // L1 reviews the work of L2
    const r = await give(id, L[0], 0.8); // 8/10 and 4/5
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.status, 'Completed');
    assert.equal(r.data.score, 80);
    assert.equal(r.data.remainingInAssignment, 1);
    const stored = await row(id);
    assert.equal(stored.status, 'Completed');
    assert.equal(Number(stored.score), 80);
    assert.equal(stored.comment, 'Clear and well argued.');
    assert.ok(stored.completed_at);
    assert.equal(
      await count(
        'SELECT count(*) FROM submission_review_scores WHERE review_id = $1',
        [id],
      ),
      2,
    );

    const [event, ...more] = await events(L[0]);
    assert.equal(more.length, 0, 'one event');
    const payload = event.payload as Record<string, string>;
    assert.equal(payload.reason, 'PEER_REVIEW_COMPLETED');
    assert.equal(payload.status, 'PeerReviewCompleted');
    assert.equal(payload.assessmentId, assignment);
    assert.equal(payload.organizationId, ORG);
    assert.equal(payload.reviewId, id);
    assert.equal(
      payload.revision,
      (await snapshot(L[0])).revision,
      'the revision the snapshot has right after',
    );
  });

  test('UC31.1: the queue and the detail show it as given, with what the Learner gave', async () => {
    const q = await queue(L[0]);
    assert.equal(q.data.pendingCount, 1);
    const done = q.data.items.find(
      (item: any) => item.id === review[key(0, 1)],
    );
    assert.equal(done.state, 'Done');
    assert.equal(done.score, 80);
    assert.ok(done.completedAt);
    assert.equal(q.data.items[0].state, 'Open', 'the one to give comes first');
    const d = await detail(review[key(0, 1)], L[0]);
    assert.equal(d.data.state, 'Done');
    assert.equal(d.data.myReview.comment, 'Clear and well argued.');
    assert.deepEqual(
      d.data.myReview.scores.map((s: any) => s.points).sort(),
      [4, 8],
    );
  });

  test('UC31.1: a review is final: giving it again is a 409 and changes nothing', async () => {
    const id = review[key(0, 1)];
    const again = await give(id, L[0], 0.2, { comment: 'changed my mind' });
    assert.equal(again.status, 409);
    assert.equal(again.code, 'REVIEW_ALREADY_GIVEN');
    const stored = await row(id);
    assert.equal(Number(stored.score), 80);
    assert.equal(stored.comment, 'Clear and well argued.');
    assert.equal(
      await count(
        'SELECT count(*) FROM submission_review_scores WHERE review_id = $1',
        [id],
      ),
      2,
    );
    assert.equal((await events(L[0])).length, 1, 'and no second event');
  });

  test('UC31.1: two requests at the same moment: one gives the review, the other finds it given', async () => {
    const id = review[key(0, 2)]; // L1 reviews the work of L3
    const results = await Promise.all([give(id, L[0], 1), give(id, L[0], 0.5)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      await count(
        'SELECT count(*) FROM submission_review_scores WHERE review_id = $1',
        [id],
      ),
      2,
    );
    assert.equal(
      (await events(L[0])).length,
      2,
      'one event for each review that was given',
    );
    const q = await queue(L[0]);
    assert.equal(q.data.pendingCount, 0);
  });

  test('the duty is paid: the snapshot says Satisfied once the Learner gave all their reviews', async () => {
    const result = await snapshot(L[0]);
    const target = result.assignments.find(
      (a: any) => a.assessmentId === assignment,
    );
    assert.equal(target.peerReview.status, 'Satisfied');
    assert.equal(target.peerReview.requiredCount, 2);
    assert.equal(target.peerReview.completedCount, 2);
  });

  test('the submission waits while a review is missing, then goes to its grade when the peers agree (BR-251)', async () => {
    // S2 (author L2) is reviewed by L1 (80, given above) and L3
    assert.equal(
      (await grading(1)).grading_status,
      'AwaitingPeerReview',
      'one of two reviews is in',
    );
    const r = await give(review[key(2, 1)], L[2], 0.7); // 7/10 and 4/5 (round 3.5 -> 4) = 11/15
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const moved = await grading(1);
    assert.equal(moved.grading_status, 'AwaitingFinalization');
    assert.equal(moved.intervention_reason, null);
  });

  test('the submission goes to the Instructor when the peers differ by more than the threshold (BR-252, BR-253)', async () => {
    // S3 (author L3) is reviewed by L1 (100, given above) and L2: 20 points apart is allowed, 40 is not
    const r = await give(review[key(1, 2)], L[1], 0.2); // 2/10 and 1/5 = 20
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const moved = await grading(2);
    assert.equal(moved.grading_status, 'AwaitingInstructor');
    assert.equal(moved.intervention_reason, 'SCORE_GAP_EXCEEDED');
  });

  test('a review given after the deadline of the cycle is refused (BR-229), and so is one the schedule marked Missed (BR-236)', async () => {
    const late = review[key(1, 0)]; // L2 reviews the work of L1, still Pending
    await db.query(
      "UPDATE peer_review_cycles SET review_due_at = now() - interval '1 minute' WHERE id = $1",
      [cycle],
    );
    const afterDeadline = await give(late, L[1], 1);
    assert.equal(afterDeadline.status, 409);
    assert.equal(afterDeadline.code, 'REVIEW_CLOSED');
    assert.equal((await row(late)).status, 'Pending');
    const q = await queue(L[1]);
    assert.equal(q.data.pendingCount, 0, 'nothing left to give');
    assert.equal(
      q.data.items.find((item: any) => item.id === late).state,
      'Closed',
    );

    await db.query(
      "UPDATE submission_reviews SET status = 'Missed' WHERE id = $1",
      [late],
    );
    await db.query(
      "UPDATE peer_review_cycles SET review_due_at = now() + interval '5 days' WHERE id = $1",
      [cycle],
    );
    const missed = await give(late, L[1], 1);
    assert.equal(missed.status, 409, 'the Instructor has taken over');
    assert.equal(missed.code, 'REVIEW_CLOSED');
    assert.equal((await row(late)).status, 'Missed');
  });

  test('a Completed Enrollment does not stop the reviews that were handed out (BR-211)', async () => {
    const mine = review[key(2, 0)]; // L3 reviews the work of L1
    learning.setAnswer(L[2], COURSE, 'ReadOnly');
    const r = await give(mine, L[2], 1);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    learning.reset();
    assert.equal((await row(mine)).status, 'Completed');
  });

  test('the file of the work goes through this service: a submission without a file has none, one with a file asks the storage', async () => {
    const fileless = await db.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
              submitted_at, cycle_id, grading_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 2, 'text only', now(), $4, 'AwaitingPeerReview', now(), now()) RETURNING id`,
      [ORG, assignment, L[1], cycle],
    );
    const [extra] = await db.query(
      `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', 'Pending', now(), now()) RETURNING id`,
      [ORG, fileless[0].id, cycle, L[0]],
    );
    const none = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/peer-reviews/${extra.id as string}/file`,
      { headers: as(L[0]) },
    );
    assert.equal(none.status, 404);
    const d = await detail(extra.id as string, L[0]);
    assert.equal(d.data.submission.file, null);
    const withFile = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/peer-reviews/${review[key(0, 1)]}/file`,
      { headers: as(L[0]) },
    );
    assert.ok(
      [404, 503].includes(withFile.status),
      `the storage of the test cannot be reached: ${withFile.status}`,
    );
    const stranger = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/peer-reviews/${review[key(0, 1)]}/file`,
      { headers: as(L[2]) },
    );
    assert.equal(
      stranger.status,
      404,
      'the file of a review of somebody else is not found',
    );
  });
});
