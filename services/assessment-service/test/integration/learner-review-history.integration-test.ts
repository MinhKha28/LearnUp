/**
 * UC31.2 through the real HTTP API and a real Postgres: the history of the reviews a Learner gave and where their peer
 * review duty stands. The cycles, the submissions and the reviews are written straight into the database in the state the
 * schedule and the Learners would have left them. The duty is also compared with the one the completion snapshot gives
 * learning-service, because the two must agree. The tests are one story and share state.
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
  UNKNOWN,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';
import { brokenRules } from '../unit/completion-contract';

const LEARNER_2 = '00000000-0000-4000-8000-0000000000c2';
const author = (i: number) =>
  `00000000-0000-4000-8000-${(0x9000 + i).toString(16).padStart(12, '0')}`;
const as = (user: string, org = ORG) =>
  identity({ user, role: 'LEARNER', org });

describe('UC31.2 the history of the reviews a Learner gave over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let essay: string; // one given, one still to give before the deadline: Pending
  let report: string; // all given: Satisfied
  let lab: string; // a review past its deadline, not given: Missed
  let project: string; // waived by the Instructor
  let disabledOne: string;
  let nextAuthor = 1;

  const history = (query = '', user = LEARNER, org = ORG) =>
    api(
      'GET',
      `/learner/peer-reviews/history${query}`,
      undefined,
      as(user, org),
    );
  const criteria = async (assignmentId: string) =>
    (await db.query(
      'SELECT id, name, max_points FROM rubric_criteria WHERE assessment_id = $1 ORDER BY position',
      [assignmentId],
    )) as { id: string; name: string; max_points: number }[];

  const makeCycle = async (
    assignmentId: string,
    dueInHours: number,
    closedDaysAgo = 9,
  ) => {
    const [row] = await db.query(
      `INSERT INTO peer_review_cycles (id, organization_id, assessment_id, opens_at, closes_at, review_due_at,
              reviewers_per_submission, score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - ($3 || ' days')::interval, now() - ($4 || ' days')::interval,
               now() + ($5 || ' hours')::interval, 2, 20, 24, 'Assigned', ARRAY[]::uuid[], now(), now()) RETURNING id`,
      [
        ORG,
        assignmentId,
        String(closedDaysAgo + 7),
        String(closedDaysAgo),
        String(dueInHours),
      ],
    );
    return row.id as string;
  };

  /** A review the Learner owes on the work of a new author; given (with points per criterion) or in the state asked. */
  const review = async (
    assignmentId: string,
    cycleId: string,
    status: 'Completed' | 'Pending' | 'Missed',
    over: {
      reviewer?: string;
      role?: string;
      score?: number;
      comment?: string;
      completedMinutesAgo?: number;
      points?: number[];
    } = {},
  ) => {
    const reviewer = over.reviewer ?? LEARNER;
    const who = author(nextAuthor++);
    const [sub] = await db.query(
      `INSERT INTO submissions (id, organization_id, assessment_id, learner_id, submission_number, content, submitted_at,
              cycle_id, grading_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, 'work of the author', now() - interval '8 days', $4,
               'AwaitingPeerReview', now(), now()) RETURNING id`,
      [ORG, assignmentId, who, cycleId],
    );
    const done = status === 'Completed';
    const [rev] = await db.query(
      `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status,
              score, comment, completed_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
               CASE WHEN $6 = 'Completed' THEN now() - ($9 || ' minutes')::interval END, now(), now()) RETURNING id`,
      [
        ORG,
        sub.id,
        cycleId,
        reviewer,
        over.role ?? 'Learner',
        status,
        done ? (over.score ?? 80) : null,
        done ? (over.comment ?? 'Bài làm tốt') : null,
        String(over.completedMinutesAgo ?? 10),
      ],
    );
    if (done && over.points) {
      const rubric = await criteria(assignmentId);
      for (const [i, c] of rubric.entries()) {
        await db.query(
          `INSERT INTO submission_review_scores (id, organization_id, review_id, criterion_id, points, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())`,
          [ORG, rev.id, c.id, over.points[i] ?? 0],
        );
      }
    }
    return rev.id as string;
  };

  const snapshot = async (who = LEARNER) => {
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
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      PEER_REVIEW_TICK_MS: '3600000',
    });
    api = apiFor(service.baseUrl);
    const create = async (title: string) => {
      const r = await api('POST', '/assignments', {
        courseId: COURSE,
        title,
        prompt: 'Write it',
        passingScore: 60,
        expectedDurationMinutes: 30,
        rubric: [
          { name: 'Nội dung', description: 'Đủ ý', maxPoints: 60 },
          { name: 'Trình bày', description: 'Rõ ràng', maxPoints: 40 },
        ],
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      return r.data.id as string;
    };
    essay = await create('Bài luận');
    report = await create('Báo cáo');
    lab = await create('Thực hành');
    project = await create('Dự án');
    disabledOne = await create('Bài đã tắt');
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  describe('who may ask', () => {
    test('a call without the internal key is refused (401), only a Learner may ask (403)', async () => {
      assert.equal(
        (await api('GET', '/learner/peer-reviews/history', undefined, {}))
          .status,
        401,
      );
      for (const role of ['INSTRUCTOR', 'ORGANIZER', 'ADMIN']) {
        const r = await api(
          'GET',
          '/learner/peer-reviews/history',
          undefined,
          identity({ role }),
        );
        assert.equal(r.status, 403, role);
      }
    });

    test('a page or an Assignment that is not valid is refused (400), not ignored', async () => {
      for (const query of [
        '?page=0',
        '?page=x',
        '?pageSize=0',
        '?pageSize=101',
        '?assignmentId=abc',
      ]) {
        assert.equal((await history(query)).status, 400, query);
      }
    });

    test('"history" is not read as the id of a review: the route answers the history, not a 400 for a bad UUID', async () => {
      const r = await history();
      assert.equal(r.status, 200, JSON.stringify(r.json));
    });
  });

  describe('a Learner with no review', () => {
    test('the duty does not apply and there is nothing to list', async () => {
      const r = await history();
      assert.equal(r.data.overall, 'NotApplicable');
      assert.deepEqual(r.data.obligations, []);
      assert.deepEqual(r.data.items, []);
      assert.deepEqual(
        [r.data.assignedCount, r.data.completedCount, r.data.total],
        [0, 0, 0],
      );
      assert.deepEqual([r.data.page, r.data.pageSize], [1, 20]);
    });
  });

  describe('the reviews given and the duty', () => {
    test('set up: four Assignments in four states of the duty, and rows that must not count', async () => {
      const cycleEssay = await makeCycle(essay, 48);
      await review(essay, cycleEssay, 'Completed', {
        score: 90,
        comment: 'Rất tốt',
        completedMinutesAgo: 30,
        points: [55, 35],
      });
      await review(essay, cycleEssay, 'Pending');

      const cycleReport = await makeCycle(report, 48);
      await review(report, cycleReport, 'Completed', {
        score: 70,
        completedMinutesAgo: 20,
        points: [40, 30],
      });
      await review(report, cycleReport, 'Completed', {
        score: 50,
        completedMinutesAgo: 10,
        points: [30, 20],
      });

      const cycleLab = await makeCycle(lab, -24); // the deadline passed a day ago
      await review(lab, cycleLab, 'Pending');

      const cycleProject = await makeCycle(project, 48);
      await review(project, cycleProject, 'Pending');
      await db.query(
        `INSERT INTO learner_assessment_states (id, organization_id, assessment_id, learner_id, first_activity_at, exempted_at, exempted_by, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now(), now(), $4, now(), now())`,
        [ORG, project, LEARNER, author(99)],
      );

      // not the Learner's: the Instructor's own review, another Learner's review, a review in another Organization
      await review(essay, cycleEssay, 'Completed', {
        role: 'Instructor',
        score: 99,
        completedMinutesAgo: 1,
      });
      await review(essay, cycleEssay, 'Completed', {
        reviewer: LEARNER_2,
        score: 11,
        completedMinutesAgo: 2,
      });
      // a disabled Assignment is not part of the duty (the snapshot leaves it out)
      const cycleDisabled = await makeCycle(disabledOne, 48);
      await review(disabledOne, cycleDisabled, 'Pending');
      await db.query(
        'UPDATE assessments SET disabled_at = now() WHERE id = $1',
        [disabledOne],
      );
    });

    test('the duty for each Assignment, the worst first, and as a whole', async () => {
      const r = await history();
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.data.overall, 'Missed');
      assert.deepEqual(
        r.data.obligations.map((o: any) => [
          o.assignmentTitle,
          o.status,
          o.requiredCount,
          o.completedCount,
        ]),
        [
          ['Thực hành', 'Missed', 1, 0],
          ['Bài luận', 'Pending', 2, 1],
          ['Dự án', 'Waived', 1, 0],
          ['Báo cáo', 'Satisfied', 2, 2],
        ],
      );
      assert.ok(r.data.obligations.every((o: any) => o.courseId === COURSE));
      assert.equal(r.data.assignedCount, 6);
      assert.equal(r.data.completedCount, 3);
    });

    test('the duty is the same as the one learning-service reads in the completion snapshot', async () => {
      const mine = (await history()).data.obligations as any[];
      const snap = (await snapshot()).assignments as any[];
      for (const o of mine) {
        const theirs = snap.find((a) => a.assessmentId === o.assignmentId);
        assert.ok(theirs, o.assignmentTitle);
        assert.deepEqual(
          [o.status, o.requiredCount, o.completedCount],
          [
            theirs.peerReview.status,
            theirs.peerReview.requiredCount,
            theirs.peerReview.completedCount,
          ],
          o.assignmentTitle,
        );
      }
      assert.equal(
        snap.find((a) => a.assessmentId === disabledOne),
        undefined,
        'the snapshot leaves the disabled one out, and so does the history',
      );
    });

    test('only the reviews the Learner gave are listed, the newest first, with the score and the points of each criterion', async () => {
      const r = await history();
      assert.equal(r.data.total, 3);
      assert.deepEqual(
        r.data.items.map((i: any) => [i.assignmentTitle, i.score]),
        [
          ['Báo cáo', 50],
          ['Báo cáo', 70],
          ['Bài luận', 90],
        ],
      );
      const first = r.data.items[2];
      assert.equal(first.comment, 'Rất tốt');
      assert.deepEqual(
        first.criteria.map((c: any) => [c.name, c.points, c.maxPoints]),
        [
          ['Nội dung', 55, 60],
          ['Trình bày', 35, 40],
        ],
      );
      assert.ok(first.completedAt);
      assert.equal(first.courseId, COURSE);
      for (let i = 1; i < r.data.items.length; i += 1) {
        assert.ok(
          new Date(r.data.items[i - 1].completedAt) >=
            new Date(r.data.items[i].completedAt),
          'newest first',
        );
      }
    });

    test('nothing says who wrote the work (BR-233): no author, no submission id, no file name', async () => {
      const text = JSON.stringify((await history()).json);
      assert.ok(!text.includes('work of the author'));
      for (let i = 1; i < nextAuthor; i += 1)
        assert.ok(!text.includes(author(i)), `author ${i}`);
      assert.ok(!/submissionId|authorId|learnerId|fileName/i.test(text));
    });

    test('paging cuts the list, not the duty', async () => {
      const first = await history('?pageSize=2&page=1');
      const second = await history('?pageSize=2&page=2');
      assert.deepEqual(
        [first.data.items.length, second.data.items.length],
        [2, 1],
      );
      assert.equal(first.data.total, 3);
      assert.equal(second.data.total, 3);
      assert.deepEqual([second.data.page, second.data.pageSize], [2, 2]);
      const ids = [...first.data.items, ...second.data.items].map(
        (i: any) => i.id,
      );
      assert.equal(new Set(ids).size, 3, 'no review twice, none left out');
      assert.deepEqual(first.data.obligations, second.data.obligations);
      assert.equal((await history('?page=9')).data.items.length, 0);
    });

    test('one Assignment can be asked for; an Assignment with no review of the Learner gives an empty page', async () => {
      const r = await history(`?assignmentId=${report}`);
      assert.equal(r.data.total, 2);
      assert.ok(r.data.items.every((i: any) => i.assignmentId === report));
      assert.equal(
        r.data.obligations.length,
        4,
        'the duty is still the whole of it',
      );
      assert.equal((await history(`?assignmentId=${lab}`)).data.total, 0);
      assert.equal((await history(`?assignmentId=${UNKNOWN}`)).data.total, 0);
    });
  });

  describe('the duty moves with the reviews', () => {
    test('giving the review that was still to give makes the Assignment Satisfied; a deadline that has not passed yet makes Missed Pending', async () => {
      await db.query(
        `UPDATE submission_reviews SET status = 'Completed', score = 75, comment = 'ok', completed_at = now()
          WHERE reviewer_id = $1 AND status = 'Pending'
            AND submission_id IN (SELECT id FROM submissions WHERE assessment_id = $2)`,
        [LEARNER, essay],
      );
      await db.query(
        `UPDATE peer_review_cycles SET review_due_at = now() + interval '5 hours' WHERE assessment_id = $1`,
        [lab],
      );
      let r = await history();
      const by = (title: string) =>
        r.data.obligations.find((o: any) => o.assignmentTitle === title);
      assert.equal(by('Bài luận').status, 'Satisfied');
      assert.equal(by('Thực hành').status, 'Pending');
      assert.equal(r.data.overall, 'Pending');
      assert.equal(r.data.total, 4);
      await db.query(
        `UPDATE peer_review_cycles SET review_due_at = now() - interval '1 hour' WHERE assessment_id = $1`,
        [lab],
      );
      r = await history();
      assert.equal(by('Thực hành').status, 'Missed');
    });

    test('once nothing is owed any more the duty as a whole is Satisfied, and a waived one counts as satisfied', async () => {
      await db.query(
        `UPDATE submission_reviews SET status = 'Completed', score = 66, comment = 'late but given', completed_at = now()
                       WHERE reviewer_id = $1 AND status IN ('Pending', 'Missed')`,
        [LEARNER],
      );
      const r = await history();
      assert.equal(r.data.overall, 'Satisfied');
      assert.ok(
        r.data.obligations.every((o: any) =>
          ['Satisfied', 'Waived'].includes(o.status),
        ),
      );
      const snap = (await snapshot()).assignments as any[];
      for (const o of r.data.obligations) {
        assert.equal(
          snap.find((a) => a.assessmentId === o.assignmentId).peerReview.status,
          o.status,
          o.assignmentTitle,
        );
      }
    });
  });

  describe('whose history', () => {
    test('another Learner sees only their own reviews and their own duty', async () => {
      const r = await history('', LEARNER_2);
      assert.equal(r.data.total, 1);
      assert.equal(r.data.items[0].score, 11);
      assert.equal(r.data.obligations.length, 1);
      assert.equal(r.data.obligations[0].assignmentTitle, 'Bài luận');
      assert.equal(r.data.obligations[0].status, 'Satisfied');
    });

    test('another Organization sees nothing', async () => {
      const r = await history('', LEARNER, OTHER_ORG);
      assert.equal(r.status, 200);
      assert.deepEqual(r.data.items, []);
      assert.deepEqual(r.data.obligations, []);
      assert.equal(r.data.overall, 'NotApplicable');
    });
  });
});
