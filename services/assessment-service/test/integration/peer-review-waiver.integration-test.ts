/**
 * UC33.2 (BR-241) through the real HTTP API and a real Postgres: the Instructor waives the peer review duty of a Learner
 * who owes it. The cycles, the submissions and the reviews are written straight into the database in the state the
 * clock would have left them (the schedule is switched off), notification-service is a small stub that records what it
 * was sent. The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  INSTRUCTOR,
  KEY,
  ORG,
  OTHER_INSTRUCTOR,
  startCourseStub,
  startService,
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';
import { brokenRules } from '../unit/completion-contract';

const learner = (i: number) =>
  `00000000-0000-4000-8000-${(0xe0 + i).toString(16).padStart(12, '0')}`;

interface Sent {
  path: string;
  body: Record<string, string>;
  hasInternalKey: boolean;
  hasUserId: boolean;
}

describe('UC33.2 waiving a peer review duty over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let notifier: Server;
  let sent: Sent[];
  let notifierStatus = 201;
  let api: ReturnType<typeof apiFor>;
  let assignment: string;
  let direct: string;

  const waive = (learnerId: string, id = assignment, headers = identity()) =>
    api(
      'POST',
      `/assignments/${id}/peer-review/learners/${learnerId}/waiver`,
      undefined,
      headers,
    );
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query(sql, params))[0].count);
  const events = (who: string) =>
    count(
      `SELECT count(*) FROM outbox_events
        WHERE event_type = 'LearnerAssessmentStatusChanged' AND payload->>'status' = 'PeerReviewWaived'
          AND payload->>'learnerId' = $1`,
      [who],
    );
  const detail = (cycleId: string, id = assignment, headers = identity()) =>
    api(
      'GET',
      `/assignments/${id}/peer-review/cycles/${cycleId}`,
      undefined,
      headers,
    );
  const firstCycle = async () =>
    (
      await db.query(
        `SELECT id FROM peer_review_cycles WHERE assessment_id = $1 ORDER BY created_at LIMIT 1`,
        [assignment],
      )
    )[0].id as string;
  const exempted = async (who: string) =>
    (
      await db.query(
        `SELECT exempted_at, exempted_by FROM learner_assessment_states WHERE assessment_id = $1 AND learner_id = $2`,
        [assignment, who],
      )
    )[0];
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
  const until = async (check: () => boolean, what: string) => {
    for (let i = 0; i < 50; i += 1) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(`timed out waiting for: ${what}`);
  };

  /**
   * One cycle, already handed out (status Assigned), with a submission for each Learner and the reviews each reviewer
   * owes: `Missed`, `Completed` or `Pending` (before its deadline), the same for every review of that reviewer.
   */
  const makeCycle = async (
    reviewers: { id: string; reviews: 'Missed' | 'Completed' | 'Pending' }[],
  ) => {
    const ids = reviewers.map((r) => r.id);
    const [{ id: cycleId }] = await db.query(
      `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
              reviewers_per_submission, score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '9 days', now() - interval '2 days', now() + interval '100000 hours',
               2, 20, 24, 'Assigned', $3, now(), now()) RETURNING id`,
      [ORG, assignment, ids],
    );
    const submissions: string[] = [];
    for (const [index, who] of ids.entries()) {
      const [row] = await db.query(
        `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
                submitted_at, cycle_id, grading_status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, now() - interval '8 days', $5, 'AwaitingPeerReview', now(), now())
         RETURNING id`,
        [ORG, assignment, who, `answer ${index}`, cycleId],
      );
      submissions.push(row.id as string);
      await db.query(
        `INSERT INTO learner_assessment_states (id, organization_id, assessment_id, learner_id, first_activity_at,
                created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now() - interval '8 days', now(), now())`,
        [ORG, assignment, who],
      );
    }
    for (let i = 0; i < ids.length; i += 1) {
      for (let k = 1; k <= 2; k += 1) {
        const reviewer = reviewers[(i + k) % ids.length];
        await db.query(
          `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role,
                  status, score, comment, completed_at, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', $5, $6, $7, $8, now(), now())`,
          [
            ORG,
            submissions[i],
            cycleId,
            reviewer.id,
            reviewer.reviews,
            reviewer.reviews === 'Completed' ? 80 : null,
            reviewer.reviews === 'Completed' ? 'fine' : null,
            reviewer.reviews === 'Completed' ? new Date() : null,
          ],
        );
      }
    }
  };

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    sent = [];
    notifier = createServer((request, response) => {
      let raw = '';
      request.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      request.on('end', () => {
        sent.push({
          path: request.url ?? '',
          body: JSON.parse(raw) as Record<string, string>,
          hasInternalKey: request.headers['x-internal-key'] === KEY,
          hasUserId: request.headers['x-user-id'] !== undefined,
        });
        response.writeHead(notifierStatus, {
          'content-type': 'application/json',
        });
        response.end('{}');
      });
    });
    await new Promise<void>((resolve) => notifier.listen(0, resolve));
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      TENANT_CLIENT_MODE: 'fake',
      PEER_REVIEW_TICK_MS: '3600000', // the schedule stays out of the way: the states are written by the test
      NOTIFICATION_CLIENT_MODE: 'http',
      NOTIFICATION_SERVICE_URL: `http://127.0.0.1:${(notifier.address() as AddressInfo).port}`,
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
    assignment = await create('Reviewed <b>work</b>');
    direct = await create('Direct');
    const on = await api('PUT', `/assignments/${assignment}/peer-review`, {
      enabled: true,
      reviewersPerSubmission: 2,
      scoreGap: 20,
    });
    assert.equal(on.status, 200, JSON.stringify(on.json));
    // L0 and L3 missed their reviews, L1 did them all, L2 still has time
    await makeCycle([
      { id: learner(0), reviews: 'Missed' },
      { id: learner(1), reviews: 'Completed' },
      { id: learner(2), reviews: 'Pending' },
      { id: learner(3), reviews: 'Missed' },
    ]);
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await new Promise<void>((resolve) => notifier?.close(() => resolve()));
    await db?.drop();
  });

  test('refused: a Learner (403), another Instructor (404), Peer Review off (409), a bad id (400)', async () => {
    assert.equal(
      (
        await waive(
          learner(0),
          assignment,
          identity({ user: learner(1), role: 'LEARNER' }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await waive(
          learner(0),
          assignment,
          identity({ user: OTHER_INSTRUCTOR }),
        )
      ).status,
      404,
    );
    assert.equal((await waive(learner(0), UNKNOWN)).status, 404);
    const off = await waive(learner(0), direct);
    assert.equal(off.status, 409);
    assert.equal(off.code, 'PEER_REVIEW_NOT_ENABLED');
    assert.equal((await waive('abc')).status, 400);
    assert.equal(
      await count(
        'SELECT count(*) FROM learner_assessment_states WHERE exempted_at IS NOT NULL',
      ),
      0,
    );
    assert.equal(sent.length, 0);
  });

  test('nothing to waive: reviews done, still in time, or a Learner who never took part (409)', async () => {
    for (const who of [learner(1), learner(2), learner(9)]) {
      const r = await waive(who);
      assert.equal(r.status, 409, `${who} ${JSON.stringify(r.json)}`);
      assert.equal(r.code, 'NOT_OWING_PEER_REVIEW');
    }
    assert.equal(
      await count(
        'SELECT count(*) FROM learner_assessment_states WHERE exempted_at IS NOT NULL',
      ),
      0,
    );
    assert.equal(
      await count(
        "SELECT count(*) FROM outbox_events WHERE payload->>'status' = 'PeerReviewWaived'",
      ),
      0,
    );
    assert.equal(sent.length, 0);
  });

  test('UC33.1 refused: a Learner (403), another Instructor (404), Peer Review off (409), a cycle that is not there or not of this Assignment (404), a bad id (400)', async () => {
    const cycleId = await firstCycle();
    assert.equal(
      (
        await detail(
          cycleId,
          assignment,
          identity({ user: learner(1), role: 'LEARNER' }),
        )
      ).status,
      403,
    );
    assert.equal(
      (await detail(cycleId, assignment, identity({ user: OTHER_INSTRUCTOR })))
        .status,
      404,
    );
    const off = await detail(cycleId, direct);
    assert.equal(off.status, 409);
    assert.equal(off.code, 'PEER_REVIEW_NOT_ENABLED');
    const missing = await detail(UNKNOWN);
    assert.equal(missing.status, 404);
    assert.equal(missing.code, 'CYCLE_NOT_FOUND');
    assert.equal((await detail('abc')).status, 400);
  });

  test('UC33.1 the cycle: submissions with the reviews they got, and the reviewers with the state of their duty', async () => {
    const cycleId = await firstCycle();
    const r = await detail(cycleId);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.assignmentId, assignment);
    assert.equal(r.data.title, 'Reviewed <b>work</b>');
    assert.equal(r.data.cycle.id, cycleId);
    assert.equal(r.data.cycle.status, 'Assigned');
    assert.equal(r.data.cycle.closed, true); // a status other than Open means the closing has run
    assert.equal(r.data.cycle.submissionCount, 4);
    assert.equal(r.data.cycle.reviewersPerSubmission, 2);

    // the ring: the author at i is reviewed by i + 1 and i + 2 (L0 and L3 Missed, L1 Completed, L2 Pending)
    const submissions = r.data.submissions as {
      learnerId: string;
      fullName: string;
      reviewsAssigned: number;
      reviewsCompleted: number;
      reviewsMissing: number;
    }[];
    assert.deepEqual(
      submissions
        .map((s) => [
          s.learnerId,
          s.reviewsAssigned,
          s.reviewsCompleted,
          s.reviewsMissing,
        ])
        .sort(),
      [
        [learner(0), 2, 1, 1],
        [learner(1), 2, 0, 2],
        [learner(2), 2, 0, 2],
        [learner(3), 2, 1, 1],
      ],
    );
    assert.match(submissions[0].fullName, /^Learner [0-9A-F]{4}$/);

    const reviewers = r.data.reviewers as {
      learnerId: string;
      assigned: number;
      completed: number;
      obligation: string;
      canWaive: boolean;
    }[];
    const row = (who: string) => reviewers.find((x) => x.learnerId === who);
    assert.equal(reviewers.length, 4);
    assert.deepEqual(
      [0, 1, 2, 3].map((i) => [
        row(learner(i))?.assigned,
        row(learner(i))?.completed,
        row(learner(i))?.obligation,
        row(learner(i))?.canWaive,
      ]),
      [
        [2, 0, 'Missed', true],
        [2, 2, 'Satisfied', false],
        [2, 0, 'Pending', false],
        [2, 0, 'Missed', true],
      ],
    );
  });

  test('before the waiver the Learner who missed the reviews is Missed in the completion snapshot', async () => {
    const result = await snapshot(learner(0));
    assert.equal(result.assignments[0].peerReview.status, 'Missed');
    assert.equal(result.eligible, false);
  });

  test('the Instructor waives it: saved, the event is written, the Learner is told in the bell and by e-mail (BR-241)', async () => {
    const before = Date.now();
    const r = await waive(learner(0));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.assignmentId, assignment);
    assert.equal(r.data.learnerId, learner(0));
    assert.equal(r.data.alreadyWaived, false);
    assert.ok(Date.parse(r.data.waivedAt) >= before - 1000);

    const row = await exempted(learner(0));
    assert.ok(row.exempted_at);
    assert.equal(row.exempted_by, INSTRUCTOR);
    assert.equal(await events(learner(0)), 1);
    const [event] = await db.query(
      `SELECT organization_id, payload FROM outbox_events WHERE payload->>'learnerId' = $1 AND payload->>'status' = 'PeerReviewWaived'`,
      [learner(0)],
    );
    assert.equal(event.organization_id, ORG);
    const payload = event.payload as Record<string, string>;
    assert.equal(payload.assessmentId, assignment);
    assert.equal(payload.courseId, COURSE);
    assert.equal(payload.kind, 'ASSIGNMENT');

    await until(() => sent.length >= 2, 'the bell and the e-mail');
    const bell = sent.find((s) => s.path.endsWith('/notifications/send'));
    assert.ok(bell, JSON.stringify(sent));
    assert.equal(bell.body.recipientUserId, learner(0));
    assert.equal(bell.body.organizationId, ORG);
    assert.equal(bell.body.title, 'Bạn được miễn nghĩa vụ chấm chéo');
    assert.match(bell.body.message, /"Reviewed <b>work<\/b>"/);
    assert.equal(bell.hasInternalKey, true);
    assert.equal(bell.hasUserId, false);
    const mail = sent.find((s) => s.path.endsWith('/notifications/email/send'));
    assert.ok(mail, JSON.stringify(sent));
    assert.match(mail.body.recipientEmail, /@demo\.local$/);
    assert.equal(mail.body.subject, 'Bạn được miễn nghĩa vụ chấm chéo');
    assert.equal(mail.body.templateCode, 'PEER_REVIEW_WAIVED');
    assert.match(mail.body.body, /^Xin chào /);
    // plain text: a title with angle brackets must not turn the whole mail into HTML
    assert.equal(/[<>]/.test(mail.body.body), false);
    assert.equal(mail.hasInternalKey, true);
    assert.equal(mail.hasUserId, false);
  });

  test('after the waiver the snapshot says Waived, keeps the counts, and the Learner no longer owes the duty', async () => {
    const result = await snapshot(learner(0));
    assert.deepEqual(result.assignments[0].peerReview, {
      status: 'Waived',
      requiredCount: 2,
      completedCount: 0,
    });
    // the other Learner who missed the reviews is untouched
    assert.equal(
      (await snapshot(learner(3))).assignments[0].peerReview.status,
      'Missed',
    );
  });

  test('UC33.1 after the waiver the reviewer is Waived and cannot be waived again; the other one who missed is untouched', async () => {
    const r = await detail(await firstCycle());
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const row = (who: string) =>
      (
        r.data.reviewers as {
          learnerId: string;
          obligation: string;
          canWaive: boolean;
        }[]
      ).find((x) => x.learnerId === who);
    assert.deepEqual(
      [row(learner(0))?.obligation, row(learner(0))?.canWaive],
      ['Waived', false],
    );
    assert.deepEqual(
      [row(learner(3))?.obligation, row(learner(3))?.canWaive],
      ['Missed', true],
    );
  });

  test('waiving again answers 200 with the first date and changes nothing (no second event, no second notice)', async () => {
    const first = (await exempted(learner(0))).exempted_at as Date;
    const messages = sent.length;
    const r = await waive(learner(0));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.alreadyWaived, true);
    assert.equal(Date.parse(r.data.waivedAt), first.getTime());
    assert.equal(await events(learner(0)), 1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(sent.length, messages);
  });

  test('two requests at the same moment: one waives, the other finds it waived, one event, one notice each', async () => {
    const messages = sent.length;
    const [a, b] = await Promise.all([waive(learner(3)), waive(learner(3))]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.deepEqual([a.data.alreadyWaived, b.data.alreadyWaived].sort(), [
      false,
      true,
    ]);
    assert.equal(a.data.waivedAt, b.data.waivedAt);
    assert.equal(await events(learner(3)), 1);
    await until(() => sent.length >= messages + 2, 'the notices');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(sent.length, messages + 2);
  });

  test('a notification service that is down does not undo the waiver', async () => {
    await makeCycle([
      { id: learner(5), reviews: 'Missed' },
      { id: learner(6), reviews: 'Completed' },
      { id: learner(7), reviews: 'Completed' },
    ]);
    notifierStatus = 500;
    try {
      const r = await waive(learner(5));
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.alreadyWaived, false);
    } finally {
      notifierStatus = 201;
    }
    assert.ok((await exempted(learner(5))).exempted_at);
    assert.equal(await events(learner(5)), 1);
  });
});
