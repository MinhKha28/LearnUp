/**
 * UC33.1, BR-252, BR-253 through the real HTTP API and a real Postgres: the detail of a cycle marks the submissions whose
 * valid peer review scores differ by more than the threshold of the cycle. The cycle, the submissions and the reviews are
 * written straight into the database; the schedule is switched off.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  ORG,
  startCourseStub,
  startService,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const person = (i: number) =>
  `00000000-0000-4000-8000-${(0xf0 + i).toString(16).padStart(12, '0')}`;

interface Case {
  author: number;
  reviews: { status: string; score?: number; role?: string }[];
  grading?: string;
}

describe('UC33.1 the score gap of the submissions of a cycle over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignment: string;
  let cycle: string;
  const submissionOf = new Map<number, string>();

  const cases: Case[] = [
    // 30 apart, above the threshold of 20
    {
      author: 0,
      reviews: [
        { status: 'Completed', score: 90 },
        { status: 'Completed', score: 60 },
      ],
    },
    // exactly 20 apart: not greater than the threshold
    {
      author: 1,
      reviews: [
        { status: 'Completed', score: 80 },
        { status: 'Completed', score: 60 },
      ],
    },
    // 5 apart; the Instructor's own score of 0 is not a peer score and does not count
    {
      author: 2,
      reviews: [
        { status: 'Completed', score: 80 },
        { status: 'Completed', score: 75 },
        { status: 'Completed', score: 0, role: 'Instructor' },
      ],
    },
    // one score only: nothing to compare
    {
      author: 3,
      reviews: [{ status: 'Completed', score: 85 }, { status: 'Pending' }],
    },
    // far apart but already finalized by the Instructor
    {
      author: 4,
      grading: 'Finalized',
      reviews: [
        { status: 'Completed', score: 95 },
        { status: 'Completed', score: 40 },
      ],
    },
    // no review done yet
    { author: 5, reviews: [{ status: 'Pending' }, { status: 'Pending' }] },
    // rows that are not Completed keep a number (a removed, expired, missed or pending review): none of them counts
    {
      author: 6,
      reviews: [
        { status: 'Completed', score: 80 },
        { status: 'Completed', score: 78 },
        { status: 'Expired', score: 10 },
        { status: 'Removed', score: 5 },
        { status: 'Pending', score: 99 },
        { status: 'Missed', score: 0 },
      ],
    },
    // three reviewers: the gap is the highest minus the lowest of all three
    {
      author: 7,
      reviews: [
        { status: 'Completed', score: 90 },
        { status: 'Completed', score: 70 },
        { status: 'Completed', score: 50 },
      ],
    },
    // all scores equal: a gap of zero, which is not the same as no gap
    {
      author: 8,
      reviews: [
        { status: 'Completed', score: 70 },
        { status: 'Completed', score: 70 },
        { status: 'Completed', score: 70 },
      ],
    },
    // fractional scores through PostgreSQL and JSON: 19.75 is not above 20, 20.5 is
    {
      author: 9,
      reviews: [
        { status: 'Completed', score: 80.25 },
        { status: 'Completed', score: 60.5 },
      ],
    },
    {
      author: 10,
      reviews: [
        { status: 'Completed', score: 80.25 },
        { status: 'Completed', score: 59.75 },
      ],
    },
  ];

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
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Gap',
      prompt: 'Write it',
      passingScore: 70,
      expectedDurationMinutes: 30,
      rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assignment = created.data.id as string;
    const on = await api('PUT', `/assignments/${assignment}/peer-review`, {
      enabled: true,
      reviewersPerSubmission: 2,
      scoreGap: 20,
    });
    assert.equal(on.status, 200, JSON.stringify(on.json));
    const [{ id }] = await db.query(
      `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
              reviewers_per_submission, score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '9 days', now() - interval '2 days', now() + interval '100000 hours',
               2, 20, 24, 'Assigned', $3, now(), now()) RETURNING id`,
      [ORG, assignment, cases.map((c) => person(c.author))],
    );
    cycle = id as string;
    for (const c of cases) {
      const [row] = await db.query(
        `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
                submitted_at, cycle_id, grading_status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, 'answer', now() - interval '8 days', $4, $5, now(), now())
         RETURNING id`,
        [
          ORG,
          assignment,
          person(c.author),
          cycle,
          c.grading ?? 'AwaitingPeerReview',
        ],
      );
      submissionOf.set(c.author, row.id as string);
      for (const [k, review] of c.reviews.entries()) {
        await db.query(
          `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role,
                  status, score, comment, completed_at, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
          [
            ORG,
            row.id,
            cycle,
            person(100 + c.author * 10 + k),
            review.role ?? 'Learner',
            review.status,
            review.score ?? null,
            review.status === 'Completed' ? 'fine' : null,
            review.status === 'Completed' ? new Date() : null,
          ],
        );
      }
    }
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  const read = async () => {
    const r = await api(
      'GET',
      `/assignments/${assignment}/peer-review/cycles/${cycle}`,
      undefined,
      identity(),
    );
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const bySubmission = new Map<string, any>(
      (r.data.submissions as any[]).map((s) => [s.id as string, s]),
    );
    return {
      data: r.data,
      of: (author: number) => bySubmission.get(submissionOf.get(author)!),
    };
  };

  test('the cycle carries its threshold', async () => {
    const { data } = await read();
    assert.equal(data.cycle.scoreGap, 20);
  });

  test('a gap above the threshold needs review, with the lowest, the highest and the gap', async () => {
    const s = (await read()).of(0);
    assert.equal(s.lowestScore, 60);
    assert.equal(s.highestScore, 90);
    assert.equal(s.scoreGap, 30);
    assert.equal(s.needsReview, true);
  });

  test('a gap equal to the threshold does not (BR-253 says greater than)', async () => {
    const s = (await read()).of(1);
    assert.equal(s.scoreGap, 20);
    assert.equal(s.needsReview, false);
  });

  test('the score of the Instructor is not a peer score', async () => {
    const s = (await read()).of(2);
    assert.equal(s.scoreGap, 5);
    assert.equal(s.lowestScore, 75);
    assert.equal(s.needsReview, false);
  });

  test('one score only, or none, has no gap', async () => {
    const { of } = await read();
    for (const author of [3, 5]) {
      assert.equal(of(author).scoreGap, null, `author ${author}`);
      assert.equal(of(author).lowestScore, null);
      assert.equal(of(author).needsReview, false);
    }
  });

  test('a finalized submission keeps its gap but no longer needs review', async () => {
    const s = (await read()).of(4);
    assert.equal(s.scoreGap, 55);
    assert.equal(s.needsReview, false);
  });

  test('exactly one submission needs review in this cycle', async () => {
    const { data } = await read();
    assert.deepEqual(
      (data.submissions as any[])
        .filter((s) => s.needsReview)
        .map((s) => s.id)
        .sort(),
      [0, 7, 10].map((author) => submissionOf.get(author)!).sort(),
    );
  });

  test('a review that is not Completed never counts, whatever number it keeps', async () => {
    const s = (await read()).of(6);
    assert.equal(s.lowestScore, 78);
    assert.equal(s.highestScore, 80);
    assert.equal(s.scoreGap, 2);
    assert.equal(s.needsReview, false);
  });

  test('three reviewers: the gap is the highest minus the lowest', async () => {
    const s = (await read()).of(7);
    assert.equal(s.lowestScore, 50);
    assert.equal(s.highestScore, 90);
    assert.equal(s.scoreGap, 40);
    assert.equal(s.needsReview, true);
  });

  test('equal scores give a gap of zero, not a missing one', async () => {
    const s = (await read()).of(8);
    assert.equal(s.scoreGap, 0);
    assert.equal(s.lowestScore, 70);
    assert.equal(s.highestScore, 70);
    assert.equal(s.needsReview, false);
  });

  test('fractional scores and threshold: 19.75 is below 20, 20.5 is above', async () => {
    const { of } = await read();
    assert.equal(of(9).lowestScore, 60.5);
    assert.equal(of(9).highestScore, 80.25);
    assert.equal(of(9).scoreGap, 19.75);
    assert.equal(of(9).needsReview, false);
    assert.equal(of(10).scoreGap, 20.5);
    assert.equal(of(10).needsReview, true);
  });

  test('a threshold changed on the Assignment after the cycle was created does not change that cycle (it keeps its own)', async () => {
    await db.query(
      'UPDATE assessments SET peer_review_score_gap = 50 WHERE id = $1',
      [assignment],
    );
    try {
      const { data, of } = await read();
      assert.equal(data.cycle.scoreGap, 20);
      assert.equal(of(0).needsReview, true); // 30 apart is still above the 20 of the cycle
      assert.equal(of(1).needsReview, false); // exactly 20 apart is still not above it
    } finally {
      await db.query(
        'UPDATE assessments SET peer_review_score_gap = 20 WHERE id = $1',
        [assignment],
      );
    }
  });
});
