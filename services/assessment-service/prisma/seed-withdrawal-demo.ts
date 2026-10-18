/**
 * Dữ liệu demo UC25.4 (Learner rút khỏi Course tự chọn) phía assessment-service. CHỈ DÙNG CHO DEV.
 *
 * Chạy: npm run db:seed:withdrawal-demo
 * Chạy lại an toàn: mọi bản ghi ghi bằng upsert theo ID cố định, không xóa / truncate gì.
 *
 * learning-service hỏi GET /api/v1/internal/learners/:learnerId/courses/:courseId/assessment-activity (BR-131)
 * để biết rút Course thì xóa hẳn Enrollment hay chuyển Withdrawn. Hai Course của demo (learning-service,
 * prisma/withdrawal-demo-fixture.ts), Học viên 4:
 *   - Course X: assessment KHÔNG có dữ liệu của Học viên 4  -> cả ba cờ false -> learning xóa hẳn Enrollment.
 *   - Course Y: một Quiz không bắt buộc và MỘT LƯỢT LÀM đã nộp  -> hasQuizAttempt true -> learning giữ Withdrawn.
 * Course X phải không có dữ liệu nào của Học viên 4, nên script dừng nếu thấy có (nếu không thì demo xóa không còn đúng).
 *
 * Chạy bản thật: bật assessment-service, chạy seed này, và để learning-service ở ASSESSMENT_CLIENT_MODE=http
 * (docker-compose đã đặt sẵn cùng ASSESSMENT_SERVICE_URL). Tắt assessment-service để thử trường hợp 503.
 *
 * Quy ước ID của riêng file này: 25a = Quiz, 25b = câu hỏi, 25c = đáp án, 25d = lượt làm, 25e = đáp án đã chọn,
 * 25f = learner_assessment_states.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// Cùng ID với learning-service/prisma/withdrawal-demo-fixture.ts
// ---------------------------------------------------------------------------
export const DEMO_ORG = '01900000-0000-7000-8000-00000000a001';
export const DEMO_LEARNER = '01900000-0000-7000-8000-00000000a206'; // Học viên 4
export const COURSE_X = '01900000-0000-7000-8000-c0020000005c'; // bị xóa hẳn khi rút
export const COURSE_Y = '01900000-0000-7000-8000-c00200000097'; // chuyển Withdrawn khi rút

const QUIZ_KIND = 'QUIZ';
const id = (kind: string, n: number) =>
  `01900000-0000-7000-8000-0000025${kind}${String(n).padStart(4, '0')}`;

const QUIZ_ID = id('a', 1);
const ATTEMPT_ID = id('d', 1);
const STATE_ID = id('f', 1);

const QUESTIONS = [
  {
    type: 'SingleChoice',
    content: 'Who is responsible for workplace safety?',
    options: [
      { content: 'Only the safety officer', isCorrect: false },
      { content: 'Everyone at the workplace', isCorrect: true },
      { content: 'Only managers', isCorrect: false },
    ],
  },
  {
    type: 'TrueFalse',
    content: 'Personal protective equipment is the first line of defence.',
    options: [
      { content: 'True', isCorrect: false },
      { content: 'False', isCorrect: true },
    ],
  },
] as const;

/** Lượt làm đã nộp, trả lời đúng cả hai câu (vị trí 0-based của đáp án đã chọn). */
const CHOICES = [[1], [1]];
const STARTED_AT = new Date('2026-10-01T03:00:00Z');
const MINUTES_USED = 6;
const TIME_LIMIT_MINUTES = 10;

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Dừng trước khi ghi nếu dữ liệu hiện có làm demo sai, hoặc nếu ID cố định đã bị dòng khác chiếm. */
async function validate(prisma: PrismaClient): Promise<string[]> {
  const errors: string[] = [];

  const [attempts, submissions, reviews] = await Promise.all([
    prisma.quizAttempt.count({
      where: {
        learnerId: DEMO_LEARNER,
        assessment: { courseId: COURSE_X },
      },
    }),
    prisma.submission.count({
      where: {
        learnerId: DEMO_LEARNER,
        assessment: { courseId: COURSE_X },
      },
    }),
    prisma.submissionReview.count({
      where: {
        reviewerId: DEMO_LEARNER,
        status: 'Completed',
        submission: { assessment: { courseId: COURSE_X } },
      },
    }),
  ]);
  if (attempts + submissions + reviews > 0) {
    errors.push(
      `Học viên 4 đã có dữ liệu đánh giá ở Course X (${attempts} lượt Quiz, ${submissions} bài nộp, ${reviews} lượt chấm): demo "xóa hẳn" sẽ sai.`,
    );
  }

  const quiz = await prisma.assessment.findUnique({ where: { id: QUIZ_ID } });
  if (
    quiz &&
    (quiz.organizationId !== DEMO_ORG ||
      quiz.courseId !== COURSE_Y ||
      quiz.kind !== QUIZ_KIND)
  ) {
    errors.push(`ID Quiz demo ${QUIZ_ID} đã thuộc dòng khác; không ghi đè.`);
  }
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: ATTEMPT_ID },
  });
  if (
    attempt &&
    (attempt.assessmentId !== QUIZ_ID || attempt.learnerId !== DEMO_LEARNER)
  ) {
    errors.push(`ID lượt làm demo ${ATTEMPT_ID} đã thuộc dòng khác.`);
  }
  return errors;
}

export async function seedWithdrawalDemo(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV=production.');
  }
  const errors = await validate(prisma);
  if (errors.length > 0) {
    throw new Error(
      `Seed demo UC25.4 bị dừng, chưa ghi dòng nào:\n  - ${errors.join('\n  - ')}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const quizData = {
      organizationId: DEMO_ORG,
      courseId: COURSE_Y,
      moduleId: null, // gắn vào Course (BR-154)
      kind: QUIZ_KIND,
      title: 'Workplace safety quick check (demo UC25.4)',
      position: 1,
      passingScore: 70,
      maxConsecutiveAttempts: 3,
      lockoutHours: 24,
      isRequired: false, // Course tự chọn, Quiz không bắt buộc
      timeLimitMinutes: TIME_LIMIT_MINUTES,
    };
    await tx.assessment.upsert({
      where: { id: QUIZ_ID },
      update: quizData,
      create: { id: QUIZ_ID, ...quizData },
    });

    for (const [qi, question] of QUESTIONS.entries()) {
      const questionId = id('b', qi + 1);
      const questionData = {
        organizationId: DEMO_ORG,
        assessmentId: QUIZ_ID,
        questionType: question.type,
        content: question.content,
        position: qi + 1,
      };
      await tx.quizQuestion.upsert({
        where: { id: questionId },
        update: questionData,
        create: { id: questionId, ...questionData },
      });
      for (const [oi, option] of question.options.entries()) {
        const optionId = id('c', (qi + 1) * 10 + oi + 1);
        const optionData = {
          organizationId: DEMO_ORG,
          questionId,
          content: option.content,
          isCorrect: option.isCorrect,
          position: oi + 1,
        };
        await tx.quizQuestionOption.upsert({
          where: { id: optionId },
          update: optionData,
          create: { id: optionId, ...optionData },
        });
      }
    }

    // Lượt làm đã nộp: điểm = số câu đúng / tổng số câu x 100 (BR-315)
    const attemptData = {
      organizationId: DEMO_ORG,
      assessmentId: QUIZ_ID,
      learnerId: DEMO_LEARNER,
      attemptNumber: 1,
      startedAt: STARTED_AT,
      deadlineAt: addMinutes(STARTED_AT, TIME_LIMIT_MINUTES),
      submittedAt: addMinutes(STARTED_AT, MINUTES_USED),
      submissionKind: 'Manual',
      score: 100,
    };
    await tx.quizAttempt.upsert({
      where: { id: ATTEMPT_ID },
      update: attemptData,
      create: { id: ATTEMPT_ID, ...attemptData },
    });
    for (const [qi, chosen] of CHOICES.entries()) {
      for (const oi of chosen) {
        const answerId = id('e', (qi + 1) * 10 + oi + 1);
        const answerData = {
          organizationId: DEMO_ORG,
          attemptId: ATTEMPT_ID,
          questionId: id('b', qi + 1),
          optionId: id('c', (qi + 1) * 10 + oi + 1),
        };
        await tx.quizAttemptAnswer.upsert({
          where: { id: answerId },
          update: answerData,
          create: { id: answerId, ...answerData },
        });
      }
    }

    const stateData = {
      organizationId: DEMO_ORG,
      firstActivityAt: STARTED_AT,
      consecutiveCount: 1,
      lockedUntil: null,
      recordedAttemptId: ATTEMPT_ID,
    };
    await tx.learnerAssessmentState.upsert({
      where: {
        assessmentId_learnerId: {
          assessmentId: QUIZ_ID,
          learnerId: DEMO_LEARNER,
        },
      },
      update: stateData,
      create: {
        id: STATE_ID,
        assessmentId: QUIZ_ID,
        learnerId: DEMO_LEARNER,
        ...stateData,
      },
    });
  });
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await seedWithdrawalDemo(prisma);
    console.log(
      'assessment-service: demo UC25.4 seed completed.\n' +
        `  Course X ${COURSE_X}: no assessment data of the Learner -> learning deletes the Enrollment.\n` +
        `  Course Y ${COURSE_Y}: one submitted Quiz attempt of the Learner -> learning keeps it as Withdrawn.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy khi gọi trực tiếp (npm run db:seed:withdrawal-demo); khi test import thì chỉ lấy hàm seedWithdrawalDemo.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
