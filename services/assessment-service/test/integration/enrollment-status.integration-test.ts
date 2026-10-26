/**
 * What the Enrollment allows (BR-210, L17) through the real HTTP API, a real Postgres and a fake Learning Service that
 * answers assessment-access: Full (NotStarted, InProgress, Exempted) lets the Learner work, ReadOnly (Completed) keeps
 * reading and refuses writing (409 ENROLLMENT_COMPLETED), None (Halted, Withdrawn) shuts the Learner out
 * (409 ENROLLMENT_NOT_ACTIVE), a Learner who is not enrolled gets 403 and a Learning Service that cannot answer gives 503.
 * The tests are one story.
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
  startCourseStub,
  startLearningStub,
  startService,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const as = identity({ user: LEARNER, role: 'LEARNER' });

describe('the Enrollment decides what the Learner may do', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: LearningStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignmentId: string;

  const view = () =>
    api('GET', `/learner/assignments/${assignmentId}`, undefined, as);
  const list = () =>
    api('GET', `/learner/courses/${COURSE}/assessments`, undefined, as);
  const latestResult = () =>
    api('GET', `/learner/assignments/${assignmentId}/result`, undefined, as);
  const send = async (kind: 'submissions' | 'resubmissions') => {
    const form = new FormData();
    form.append('content', 'my work');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/${kind}`,
      { method: 'POST', headers: as, body: form },
    );
    const json = (await response.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    return { status: response.status, code: json.error?.code };
  };

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    learning = await startLearningStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      LEARNING_SERVICE_URL: learning.url,
    });
    api = apiFor(service.baseUrl);
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Essay',
      prompt: 'Write it',
      passingScore: 70,
      expectedDurationMinutes: 30,
      maxConsecutiveAttempts: 50, // the lock of BR-218 is not what is tried here
      rubric: [{ name: 'A', description: 'a', maxPoints: 10 }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assignmentId = created.data.id;
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await learning?.stop();
    await db?.drop();
  });

  test('Full: the Learner can submit and resubmit, and nothing is read-only', async () => {
    assert.equal((await send('submissions')).status, 201);
    assert.equal((await send('resubmissions')).status, 201);
    assert.equal((await view()).data.readOnly, false);
    assert.equal((await list()).data.readOnly, false);
  });

  test('Learning Service is asked with the internal key, the Learner identity and the version of the Course', () => {
    const call = learning.calls[learning.calls.length - 1];
    assert.equal(call.learnerId, LEARNER);
    assert.equal(call.courseId, COURSE);
    assert.equal(call.headers['x-internal-key'], KEY);
    assert.equal(call.headers['x-user-id'], LEARNER);
    assert.equal(call.headers['x-user-role'], 'LEARNER');
  });

  test('ReadOnly (Completed): reading stays open, every write is refused with 409 ENROLLMENT_COMPLETED', async () => {
    learning.setAnswer(LEARNER, COURSE, 'ReadOnly');
    const submit = await send('submissions');
    assert.equal(submit.status, 409);
    assert.equal(submit.code, 'ENROLLMENT_COMPLETED');
    const again = await send('resubmissions');
    assert.equal(again.status, 409);
    assert.equal(again.code, 'ENROLLMENT_COMPLETED');
    const seen = await view();
    assert.equal(seen.status, 200);
    assert.equal(seen.data.readOnly, true);
    const listed = await list();
    assert.equal(listed.status, 200);
    assert.equal(listed.data.readOnly, true);
  });

  test('ReadOnly (Completed): the result of a Finalized submission can still be read, with one question to Learning Service', async () => {
    await db.query(
      `UPDATE submissions SET grading_status = 'Finalized', final_score = 80, finalized_at = now()
       WHERE assessment_id = $1 AND superseded_at IS NULL`,
      [assignmentId],
    );
    learning.setAnswer(LEARNER, COURSE, 'ReadOnly');
    const asked = learning.calls.length;
    const r = await latestResult();
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.finalScore, 80);
    assert.equal(learning.calls.length - asked, 1);
  });

  test('the answer is read at every request: Full again opens it again', async () => {
    learning.setAnswer(LEARNER, COURSE, 'Full');
    assert.equal((await send('resubmissions')).status, 201);
    assert.equal((await view()).data.readOnly, false);
  });

  test('None (Halted, Withdrawn): every screen is shut, 409 ENROLLMENT_NOT_ACTIVE, and nothing is saved', async () => {
    const before = Number(
      (await db.query('SELECT count(*) AS n FROM submissions'))[0].n,
    );
    learning.setAnswer(LEARNER, COURSE, 'None');
    for (const r of [await view(), await list(), await latestResult()]) {
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ENROLLMENT_NOT_ACTIVE');
    }
    for (const kind of ['submissions', 'resubmissions'] as const) {
      const r = await send(kind);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'ENROLLMENT_NOT_ACTIVE');
    }
    assert.equal(
      Number((await db.query('SELECT count(*) AS n FROM submissions'))[0].n),
      before,
    );
  });

  test('NotFound: a Learner who is not enrolled in the Course gets 403 NOT_ENROLLED', async () => {
    learning.setAnswer(LEARNER, COURSE, 'NotFound');
    const r = await view();
    assert.equal(r.status, 403);
    assert.equal(r.code, 'NOT_ENROLLED');
    assert.equal((await send('submissions')).status, 403);
  });

  test('a Learning Service that fails is a 503 and nothing is saved: the Learner is never let through blind', async () => {
    const before = Number(
      (await db.query('SELECT count(*) AS n FROM submissions'))[0].n,
    );
    learning.setAnswer(LEARNER, COURSE, '500');
    const r = await view();
    assert.equal(r.status, 503);
    assert.equal(r.code, 'LEARNING_SERVICE_UNAVAILABLE');
    assert.equal((await send('resubmissions')).status, 503);
    assert.equal(
      Number((await db.query('SELECT count(*) AS n FROM submissions'))[0].n),
      before,
    );
    learning.setAnswer(LEARNER, COURSE, 'Full');
    assert.equal((await send('resubmissions')).status, 201, 'it works again at once');
  });
});
