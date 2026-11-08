/**
 * The status-changed events of a peer review cycle (#234): when a cycle closes each reviewer gets `PeerReviewAssigned`,
 * when the review deadline passes each reviewer who skipped something gets `PeerReviewMissed`. Through the real service
 * (its timer runs every 200 ms) and a real Postgres; the cycles are written into the database in the state the clock
 * would have brought them to. The events are read from the outbox and checked against the completion snapshot, which is
 * what learning reads when it gets them.
 */
import assert from 'node:assert/strict';
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
  `00000000-0000-4000-8000-${(0xe0 + n).toString(16).padStart(12, '0')}`;
const PARKED_HOURS = 100_000;

interface StatusEvent {
  aggregate_id: string;
  organization_id: string;
  occurred_at: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

describe('peer review cycle status events', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let assignment: string;

  const until = async (check: () => Promise<boolean>, what: string) => {
    for (let i = 0; i < 80; i += 1) {
      if (await check()) return;
      await sleep(200);
    }
    assert.fail(`timed out waiting for: ${what}`);
  };
  const cycle = async (cycleId: string) =>
    (
      await db.query(
        `SELECT status, closed_at, completed_at FROM peer_review_cycles WHERE id = $1`,
        [cycleId],
      )
    )[0];
  /** The status-changed events of one status written for one cycle. */
  const events = async (cycleId: string, status: string) =>
    (await db.query(
      `SELECT aggregate_id, organization_id, occurred_at, payload FROM outbox_events
         WHERE event_type = 'LearnerAssessmentStatusChanged' AND payload ->> 'status' = $1
           AND payload ->> 'cycleId' = $2 ORDER BY payload ->> 'learnerId'`,
      [status, cycleId],
    )) as unknown as StatusEvent[];
  const snapshotOf = async (learner: string) => {
    const response = await fetch(
      `${service.baseUrl}/api/v1/internal/learners/${learner}/courses/${COURSE}/completion-snapshot`,
      { headers: { 'x-internal-key': KEY, 'x-organization-id': ORG } },
    );
    assert.equal(response.status, 200);
    return ((await response.json()) as { data: any }).data; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  const state = (learner: string) =>
    db.query(
      `INSERT INTO learner_assessment_states (id, organization_id, assessment_id, learner_id, first_activity_at,
              created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, now(), now(), now()) RETURNING id`,
      [ORG, assignment, learner],
    );
  /** A cycle with one submission per Learner. It is parked far away until `release`, so the timer leaves it alone. */
  const makeCycle = async (
    status: 'Open' | 'Assigned',
    learners: string[],
    closesInHours: number,
    dueInHours: number,
  ) => {
    const [{ id: cycleId }] = await db.query(
      `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
              reviewers_per_submission, score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '9 days', now() + $3::int * interval '1 hour',
               now() + $3::int * interval '1 hour', 2, 20, 24, $4, $5, now(), now()) RETURNING id`,
      [
        ORG,
        assignment,
        PARKED_HOURS,
        status,
        status === 'Assigned' ? learners : [],
      ],
    );
    const submissionIds: string[] = [];
    for (const [index, learner] of learners.entries()) {
      const [row] = await db.query(
        `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content,
                submitted_at, cycle_id, grading_status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, now() - interval '8 days', $5, 'AwaitingPeerReview', now(), now())
         RETURNING id`,
        [ORG, assignment, learner, `answer ${index}`, cycleId],
      );
      submissionIds.push(row.id as string);
    }
    const release = () =>
      db.query(
        `UPDATE peer_review_cycles SET closes_at = now() + $2::int * interval '1 hour',
                review_due_at = now() + $3::int * interval '1 hour' WHERE id = $1`,
        [cycleId, closesInHours, dueInHours],
      );
    return { cycleId: cycleId as string, submissionIds, release };
  };
  /** The reviews of a ring: the author at i is reviewed by i + 1 and i + 2; `done` is "authorIndex:reviewerIndex". */
  const makeReviews = async (
    cycleId: string,
    submissionIds: string[],
    learners: string[],
    done: Set<string>,
  ) => {
    for (let i = 0; i < learners.length; i += 1) {
      for (let k = 1; k <= 2; k += 1) {
        const reviewer = (i + k) % learners.length;
        const finished = done.has(`${i}:${reviewer}`);
        await db.query(
          `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role,
                  status, score, comment, completed_at, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', $5, $6, $7, $8, now(), now())`,
          [
            ORG,
            submissionIds[i],
            cycleId,
            learners[reviewer],
            finished ? 'Completed' : 'Pending',
            finished ? 80 : null,
            finished ? 'fine' : null,
            finished ? new Date() : null,
          ],
        );
      }
    }
  };

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      PEER_REVIEW_TICK_MS: '200',
    });
    const api = apiFor(service.baseUrl);
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Status events',
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
    await db?.drop();
  });

  describe('closing a cycle: PeerReviewAssigned', () => {
    const learners = [id(1), id(2), id(3), id(4)];
    let cycleId: string;
    let stateIds: Map<string, string>;

    test('every reviewer gets one event, with the fields learning and the contract expect', async () => {
      stateIds = new Map();
      for (const learner of learners) {
        const [row] = await state(learner);
        stateIds.set(learner, row.id as string);
      }
      const made = await makeCycle('Open', learners, -1, 71);
      cycleId = made.cycleId;
      await made.release();
      await until(
        async () => (await cycle(cycleId)).status === 'Assigned',
        'the cycle to be Assigned',
      );

      const sent = await events(cycleId, 'PeerReviewAssigned');
      assert.deepEqual(
        sent.map((e) => e.payload.learnerId),
        [...learners].sort(),
        'one event for each of the 4 reviewers',
      );
      const closedAt = new Date(
        (await cycle(cycleId)).closed_at as Date,
      ).getTime();
      for (const event of sent) {
        const learner = event.payload.learnerId as string;
        // the aggregate is the state of the Learner on the Assignment, as for the other status events
        assert.equal(event.aggregate_id, stateIds.get(learner));
        assert.equal(event.organization_id, ORG);
        assert.equal(new Date(event.occurred_at).getTime(), closedAt);
        assert.deepEqual(
          { ...event.payload, revision: '*', firstActivityAt: '*' },
          {
            assessmentId: assignment,
            courseId: COURSE,
            learnerId: learner,
            organizationId: ORG,
            kind: 'ASSIGNMENT',
            status: 'PeerReviewAssigned',
            reason: 'PEER_REVIEW_ASSIGNED',
            revision: '*',
            firstActivityAt: '*',
            cycleId,
            reviewCount: 2,
          },
        );
        assert.equal(typeof event.payload.revision, 'string');
        assert.ok(event.payload.revision.length > 0);
        assert.ok(!Number.isNaN(Date.parse(event.payload.firstActivityAt)));
      }
    });

    test('the revision is the one of the completion snapshot after the closing: the reviews existed when the event was written', async () => {
      for (const event of await events(cycleId, 'PeerReviewAssigned')) {
        const snapshot = await snapshotOf(event.payload.learnerId as string);
        assert.equal(event.payload.revision, snapshot.revision);
        // the duty the event is about: the Learner owes reviews now
        assert.equal(snapshot.assignments[0].peerReview.status, 'Pending');
        assert.equal(snapshot.assignments[0].peerReview.requiredCount, 2);
      }
    });

    test('the schedule runs again and again: no second event for the same closing', async () => {
      await sleep(1000);
      assert.equal((await events(cycleId, 'PeerReviewAssigned')).length, 4);
    });

    test('too few submissions: the cycle goes to the Instructor and nobody gets an event', async () => {
      const few = [id(11), id(12)];
      for (const learner of few) await state(learner);
      const made = await makeCycle('Open', few, -2, 70);
      await made.release();
      await until(
        async () => (await cycle(made.cycleId)).status === 'InstructorOnly',
        'the cycle to be InstructorOnly',
      );
      assert.equal(
        (await events(made.cycleId, 'PeerReviewAssigned')).length,
        0,
      );
    });

    test('a Learner with no state row is left out and the closing still happens', async () => {
      const group = [id(21), id(22), id(23)];
      for (const learner of group.slice(0, 2)) await state(learner); // id(23) has none
      const made = await makeCycle('Open', group, -1, 71);
      await made.release();
      await until(
        async () => (await cycle(made.cycleId)).status === 'Assigned',
        'the cycle to be Assigned',
      );
      assert.deepEqual(
        (await events(made.cycleId, 'PeerReviewAssigned')).map(
          (e) => e.payload.learnerId,
        ),
        group.slice(0, 2),
      );
    });

    test('an event that cannot be written undoes the closing, and the next run closes it', async () => {
      const group = [id(31), id(32), id(33)];
      for (const learner of group) await state(learner);
      await db.query(
        `CREATE FUNCTION refuse_assigned_event() RETURNS trigger LANGUAGE plpgsql AS
         $$ BEGIN
              IF NEW.payload ->> 'status' = 'PeerReviewAssigned' THEN RAISE EXCEPTION 'refused for the test'; END IF;
              RETURN NEW;
            END $$`,
      );
      await db.query(
        `CREATE TRIGGER refuse_assigned_event BEFORE INSERT ON outbox_events
         FOR EACH ROW EXECUTE FUNCTION refuse_assigned_event()`,
      );
      const made = await makeCycle('Open', group, -1, 71);
      await made.release();
      await sleep(1500); // several runs fail
      const stuck = await cycle(made.cycleId);
      assert.equal(stuck.status, 'Open', 'the cycle was not closed');
      assert.equal(stuck.closed_at, null);
      assert.equal(
        (
          await db.query(
            `SELECT 1 FROM submission_reviews WHERE cycle_id = $1`,
            [made.cycleId],
          )
        ).length,
        0,
        'no review was kept',
      );
      await db.query(`DROP TRIGGER refuse_assigned_event ON outbox_events`);
      await db.query(`DROP FUNCTION refuse_assigned_event()`);
      await until(
        async () => (await cycle(made.cycleId)).status === 'Assigned',
        'the cycle to be closed once the failure is gone',
      );
      assert.equal(
        (await events(made.cycleId, 'PeerReviewAssigned')).length,
        3,
      );
    });
  });

  describe('the review deadline passes: PeerReviewMissed', () => {
    const learners = [id(51), id(52), id(53), id(54)];
    let cycleId: string;

    test('only the reviewers who skipped something get an event, with how many they skipped', async () => {
      for (const learner of learners) await state(learner);
      const made = await makeCycle('Assigned', learners, -100, -1);
      cycleId = made.cycleId;
      // ring of 4, N = 2. Done: both reviews of submission 0 and the review of submission 1 by Learner 2.
      // So Learner 2 did everything; Learner 0 skipped 2, Learner 1 skipped 1, Learner 3 skipped 2.
      await makeReviews(
        cycleId,
        made.submissionIds,
        learners,
        new Set(['0:1', '0:2', '1:2']),
      );
      await made.release();
      await until(
        async () => (await cycle(cycleId)).status === 'Completed',
        'the cycle to be Completed',
      );

      const sent = await events(cycleId, 'PeerReviewMissed');
      assert.deepEqual(
        sent.map((e) => [e.payload.learnerId, e.payload.missedCount]),
        [
          [learners[0], 2],
          [learners[1], 1],
          [learners[3], 2],
        ],
        'Learner 2 gave all its reviews and gets nothing',
      );
      const completedAt = new Date(
        (await cycle(cycleId)).completed_at as Date,
      ).getTime();
      for (const event of sent) {
        assert.equal(new Date(event.occurred_at).getTime(), completedAt);
        assert.deepEqual(
          {
            ...event.payload,
            revision: '*',
            firstActivityAt: '*',
            missedCount: '*',
          },
          {
            assessmentId: assignment,
            courseId: COURSE,
            learnerId: event.payload.learnerId,
            organizationId: ORG,
            kind: 'ASSIGNMENT',
            status: 'PeerReviewMissed',
            reason: 'PEER_REVIEW_MISSED',
            revision: '*',
            firstActivityAt: '*',
            cycleId,
            missedCount: '*',
          },
        );
      }
    });

    test('the revision is the one of the completion snapshot, and the snapshot says Missed', async () => {
      for (const event of await events(cycleId, 'PeerReviewMissed')) {
        const snapshot = await snapshotOf(event.payload.learnerId as string);
        assert.equal(event.payload.revision, snapshot.revision);
        assert.equal(snapshot.assignments[0].peerReview.status, 'Missed');
      }
      // the one who gave everything is not Missed, and has no event
      const done = await snapshotOf(learners[2]);
      assert.notEqual(done.assignments[0].peerReview.status, 'Missed');
    });

    test('the schedule runs again: no second event, and a reviewer who gave everything never gets one', async () => {
      await sleep(1000);
      assert.equal((await events(cycleId, 'PeerReviewMissed')).length, 3);
      assert.equal(
        (await events(cycleId, 'PeerReviewMissed')).filter(
          (e) => e.payload.learnerId === learners[2],
        ).length,
        0,
      );
    });

    test('a cycle where everybody gave all their reviews has no event at all', async () => {
      const group = [id(61), id(62), id(63)];
      for (const learner of group) await state(learner);
      const made = await makeCycle('Assigned', group, -100, -1);
      await makeReviews(
        made.cycleId,
        made.submissionIds,
        group,
        new Set(['0:1', '0:2', '1:2', '1:0', '2:0', '2:1']),
      );
      await made.release();
      await until(
        async () => (await cycle(made.cycleId)).status === 'Completed',
        'the cycle to be Completed',
      );
      assert.equal((await events(made.cycleId, 'PeerReviewMissed')).length, 0);
    });

    test('an event that cannot be written undoes the marks, and the next run does them again', async () => {
      const group = [id(71), id(72), id(73)];
      for (const learner of group) await state(learner);
      await db.query(
        `CREATE FUNCTION refuse_missed_event() RETURNS trigger LANGUAGE plpgsql AS
         $$ BEGIN
              IF NEW.payload ->> 'status' = 'PeerReviewMissed' THEN RAISE EXCEPTION 'refused for the test'; END IF;
              RETURN NEW;
            END $$`,
      );
      await db.query(
        `CREATE TRIGGER refuse_missed_event BEFORE INSERT ON outbox_events
         FOR EACH ROW EXECUTE FUNCTION refuse_missed_event()`,
      );
      const made = await makeCycle('Assigned', group, -100, -1);
      await makeReviews(made.cycleId, made.submissionIds, group, new Set());
      await made.release();
      await sleep(1500);
      const stuck = await cycle(made.cycleId);
      assert.equal(stuck.status, 'Assigned', 'the cycle was not completed');
      assert.equal(
        (
          await db.query(
            `SELECT 1 FROM submission_reviews WHERE cycle_id = $1 AND status = 'Missed'`,
            [made.cycleId],
          )
        ).length,
        0,
        'no review was marked Missed',
      );
      await db.query(`DROP TRIGGER refuse_missed_event ON outbox_events`);
      await db.query(`DROP FUNCTION refuse_missed_event()`);
      await until(
        async () => (await cycle(made.cycleId)).status === 'Completed',
        'the cycle to be completed once the failure is gone',
      );
      assert.equal((await events(made.cycleId, 'PeerReviewMissed')).length, 3);
    });
  });
});
