/**
 * UC29 through the real HTTP API and a real Postgres: the list of Quizzes and Assignments of an enrolled Course with
 * status, recorded score and tries left, for one Learner at a time.
 * Enrollment is answered by a fake Learning Service (assessment-access, ENROLLMENT_CLIENT_MODE=http). The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  LEARNER,
  ORG,
  startCourseStub,
  startLearningStub,
  startService,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const LEARNER_2 = '00000000-0000-4000-8000-0000000000c2';
const as = (user: string) => identity({ user, role: 'LEARNER' });

describe('UC29 over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: LearningStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let quizId: string;
  let assignmentId: string;

  const list = (user = LEARNER, courseId = COURSE) =>
    api('GET', `/learner/courses/${courseId}/assessments`, undefined, as(user));
  const item = async (id: string, user = LEARNER) =>
    (await list(user)).data.items.find((i: { id: string }) => i.id === id);

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    learning = await startLearningStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'http',
      LEARNING_SERVICE_URL: learning.url,
    });
    api = apiFor(service.baseUrl);

    const quiz = await api('POST', '/quizzes', {
      courseId: COURSE,
      title: 'Safety quiz',
      timeLimitMinutes: 15,
      passingScore: 70,
      isRequired: true,
    });
    assert.equal(quiz.status, 201, JSON.stringify(quiz.json));
    quizId = quiz.data.id;
    const asg = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Safety assignment',
      prompt: 'Write it',
      passingScore: 60,
      expectedDurationMinutes: 45,
      rubric: [{ name: 'A', description: 'A desc', maxPoints: 100 }],
    });
    assert.equal(asg.status, 201, JSON.stringify(asg.json));
    assignmentId = asg.data.id;
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await learning?.stop();
    await db?.drop();
  });

  test('is for Learners only (403) and needs a UUID (400)', async () => {
    assert.equal(
      (await api('GET', `/learner/courses/${COURSE}/assessments`)).status,
      403,
    );
    assert.equal((await list(LEARNER, 'abc')).status, 400);
  });

  test('a Course without Assessments gives an empty list', async () => {
    const r = await list(LEARNER, '00000000-0000-4000-8000-0000000000dd');
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.items, []);
  });

  test('lists the Quiz and the Assignment, nothing started, all tries left', async () => {
    const r = await list();
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.readOnly, false);
    assert.deepEqual(
      r.data.items.map((i: { title: string }) => i.title),
      ['Safety quiz', 'Safety assignment'],
    );
    const [quiz, asg] = r.data.items;
    assert.equal(quiz.kind, 'QUIZ');
    assert.equal(quiz.status, 'NotStarted');
    assert.equal(quiz.isRequired, true);
    assert.equal(quiz.passingScore, 70);
    assert.equal(quiz.timeLimitMinutes, 15);
    assert.equal(quiz.attempts.remainingAttempts, 3);
    assert.equal(asg.kind, 'ASSIGNMENT');
    assert.equal(asg.status, 'NotStarted');
    assert.equal(asg.isRequired, true); // BR-165
    assert.equal(asg.passed, null); // BR-153
    assert.equal(asg.expectedDurationMinutes, 45);
  });

  test('a submission makes the Assignment AwaitingResult and counts one try (UC30)', async () => {
    const form = new FormData();
    form.append('content', 'my answer');
    const res = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/submissions`,
      { method: 'POST', headers: as(LEARNER), body: form },
    );
    assert.equal(res.status, 201);
    const asg = await item(assignmentId);
    assert.equal(asg.status, 'AwaitingResult');
    assert.equal(asg.attempts.remainingAttempts, 2);
    assert.ok(asg.submittedAt);
    assert.equal(asg.recordedScore, null);
    // another Learner sees nothing of it
    assert.equal((await item(assignmentId, LEARNER_2)).status, 'NotStarted');
  });

  test('a finalized grade becomes the recorded score of the Assignment (BR-170)', async () => {
    await db.query(
      "UPDATE submissions SET grading_status = 'Finalized', final_score = 90 WHERE assessment_id = $1",
      [assignmentId],
    );
    const asg = await item(assignmentId);
    assert.equal(asg.status, 'Completed');
    assert.equal(asg.recordedScore, 90);
    assert.equal(asg.passed, true);
    await db.query(
      'UPDATE submissions SET final_score = 40 WHERE assessment_id = $1',
      [assignmentId],
    );
    const low = await item(assignmentId);
    assert.equal(low.recordedScore, 40);
    assert.equal(low.passed, false);
  });

  test('a Quiz is InProgress while an attempt runs, then records the best attempt (BR-159)', async () => {
    const attempt = (n: number, submitted: boolean, score: number | null) =>
      db.query(
        `INSERT INTO quiz_attempts (id, organization_id, assessment_id, learner_id, attempt_number, started_at, deadline_at, submitted_at, score, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now() + interval '15 minutes', ${submitted ? 'now()' : 'NULL'}, $5, now())`,
        [ORG, quizId, LEARNER, n, score],
      );
    await attempt(1, true, 55);
    await attempt(2, true, 80);
    await attempt(3, false, null);
    assert.equal((await item(quizId)).status, 'InProgress');

    await db.query(
      'UPDATE quiz_attempts SET submitted_at = now(), score = 60 WHERE assessment_id = $1 AND submitted_at IS NULL',
      [quizId],
    );
    const quiz = await item(quizId);
    assert.equal(quiz.status, 'Completed');
    assert.equal(quiz.recordedScore, 80); // the best, not the latest
    assert.equal(quiz.passed, true);
    assert.equal((await item(quizId, LEARNER_2)).status, 'NotStarted');
  });

  test('a locked Assessment shows 0 tries left and when it opens again (BR-179)', async () => {
    const until = new Date(Date.now() + 5 * 3_600_000);
    await db.query(
      'UPDATE learner_assessment_states SET consecutive_count = 3, locked_until = $2 WHERE assessment_id = $1 AND learner_id = $3',
      [assignmentId, until, LEARNER],
    );
    const asg = await item(assignmentId);
    assert.equal(asg.attempts.remainingAttempts, 0);
    assert.equal(new Date(asg.attempts.lockedUntil).getTime(), until.getTime());

    await db.query(
      "UPDATE learner_assessment_states SET locked_until = now() - interval '1 hour' WHERE assessment_id = $1",
      [assignmentId],
    );
    const open = await item(assignmentId);
    assert.equal(open.attempts.remainingAttempts, 3); // the lock ran out: counting starts again
    assert.equal(open.attempts.lockedUntil, null);
  });

  test('a Disabled Assessment is not listed, a Completed Enrollment is read-only (BR-210)', async () => {
    await db.query('UPDATE assessments SET disabled_at = now() WHERE id = $1', [
      quizId,
    ]);
    assert.equal(await item(quizId), undefined);
    assert.equal((await list()).data.items.length, 1);

    // Learning Service now says the Enrollment of this Learner is Completed
    learning.setAnswer(LEARNER, COURSE, 'ReadOnly');
    assert.equal((await list()).data.readOnly, true);
    assert.equal((await list(LEARNER_2)).data.readOnly, false);
  });
});
