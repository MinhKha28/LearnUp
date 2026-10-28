/**
 * UC33 on its own schedule (BR-230, BR-232, BR-236, BR-237, BR-243, BR-239) through the real service and a real Postgres:
 * the cycles are written straight into the database in the state the clock would have brought them to, the service
 * runs its timer every 200 ms, and notification-service is a small stub that records what it was sent.
 * The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  KEY,
  ORG,
  sleep,
  startCourseStub,
  startService,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const id = (n: number) =>
  `00000000-0000-4000-8000-${(0xd0 + n).toString(16).padStart(12, '0')}`;

interface Sent {
  body: Record<string, string>;
  hasInternalKey: boolean;
  hasUserId: boolean;
}

describe('UC33 schedule over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let notifier: Server;
  let sent: Sent[];
  let assignment: string;

  const until = async (
    check: () => Promise<boolean> | boolean,
    what: string,
  ) => {
    for (let i = 0; i < 60; i += 1) {
      if (await check()) return;
      await sleep(200);
    }
    assert.fail(`timed out waiting for: ${what}`);
  };
  const cycle = async (cycleId: string) =>
    (
      await db.query(
        `SELECT status, reminded_at, completed_at, reviewer_permutation FROM peer_review_cycles WHERE id = $1`,
        [cycleId],
      )
    )[0];
  /** Far enough that the schedule leaves a cycle alone. */
  const PARKED_HOURS = 100_000;
  const count = async (sql: string, params: unknown[]) =>
    Number((await db.query(sql, params))[0].count);

  /**
   * One cycle with its submissions (one per Learner, in order) as the clock would have left it.
   * The schedule runs every 200 ms, so a cycle must not look due while the test is still adding what belongs to it (the
   * submissions, the reviews, the states): it is created with its dates far away and the real dates are set at the end
   * (`release`). A test that adds more after makeCycle asks for `parked` and calls `release` itself when it is done.
   */
  const makeCycle = async (spec: {
    status: 'Open' | 'Assigned';
    closesInHours: number;
    dueInHours: number;
    learners: string[];
    reminderHours?: number;
    parked?: boolean;
  }) => {
    const [{ id: cycleId }] = await db.query(
      `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
              reviewers_per_submission, score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '9 days', now() + $3::int * interval '1 hour',
               now() + $4::int * interval '1 hour', 2, 20, $5, $6, $7, now(), now()) RETURNING id`,
      [
        ORG,
        assignment,
        PARKED_HOURS,
        PARKED_HOURS,
        spec.reminderHours ?? 24,
        spec.status,
        spec.status === 'Assigned' ? spec.learners : [],
      ],
    );
    const submissionIds: string[] = [];
    for (const [index, learner] of spec.learners.entries()) {
      const [row] = await db.query(
        `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
                submitted_at, cycle_id, grading_status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, now() - interval '8 days', $5, 'AwaitingPeerReview', now(), now())
         RETURNING id`,
        [ORG, assignment, learner, `answer ${index}`, cycleId],
      );
      submissionIds.push(row.id as string);
    }
    const release = async () => {
      await db.query(
        `UPDATE peer_review_cycles SET closes_at = now() + $2::int * interval '1 hour',
                review_due_at = now() + $3::int * interval '1 hour' WHERE id = $1`,
        [cycleId, spec.closesInHours, spec.dueInHours],
      );
    };
    if (!spec.parked) await release();
    return { cycleId: cycleId as string, submissionIds, release };
  };
  /** The reviews the closing would have handed out for a ring: the author at i is reviewed by i + 1 and i + 2. */
  const makeReviews = async (
    cycleId: string,
    submissionIds: string[],
    learners: string[],
    completed: Set<string>, // "authorIndex:reviewerIndex"
  ) => {
    for (let i = 0; i < learners.length; i += 1) {
      for (let k = 1; k <= 2; k += 1) {
        const reviewer = (i + k) % learners.length;
        const done = completed.has(`${i}:${reviewer}`);
        await db.query(
          `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role,
                  status, score, comment, completed_at, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', $5, $6, $7, $8, now(), now())`,
          [
            ORG,
            submissionIds[i],
            cycleId,
            learners[reviewer],
            done ? 'Completed' : 'Pending',
            done ? 80 : null,
            done ? 'fine' : null,
            done ? new Date() : null,
          ],
        );
      }
    }
  };
  const state = (learner: string) =>
    db.query(
      `INSERT INTO learner_assessment_states (id, organization_id, assessment_id, learner_id, first_activity_at,
              exempted_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, now(), $4, now(), now())`,
      [ORG, assignment, learner, null],
    );

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    sent = [];
    notifier = createServer((request, response) => {
      let raw = '';
      request.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      request.on('end', () => {
        sent.push({
          body: JSON.parse(raw) as Record<string, string>,
          hasInternalKey: request.headers['x-internal-key'] === KEY,
          hasUserId: request.headers['x-user-id'] !== undefined,
        });
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end('{}');
      });
    });
    await new Promise<void>((resolve) => notifier.listen(0, resolve));
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      PEER_REVIEW_TICK_MS: '200',
      NOTIFICATION_CLIENT_MODE: 'http',
      NOTIFICATION_SERVICE_URL: `http://127.0.0.1:${(notifier.address() as AddressInfo).port}`,
    });
    const api = apiFor(service.baseUrl);
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Scheduled',
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
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await new Promise((resolve) => notifier?.close(resolve));
    await db?.drop();
  });

  test('a cycle past its closing line closes by itself: reviews handed out, each reviewer told (BR-230, BR-232)', async () => {
    const learners = [id(1), id(2), id(3), id(4)];
    const { cycleId } = await makeCycle({
      status: 'Open',
      closesInHours: -1,
      dueInHours: 71,
      learners,
    });
    await until(
      async () => (await cycle(cycleId)).status === 'Assigned',
      'the cycle to be Assigned',
    );

    assert.equal(
      await count(
        `SELECT count(*) FROM submission_reviews WHERE cycle_id = $1`,
        [cycleId],
      ),
      8,
    );
    assert.equal(
      ((await cycle(cycleId)).reviewer_permutation as string[]).length,
      4,
    );
    await until(
      () =>
        sent.filter((s) => s.body.title === 'Bạn có bài cần chấm chéo')
          .length === 4,
      'four notifications',
    );
    const told = sent.filter(
      (s) => s.body.title === 'Bạn có bài cần chấm chéo',
    );
    assert.deepEqual(
      told.map((s) => s.body.recipientUserId).sort(),
      [...learners].sort(),
    );
    for (const item of told) {
      assert.match(
        item.body.message,
        /Bạn có 2 bài nộp cần chấm cho "Scheduled"\. Vui lòng hoàn thành trước \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\./,
      );
      assert.equal(item.body.type, 'PEER_REVIEW');
      assert.equal(item.body.channel, 'IN_APP');
      assert.equal(item.body.organizationId, ORG);
      assert.equal(JSON.parse(item.body.metadata).cycleId, cycleId);
      // notification-service only takes service calls: the key and no user (a user gets 403)
      assert.equal(item.hasInternalKey, true);
      assert.equal(item.hasUserId, false);
    }
  });

  test('too few submissions: the Instructor grades them (BR-242)', async () => {
    const { cycleId } = await makeCycle({
      status: 'Open',
      closesInHours: -2,
      dueInHours: 70,
      learners: [id(11), id(12)],
    });
    await until(
      async () => (await cycle(cycleId)).status === 'InstructorOnly',
      'the cycle to be InstructorOnly',
    );
    const rows = await db.query(
      `SELECT grading_status, intervention_reason FROM submissions WHERE cycle_id = $1`,
      [cycleId],
    );
    for (const row of rows) {
      assert.equal(row.grading_status, 'AwaitingInstructor');
      assert.equal(row.intervention_reason, 'TOO_FEW_SUBMISSIONS');
    }
    assert.equal(
      await count(
        `SELECT count(*) FROM submission_reviews WHERE cycle_id = $1`,
        [cycleId],
      ),
      0,
    );
  });

  test('a cycle still open is left alone', async () => {
    const { cycleId } = await makeCycle({
      status: 'Open',
      closesInHours: 48,
      dueInHours: 120,
      learners: [id(21), id(22), id(23)],
    });
    await sleep(1000);
    assert.equal((await cycle(cycleId)).status, 'Open');
  });

  test('inside the reminder window, each Learner who owes reviews is reminded once (BR-232)', async () => {
    const learners = [id(31), id(32), id(33)];
    const { cycleId, submissionIds, release } = await makeCycle({
      status: 'Assigned',
      closesInHours: -50,
      dueInHours: 20, // reminder_hours is 24, so the window is open
      learners,
      parked: true,
    });
    await makeReviews(cycleId, submissionIds, learners, new Set());
    await release();
    await until(
      async () => (await cycle(cycleId)).reminded_at !== null,
      'the reminder to be recorded',
    );
    await until(
      () =>
        sent.filter((s) => s.body.title === 'Sắp đến hạn chấm chéo').length >= 3,
      'three reminders',
    );
    await sleep(1000); // several more runs of the timer
    const reminders = sent.filter(
      (s) => s.body.title === 'Sắp đến hạn chấm chéo',
    );
    assert.equal(reminders.length, 3, 'once per Learner, not once per run');
    assert.deepEqual(
      reminders.map((s) => s.body.recipientUserId).sort(),
      [...learners].sort(),
    );
    assert.match(reminders[0].body.message, /Bạn còn 2 bài nộp chưa chấm/);
  });

  test('outside the reminder window nobody is reminded', async () => {
    const learners = [id(41), id(42), id(43)];
    const { cycleId, submissionIds, release } = await makeCycle({
      status: 'Assigned',
      closesInHours: -10,
      dueInHours: 60, // more than 24 hours away
      learners,
      parked: true,
    });
    await makeReviews(cycleId, submissionIds, learners, new Set());
    await release();
    const before = sent.length;
    await sleep(1000);
    assert.equal((await cycle(cycleId)).reminded_at, null);
    assert.equal(sent.length, before);
  });

  test('past the review deadline: what was not reviewed goes to the Instructor, who skipped is marked (BR-236, BR-237, BR-243, BR-239)', async () => {
    const learners = [id(51), id(52), id(53), id(54)];
    const { cycleId, submissionIds, release } = await makeCycle({
      status: 'Assigned',
      closesInHours: -100,
      dueInHours: -1,
      learners,
      parked: true,
    });
    // ring of 4, N = 2: the author at i is reviewed by i + 1 and i + 2. Done: both reviews of submission 0 and the review
    // of submission 1 by Learner 2. So Learner 2 did all its work; Learners 0, 1 and 3 skipped some.
    await makeReviews(
      cycleId,
      submissionIds,
      learners,
      new Set(['0:1', '0:2', '1:2']),
    );
    for (const learner of learners) await state(learner);
    // L0 was waived by the Instructor (BR-241): it stays unmarked
    await db.query(
      `UPDATE learner_assessment_states SET exempted_at = now() WHERE learner_id = $1`,
      [learners[0]],
    );
    // now the review deadline passes
    await release();

    await until(
      async () => (await cycle(cycleId)).status === 'Completed',
      'the cycle to be Completed',
    );

    assert.equal(
      await count(
        `SELECT count(*) FROM submission_reviews WHERE cycle_id = $1 AND status = 'Pending'`,
        [cycleId],
      ),
      0,
    );
    const grading = await db.query(
      `SELECT learner_id, grading_status, intervention_reason FROM submissions WHERE cycle_id = $1 ORDER BY submitted_at, content`,
      [cycleId],
    );
    const byLearner = new Map(
      grading.map((row) => [row.learner_id as string, row]),
    );
    // submission 0 got both reviews: it stays with the peer review
    assert.equal(
      byLearner.get(learners[0])?.grading_status,
      'AwaitingPeerReview',
    );
    for (const learner of learners.slice(1)) {
      assert.equal(
        byLearner.get(learner)?.grading_status,
        'AwaitingInstructor',
      );
      assert.equal(
        byLearner.get(learner)?.intervention_reason,
        'REVIEW_MISSED',
      );
    }

    // who still had a Pending review marked Missed: reviewers of the other 3 submissions that were not done
    const missed = (
      await db.query(
        `SELECT DISTINCT reviewer_id FROM submission_reviews WHERE cycle_id = $1 AND status = 'Missed'`,
        [cycleId],
      )
    ).map((row) => row.reviewer_id as string);
    const marked = (
      await db.query(
        `SELECT learner_id FROM learner_assessment_states WHERE assessment_id = $1 AND peer_review_obligation = 'Missed'`,
        [assignment],
      )
    ).map((row) => row.learner_id as string);
    // everyone who skipped, except the one the Instructor waived
    assert.deepEqual(
      marked.sort(),
      missed.filter((learner) => learner !== learners[0]).sort(),
    );
    assert.ok(marked.length > 0);
    assert.ok(!marked.includes(learners[0]));
  });

  test('running again changes nothing: every step is claimed once', async () => {
    const snapshot = async () =>
      JSON.stringify([
        await db.query(
          `SELECT id, status, reminded_at, completed_at FROM peer_review_cycles ORDER BY id`,
        ),
        await db.query(`SELECT id, status FROM submission_reviews ORDER BY id`),
        await db.query(
          `SELECT id, grading_status FROM submissions ORDER BY id`,
        ),
      ]);
    const first = await snapshot();
    const sentBefore = sent.length;
    await sleep(1200);
    assert.equal(await snapshot(), first);
    assert.equal(sent.length, sentBefore);
  });

  test('after a stop, the cycles that are past their closing line close oldest first (BR-230)', async () => {
    const older = await makeCycle({
      status: 'Open',
      closesInHours: -50,
      dueInHours: 22,
      learners: [id(80), id(81), id(82)],
      parked: true,
    });
    const newer = await makeCycle({
      status: 'Open',
      closesInHours: -2,
      dueInHours: 70,
      learners: [id(83), id(84), id(85)],
      parked: true,
    });
    // both become due in one statement, while the schedule was not looking: one run has to close the two of them
    await db.query(
      `UPDATE peer_review_cycles
          SET closes_at = now() - CASE id WHEN $1 THEN 50 ELSE 2 END * interval '1 hour',
              review_due_at = now() + CASE id WHEN $1 THEN 22 ELSE 70 END * interval '1 hour'
        WHERE id IN ($1, $2)`,
      [older.cycleId, newer.cycleId],
    );
    const status = async (cycleId: string) =>
      (
        await db.query(`SELECT status FROM peer_review_cycles WHERE id = $1`, [
          cycleId,
        ])
      )[0].status;
    const noticesOf = (cycleId: string) =>
      sent.filter(
        (item) =>
          item.body.title === 'Bạn có bài cần chấm chéo' &&
          JSON.parse(item.body.metadata).cycleId === cycleId,
      ).length;
    await until(
      async () =>
        (await status(older.cycleId)) === 'Assigned' &&
        (await status(newer.cycleId)) === 'Assigned' &&
        noticesOf(older.cycleId) === 3 &&
        noticesOf(newer.cycleId) === 3,
      'both cycles to be closed and their reviewers told',
    );
    // One run closes them with the same "now", so the order is the order of the notices: the older cycle's come first.
    const firstNoticeOf = (cycleId: string) =>
      sent.findIndex(
        (item) =>
          item.body.title === 'Bạn có bài cần chấm chéo' &&
          JSON.parse(item.body.metadata).cycleId === cycleId,
      );
    assert.ok(
      firstNoticeOf(older.cycleId) < firstNoticeOf(newer.cycleId),
      'the older cycle is closed, and its reviewers told, before the newer one',
    );
  });
});
