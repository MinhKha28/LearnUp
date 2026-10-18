/**
 * The seed of the UC25.4 demo (learning-service rút Course, BR-131) against a real Postgres and the real endpoint
 * assessment-activity: Course Y has one Quiz attempt of Học viên 4 (so hasQuizAttempt is true and learning keeps the
 * Enrollment as Withdrawn), Course X has nothing (all three flags false, learning deletes it). The tests are one
 * story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import {
  COURSE_X,
  COURSE_Y,
  DEMO_LEARNER,
  DEMO_ORG,
  seedWithdrawalDemo,
} from '../../prisma/seed-withdrawal-demo';
import {
  apiFor,
  createTestDatabase,
  identity,
  startService,
  type RunningService,
  type TestDatabase,
} from './harness';

describe('UC25.4 demo seed', () => {
  let db: TestDatabase;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let prisma: PrismaClient;

  const activity = (courseId: string) =>
    api(
      'GET',
      `/../internal/learners/${DEMO_LEARNER}/courses/${courseId}/assessment-activity`,
      undefined,
      identity({ user: DEMO_LEARNER, org: DEMO_ORG, role: 'LEARNER' }),
    );
  const counts = async () => ({
    quizzes: await prisma.assessment.count({ where: { courseId: COURSE_Y } }),
    questions: await prisma.quizQuestion.count(),
    attempts: await prisma.quizAttempt.count(),
    answers: await prisma.quizAttemptAnswer.count(),
    states: await prisma.learnerAssessmentState.count(),
  });

  before(async () => {
    db = await createTestDatabase();
    service = await startService(db.url, {
      COURSE_CLIENT_MODE: 'fake',
      ENROLLMENT_CLIENT_MODE: 'fake',
    });
    api = apiFor(service.baseUrl);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: db.url }),
    });
  });
  after(async () => {
    await prisma?.$disconnect();
    await service?.stop();
    await db?.drop();
  });

  test('before the seed neither Course has anything', async () => {
    for (const course of [COURSE_X, COURSE_Y]) {
      assert.deepEqual((await activity(course)).data, {
        hasQuizAttempt: false,
        hasSubmission: false,
        hasPeerReviewGiven: false,
      });
    }
  });

  test('after the seed Course Y has a Quiz attempt and Course X is still empty', async () => {
    await seedWithdrawalDemo(prisma);
    assert.deepEqual((await activity(COURSE_Y)).data, {
      hasQuizAttempt: true,
      hasSubmission: false,
      hasPeerReviewGiven: false,
    });
    assert.deepEqual((await activity(COURSE_X)).data, {
      hasQuizAttempt: false,
      hasSubmission: false,
      hasPeerReviewGiven: false,
    });
  });

  test('the Quiz is optional and the attempt is submitted with a full score', async () => {
    const quiz = await prisma.assessment.findFirstOrThrow({
      where: { courseId: COURSE_Y },
    });
    assert.equal(quiz.kind, 'QUIZ');
    assert.equal(quiz.isRequired, false);
    const attempt = await prisma.quizAttempt.findFirstOrThrow({
      where: { assessmentId: quiz.id },
    });
    assert.equal(attempt.learnerId, DEMO_LEARNER);
    assert.notEqual(attempt.submittedAt, null);
    assert.equal(Number(attempt.score), 100);
  });

  test('running it again changes nothing', async () => {
    const before = await counts();
    await seedWithdrawalDemo(prisma);
    await seedWithdrawalDemo(prisma);
    assert.deepEqual(await counts(), before);
    assert.deepEqual(before, {
      quizzes: 1,
      questions: 2,
      attempts: 1,
      answers: 2,
      states: 1,
    });
  });

  test('another Learner never sees the attempt', async () => {
    const other = await api(
      'GET',
      `/../internal/learners/01900000-0000-7000-8000-00000000a201/courses/${COURSE_Y}/assessment-activity`,
      undefined,
      identity({
        user: '01900000-0000-7000-8000-00000000a201',
        org: DEMO_ORG,
        role: 'LEARNER',
      }),
    );
    assert.equal(other.data.hasQuizAttempt, false);
  });

  test('it stops, writing nothing, when the Learner already has data in Course X', async () => {
    const quizX = await prisma.assessment.create({
      data: {
        organizationId: DEMO_ORG,
        courseId: COURSE_X,
        kind: 'QUIZ',
        title: 'Quiz in Course X',
        position: 1,
        passingScore: 70,
        maxConsecutiveAttempts: 3,
        lockoutHours: 24,
        isRequired: false,
        timeLimitMinutes: 10,
      },
    });
    await prisma.quizAttempt.create({
      data: {
        organizationId: DEMO_ORG,
        assessmentId: quizX.id,
        learnerId: DEMO_LEARNER,
        attemptNumber: 1,
        startedAt: new Date(),
        deadlineAt: new Date(Date.now() + 600_000),
      },
    });
    const before = await counts();
    await assert.rejects(
      () => seedWithdrawalDemo(prisma),
      /Course X/,
    );
    assert.deepEqual(await counts(), before);
  });
});
