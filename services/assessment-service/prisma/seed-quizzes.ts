/**
 * Dữ liệu demo Quiz cho UC18 (Xem danh sách Quiz). CHỈ DÙNG CHO DEV.
 *
 * Chạy: npm run db:seed:quizzes
 * Chạy lại an toàn: mọi bản ghi ghi bằng upsert theo ID cố định, không xóa / truncate gì.
 * Trước khi ghi, validate() kiểm các luật dữ liệu của thiết kế (docs_temp/LearnUP_Database_Guide.md phần 4)
 * vì database chưa có CHECK; sai một luật là dừng, không ghi dòng nào.
 *
 * Dùng ID tổ chức / Course / Module của prisma/seed.ts bên course-service (chạy seed đó trước):
 *   - Bộ UI (danh tính frontend đang gắn cứng: org 2222…, Instructor 3333…)
 *   - Bộ 0199a000-… (org A, Instructor …0c0000000001) và một Quiz của org B để thử không xem chéo.
 *
 * Quy ước ID của riêng file này: 3a = Quiz, 3b = câu hỏi, 3c = đáp án, 3d = lượt làm,
 * 3e = learner_assessment_states, 3f = đáp án đã chọn của lượt làm (quiz_attempt_answers).
 *
 * Giá trị question_type / submission_kind: chưa có code nào dùng nên theo tài liệu
 * (SingleChoice, MultipleChoice, TrueFalse; Manual, TimedOut).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { QUIZ_KIND } from '../src/quiz/interfaces/quiz-list.interface';

// ---------------------------------------------------------------------------
// ID cố định lấy từ prisma/seed.ts của course-service
// ---------------------------------------------------------------------------
const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const ORG_B = '0199a000-0000-7000-8000-0a0000000002';
const ORG_UI = '22222222-2222-7222-8222-222222222222';

const LEARNER_1 = '0199a000-0000-7000-8000-0b0000000001'; // org A
// Course seed không có Learner nào cho org UI: ID logic đặt riêng cho demo, tenant không có user này.
const LEARNER_UI = '33333333-eeee-7333-8333-000000000001';

type CourseStatus = 'Draft' | 'Published';

interface SeedCourse {
  id: string;
  organizationId: string;
  status: CourseStatus;
  moduleIds: string[];
}

const COURSE_UI_DRAFT: SeedCourse = {
  id: '33333333-bbbb-7333-8333-000000000001', // Workplace Safety Essentials (dev), DRAFT
  organizationId: ORG_UI,
  status: 'Draft',
  moduleIds: [
    '33333333-cccc-7333-8333-000000000001', // Safety basics
    '33333333-cccc-7333-8333-000000000002', // Emergency procedures
  ],
};
const COURSE_UI_PUBLISHED: SeedCourse = {
  id: '33333333-bbbb-7333-8333-000000000002', // Data Security Basics (dev), PUBLISHED
  organizationId: ORG_UI,
  status: 'Published',
  moduleIds: ['33333333-cccc-7333-8333-000000000003'], // Security fundamentals
};
const COURSE_AN_TOAN_V2: SeedCourse = {
  id: '0199a000-0000-7000-8000-0e0000000002', // An toàn lao động v2, Published
  organizationId: ORG_A,
  status: 'Published',
  moduleIds: [
    '0199a000-0000-7000-8000-1a0000000011', // Nhận diện mối nguy
    '0199a000-0000-7000-8000-1a0000000012',
  ],
};
const COURSE_NHAP_MON: SeedCourse = {
  id: '0199a000-0000-7000-8000-0e0000000006', // Nhập môn sản phẩm, Published, org B
  organizationId: ORG_B,
  status: 'Published',
  moduleIds: [
    '0199a000-0000-7000-8000-1a0000000041', // Giới thiệu sản phẩm
    '0199a000-0000-7000-8000-1a0000000042', // Sử dụng sản phẩm
  ],
};

// ---------------------------------------------------------------------------
// Dữ liệu
// ---------------------------------------------------------------------------
type QuestionType = 'SingleChoice' | 'MultipleChoice' | 'TrueFalse';
type SubmissionKind = 'Manual' | 'TimedOut';

interface SeedOption {
  content: string;
  isCorrect: boolean;
}

interface SeedQuestion {
  type: QuestionType;
  content: string;
  options: SeedOption[];
}

interface SeedAttempt {
  learnerId: string;
  startedAt: Date;
  /** Phút sau startedAt; TimedOut thì luôn bằng thời gian giới hạn. */
  submittedAfterMinutes: number;
  submissionKind: SubmissionKind;
  /** Với mỗi câu hỏi (theo thứ tự), vị trí (0-based) các đáp án đã chọn. */
  choices: number[][];
}

interface SeedQuiz {
  /** Hai số cuối của ID 3a… */
  no: number;
  course: SeedCourse;
  /** null = gắn vào Course (BR-154) */
  moduleId: string | null;
  title: string;
  position: number;
  passingScore: number;
  isRequired: boolean;
  timeLimitMinutes: number;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  questions: SeedQuestion[];
  attempts: SeedAttempt[];
}

const TRUE_FALSE = (correct: boolean): SeedOption[] => [
  { content: 'True', isCorrect: correct },
  { content: 'False', isCorrect: !correct },
];

const QUIZZES: SeedQuiz[] = [
  // ----- Bộ UI, Course Draft: hai Quiz cùng Module (position 1, 2), một Quiz Module khác, một Quiz 0 câu hỏi
  {
    no: 1,
    course: COURSE_UI_DRAFT,
    moduleId: COURSE_UI_DRAFT.moduleIds[0],
    title: 'Safety basics check',
    position: 1,
    passingScore: 70,
    isRequired: true,
    timeLimitMinutes: 15,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [
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
        type: 'MultipleChoice',
        content: 'Which of these are physical hazards?',
        options: [
          { content: 'Noise', isCorrect: true },
          { content: 'Solvents', isCorrect: false },
          { content: 'Electricity', isCorrect: true },
          { content: 'Dust', isCorrect: false },
        ],
      },
      {
        type: 'TrueFalse',
        content: 'Personal protective equipment is the first line of defence.',
        options: TRUE_FALSE(false),
      },
    ],
    attempts: [],
  },
  {
    no: 2,
    course: COURSE_UI_DRAFT,
    moduleId: COURSE_UI_DRAFT.moduleIds[0],
    title: 'Hazard spotting practice',
    position: 2,
    passingScore: 50,
    isRequired: false,
    timeLimitMinutes: 10,
    maxConsecutiveAttempts: 5,
    lockoutHours: 12,
    questions: [
      {
        type: 'SingleChoice',
        content: 'A wet floor without a sign is an example of…',
        options: [
          { content: 'A slip hazard', isCorrect: true },
          { content: 'A chemical hazard', isCorrect: false },
        ],
      },
      {
        type: 'TrueFalse',
        content: 'You should report a hazard even if nobody was hurt.',
        options: TRUE_FALSE(true),
      },
    ],
    attempts: [],
  },
  {
    no: 3,
    course: COURSE_UI_DRAFT,
    moduleId: COURSE_UI_DRAFT.moduleIds[1],
    title: 'Emergency procedures quiz',
    position: 1,
    passingScore: 80,
    isRequired: true,
    timeLimitMinutes: 20,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [
      {
        type: 'SingleChoice',
        content: 'What is the first thing to do when the fire alarm sounds?',
        options: [
          { content: 'Finish the current task', isCorrect: false },
          { content: 'Leave by the nearest safe exit', isCorrect: true },
          { content: 'Use the lift', isCorrect: false },
          { content: 'Call a colleague', isCorrect: false },
        ],
      },
      {
        type: 'TrueFalse',
        content: 'The assembly point is shown on the evacuation plan.',
        options: TRUE_FALSE(true),
      },
    ],
    attempts: [],
  },
  {
    // BR-323: Quiz rỗng chỉ có ở Course Draft (Course chưa gửi duyệt được tới khi Quiz có câu hỏi).
    no: 4,
    course: COURSE_UI_DRAFT,
    moduleId: null,
    title: 'Final safety quiz',
    position: 101,
    passingScore: 75,
    isRequired: true,
    timeLimitMinutes: 30,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [],
    attempts: [],
  },
  // ----- Bộ UI, Course Published: một Quiz đã có lượt làm (khóa BR-96 / BR-97), một Quiz gắn Course không bắt buộc
  {
    no: 5,
    course: COURSE_UI_PUBLISHED,
    moduleId: COURSE_UI_PUBLISHED.moduleIds[0],
    title: 'Security fundamentals quiz',
    position: 1,
    passingScore: 60,
    isRequired: true,
    timeLimitMinutes: 15,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [
      {
        type: 'SingleChoice',
        content: 'Which password is the strongest?',
        options: [
          { content: 'password123', isCorrect: false },
          { content: 'Summer2026', isCorrect: false },
          {
            content: 'a long passphrase of four random words',
            isCorrect: true,
          },
        ],
      },
      {
        type: 'MultipleChoice',
        content: 'Which are signs of a phishing email?',
        options: [
          { content: 'Urgent request to act now', isCorrect: true },
          {
            content: 'Sender address that does not match the company',
            isCorrect: true,
          },
          {
            content: 'Email from your own IT ticket you opened',
            isCorrect: false,
          },
        ],
      },
      {
        type: 'TrueFalse',
        content:
          'Two-factor authentication protects an account even if the password leaks.',
        options: TRUE_FALSE(true),
      },
    ],
    attempts: [
      {
        // 1/3 câu đúng -> 33.33
        learnerId: LEARNER_UI,
        startedAt: new Date('2026-09-26T02:00:00Z'),
        submittedAfterMinutes: 9,
        submissionKind: 'Manual',
        choices: [[2], [0], [1]],
      },
      {
        // Hết giờ, 2/3 câu đúng -> 66.67
        learnerId: LEARNER_UI,
        startedAt: new Date('2026-09-26T03:00:00Z'),
        submittedAfterMinutes: 15,
        submissionKind: 'TimedOut',
        choices: [[2], [0, 1], [1]],
      },
    ],
  },
  {
    no: 6,
    course: COURSE_UI_PUBLISHED,
    moduleId: null,
    title: 'Practice: spot the phishing email',
    position: 101,
    passingScore: 50,
    isRequired: false,
    timeLimitMinutes: 10,
    maxConsecutiveAttempts: 5,
    lockoutHours: 12,
    questions: [
      {
        type: 'TrueFalse',
        content: 'A link text can show one address and open another.',
        options: TRUE_FALSE(true),
      },
      {
        type: 'SingleChoice',
        content: 'You receive a suspicious email. What should you do?',
        options: [
          { content: 'Reply and ask if it is real', isCorrect: false },
          {
            content: 'Report it to IT without clicking anything',
            isCorrect: true,
          },
        ],
      },
    ],
    attempts: [],
  },
  // ----- Bộ 0199a, org A, Course Published (đã có Assignment ở position 1 của Course)
  {
    no: 7,
    course: COURSE_AN_TOAN_V2,
    moduleId: COURSE_AN_TOAN_V2.moduleIds[0],
    title: 'Kiểm tra: Nhận diện mối nguy',
    position: 1,
    passingScore: 70,
    isRequired: true,
    timeLimitMinutes: 15,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [
      {
        type: 'SingleChoice',
        content: 'Tiếng ồn thuộc loại mối nguy nào?',
        options: [
          { content: 'Vật lý', isCorrect: true },
          { content: 'Hóa học', isCorrect: false },
          { content: 'Cơ học', isCorrect: false },
        ],
      },
      {
        type: 'TrueFalse',
        content: 'Đánh giá rủi ro bắt đầu bằng việc xác định mối nguy.',
        options: TRUE_FALSE(true),
      },
    ],
    attempts: [
      {
        // 2/2 câu đúng -> 100
        learnerId: LEARNER_1,
        startedAt: new Date('2026-09-27T02:00:00Z'),
        submittedAfterMinutes: 6,
        submissionKind: 'Manual',
        choices: [[0], [0]],
      },
    ],
  },
  {
    no: 8,
    course: COURSE_AN_TOAN_V2,
    moduleId: null,
    title: 'Ôn tập cuối khóa (không bắt buộc)',
    position: 101,
    passingScore: 50,
    isRequired: false,
    timeLimitMinutes: 20,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [
      {
        type: 'MultipleChoice',
        content: 'Những biện pháp nào giúp kiểm soát rủi ro?',
        options: [
          { content: 'Loại bỏ mối nguy', isCorrect: true },
          { content: 'Bỏ qua cảnh báo', isCorrect: false },
          { content: 'Dùng thiết bị bảo hộ', isCorrect: true },
        ],
      },
      {
        type: 'TrueFalse',
        content: 'Chỉ cần báo cáo sự cố khi có người bị thương.',
        options: TRUE_FALSE(false),
      },
    ],
    attempts: [],
  },
  // ----- Org B: để thử Instructor org A / UI không xem được
  {
    no: 9,
    course: COURSE_NHAP_MON,
    moduleId: COURSE_NHAP_MON.moduleIds[0],
    title: 'Kiểm tra: Giới thiệu sản phẩm',
    position: 1,
    passingScore: 60,
    isRequired: true,
    timeLimitMinutes: 10,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    questions: [
      {
        type: 'SingleChoice',
        content: 'Sản phẩm hướng tới nhóm khách hàng nào?',
        options: [
          { content: 'Doanh nghiệp vừa và nhỏ', isCorrect: true },
          { content: 'Không xác định', isCorrect: false },
        ],
      },
    ],
    attempts: [],
  },
];

// ---------------------------------------------------------------------------
// Dựng các dòng sẽ ghi
// ---------------------------------------------------------------------------
const pad = (n: number, width: number) => String(n).padStart(width, '0');
const seedId = (group: string, suffix: string) =>
  `0199a000-0000-7000-8000-${group}${suffix.padStart(10, '0')}`;

const quizId = (q: SeedQuiz) => seedId('3a', pad(q.no, 2));
const questionId = (q: SeedQuiz, qi: number) =>
  seedId('3b', `${pad(q.no, 2)}${pad(qi + 1, 2)}`);
const optionId = (q: SeedQuiz, qi: number, oi: number) =>
  seedId('3c', `${pad(q.no, 2)}${pad(qi + 1, 2)}${pad(oi + 1, 2)}`);
const attemptId = (q: SeedQuiz, ai: number) =>
  seedId('3d', `${pad(q.no, 2)}${pad(ai + 1, 2)}`);
const stateId = (q: SeedQuiz, li: number) =>
  seedId('3e', `${pad(q.no, 2)}${pad(li + 1, 2)}`);
const answerId = (q: SeedQuiz, ai: number, qi: number, oi: number) =>
  seedId(
    '3f',
    `${pad(q.no, 2)}${pad(ai + 1, 2)}${pad(qi + 1, 2)}${pad(oi + 1, 2)}`,
  );

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);
const addHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 3_600_000);

/** BR: một câu đúng khi tập đáp án đã chọn trùng khớp tập đáp án đúng; điểm = số câu đúng ÷ tổng câu × 100. */
function scoreOf(quiz: SeedQuiz, choices: number[][]): number {
  const correct = quiz.questions.filter((question, qi) => {
    const expected = question.options
      .map((o, oi) => (o.isCorrect ? oi : -1))
      .filter((oi) => oi >= 0);
    const chosen = [...new Set(choices[qi] ?? [])].sort((a, b) => a - b);
    return (
      chosen.length === expected.length &&
      chosen.every((oi, i) => oi === expected[i])
    );
  }).length;
  return Math.round((correct / quiz.questions.length) * 10000) / 100;
}

interface LearnerState {
  id: string;
  quiz: SeedQuiz;
  learnerId: string;
  firstActivityAt: Date;
  consecutiveCount: number;
  lockedUntil: Date | null;
  recordedAttemptId: string | null;
}

/** Một dòng learner_assessment_states cho mỗi cặp (Quiz, Learner) có lượt làm. */
function learnerStates(quiz: SeedQuiz): LearnerState[] {
  const learners = [...new Set(quiz.attempts.map((a) => a.learnerId))];
  return learners.map((learnerId, li) => {
    const own = quiz.attempts
      .map((attempt, ai) => ({ attempt, ai }))
      .filter(({ attempt }) => attempt.learnerId === learnerId);
    // BR-159: lượt điểm cao nhất; hòa thì lượt sớm hơn.
    let best = own[0];
    for (const item of own) {
      if (
        scoreOf(quiz, item.attempt.choices) >
        scoreOf(quiz, best.attempt.choices)
      ) {
        best = item;
      }
    }
    const last = own[own.length - 1].attempt;
    const consecutiveCount = own.length;
    return {
      id: stateId(quiz, li),
      quiz,
      learnerId,
      firstActivityAt: own[0].attempt.startedAt,
      consecutiveCount,
      // Hết n lượt thì khóa m giờ (BR-175, BR-176).
      lockedUntil:
        consecutiveCount >= quiz.maxConsecutiveAttempts
          ? addHours(last.startedAt, quiz.lockoutHours)
          : null,
      recordedAttemptId: attemptId(quiz, best.ai),
    };
  });
}

// ---------------------------------------------------------------------------
// Tự kiểm trước khi ghi (database chưa có CHECK)
// ---------------------------------------------------------------------------
async function validate(prisma: PrismaClient): Promise<string[]> {
  const errors: string[] = [];
  const fail = (quiz: SeedQuiz, message: string) =>
    errors.push(`Quiz ${quizId(quiz)} "${quiz.title}": ${message}`);

  const allIds = new Set<string>();
  const unique = (id: string) => {
    if (allIds.has(id)) errors.push(`ID trùng: ${id}`);
    allIds.add(id);
  };

  const places = new Map<string, number[]>();

  for (const quiz of QUIZZES) {
    unique(quizId(quiz));
    if (!quiz.title.trim() || quiz.title.length > 200) {
      fail(quiz, 'title phải có và tối đa 200 ký tự');
    }
    if (!(quiz.passingScore > 0 && quiz.passingScore <= 100)) {
      fail(quiz, 'passing_score phải lớn hơn 0 và tối đa 100 (BR-315)');
    }
    if (Math.round(quiz.passingScore * 100) !== quiz.passingScore * 100) {
      fail(quiz, 'passing_score tối đa 2 chữ số thập phân');
    }
    if (
      !Number.isInteger(quiz.timeLimitMinutes) ||
      quiz.timeLimitMinutes < 1 ||
      quiz.timeLimitMinutes > 1440
    ) {
      fail(quiz, 'time_limit_minutes phải từ 1 tới 1440');
    }
    if (quiz.maxConsecutiveAttempts < 1 || quiz.lockoutHours < 1) {
      fail(quiz, 'n và m phải lớn hơn 0 (BR-175)');
    }
    if (quiz.moduleId && !quiz.course.moduleIds.includes(quiz.moduleId)) {
      fail(
        quiz,
        `Module ${quiz.moduleId} không thuộc Course ${quiz.course.id}`,
      );
    }
    if (quiz.questions.length > 100) {
      fail(quiz, 'mỗi Quiz tối đa 100 câu hỏi');
    }
    if (quiz.questions.length === 0 && quiz.course.status !== 'Draft') {
      fail(quiz, 'Quiz không có câu hỏi chỉ được ở Course Draft (BR-323)');
    }

    const placeKey = `${quiz.course.id}|${quiz.moduleId ?? 'course'}`;
    const used = places.get(placeKey) ?? [];
    if (!Number.isInteger(quiz.position) || quiz.position < 1) {
      fail(quiz, 'position phải là số nguyên dương');
    }
    if (used.includes(quiz.position)) {
      fail(quiz, `position ${quiz.position} trùng trong cùng chỗ gắn (BR-291)`);
    }
    places.set(placeKey, [...used, quiz.position]);

    quiz.questions.forEach((question, qi) => {
      unique(questionId(quiz, qi));
      const label = `câu ${qi + 1}`;
      const correct = question.options.filter((o) => o.isCorrect).length;
      if (!question.content.trim() || question.content.length > 2000) {
        fail(quiz, `${label}: nội dung phải có và tối đa 2000 ký tự`);
      }
      if (question.options.length < 2 || question.options.length > 10) {
        fail(quiz, `${label}: mỗi câu 2–10 đáp án`);
      }
      if (question.type === 'SingleChoice' && correct !== 1) {
        fail(quiz, `${label}: SingleChoice phải có đúng một đáp án đúng`);
      }
      if (question.type === 'MultipleChoice' && correct < 1) {
        fail(quiz, `${label}: MultipleChoice phải có ít nhất một đáp án đúng`);
      }
      if (
        question.type === 'TrueFalse' &&
        (question.options.length !== 2 || correct !== 1)
      ) {
        fail(
          quiz,
          `${label}: TrueFalse phải có đúng hai đáp án, một đáp án đúng`,
        );
      }
      question.options.forEach((option, oi) => {
        unique(optionId(quiz, qi, oi));
        if (!option.content.trim() || option.content.length > 500) {
          fail(quiz, `${label}, đáp án ${oi + 1}: phải có và tối đa 500 ký tự`);
        }
      });
    });

    if (quiz.attempts.length > 0 && quiz.questions.length === 0) {
      fail(quiz, 'Quiz không có câu hỏi thì không thể có lượt làm');
    }
    const perLearner = new Map<string, number>();
    quiz.attempts.forEach((attempt, ai) => {
      unique(attemptId(quiz, ai));
      const label = `lượt ${ai + 1}`;
      const count = (perLearner.get(attempt.learnerId) ?? 0) + 1;
      perLearner.set(attempt.learnerId, count);
      if (count > quiz.maxConsecutiveAttempts) {
        fail(
          quiz,
          `${label}: vượt n = ${quiz.maxConsecutiveAttempts} lượt liên tiếp`,
        );
      }
      const limit = quiz.timeLimitMinutes;
      if (
        attempt.submissionKind === 'TimedOut' &&
        attempt.submittedAfterMinutes !== limit
      ) {
        fail(quiz, `${label}: TimedOut phải nộp đúng lúc hết giờ`);
      }
      if (
        attempt.submittedAfterMinutes <= 0 ||
        attempt.submittedAfterMinutes > limit
      ) {
        fail(
          quiz,
          `${label}: submitted_at phải nằm trong (started_at, deadline_at]`,
        );
      }
      if (attempt.choices.length !== quiz.questions.length) {
        fail(quiz, `${label}: phải có lựa chọn cho từng câu hỏi`);
      }
      attempt.choices.forEach((chosen, qi) => {
        chosen.forEach((oi) => {
          if (!quiz.questions[qi]?.options[oi]) {
            fail(
              quiz,
              `${label}: đáp án ${oi + 1} của câu ${qi + 1} không tồn tại`,
            );
          } else {
            unique(answerId(quiz, ai, qi, oi));
          }
        });
        if (new Set(chosen).size !== chosen.length) {
          fail(quiz, `${label}: câu ${qi + 1} chọn trùng đáp án`);
        }
      });
      const previous = quiz.attempts
        .slice(0, ai)
        .filter((a) => a.learnerId === attempt.learnerId)
        .pop();
      if (
        previous &&
        addMinutes(previous.startedAt, previous.submittedAfterMinutes) >
          attempt.startedAt
      ) {
        fail(
          quiz,
          `${label}: bắt đầu khi lượt trước chưa nộp (tối đa một lượt đang làm)`,
        );
      }
    });
    learnerStates(quiz).forEach((state) => unique(state.id));
  }

  // Không trùng position với Quiz / Assignment khác đã có trong DB ở cùng chỗ gắn (BR-291).
  const others = await prisma.assessment.findMany({
    where: {
      courseId: { in: [...new Set(QUIZZES.map((q) => q.course.id))] },
      id: { notIn: QUIZZES.map(quizId) },
    },
    select: { id: true, courseId: true, moduleId: true, position: true },
  });
  for (const other of others) {
    const placeKey = `${other.courseId}|${other.moduleId ?? 'course'}`;
    if (places.get(placeKey)?.includes(other.position)) {
      errors.push(
        `position ${other.position} ở ${placeKey} đã có Assessment khác (${other.id}) trong DB`,
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Ghi dữ liệu
// ---------------------------------------------------------------------------
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      for (const quiz of QUIZZES) {
        const id = quizId(quiz);
        const organizationId = quiz.course.organizationId;
        const data = {
          organizationId,
          courseId: quiz.course.id,
          moduleId: quiz.moduleId,
          kind: QUIZ_KIND,
          title: quiz.title,
          position: quiz.position,
          passingScore: quiz.passingScore,
          maxConsecutiveAttempts: quiz.maxConsecutiveAttempts,
          lockoutHours: quiz.lockoutHours,
          isRequired: quiz.isRequired,
          timeLimitMinutes: quiz.timeLimitMinutes,
          // Quiz không có đề bài, thời lượng Assignment và không bật chấm chéo.
          prompt: null,
          promptFileKey: null,
          promptFileName: null,
          promptFileMime: null,
          promptFileSizeBytes: null,
          expectedDurationMinutes: null,
          peerReviewEnabled: false,
          peerReviewersPerSubmission: null,
          peerReviewCycleDays: null,
          peerReviewDeadlineDays: null,
          peerReviewScoreGap: null,
          disabledAt: null,
        };
        await tx.assessment.upsert({
          where: { id },
          update: data,
          create: { id, ...data },
        });

        for (const [qi, question] of quiz.questions.entries()) {
          const qid = questionId(quiz, qi);
          const questionData = {
            organizationId,
            assessmentId: id,
            questionType: question.type,
            content: question.content,
            position: qi + 1,
          };
          await tx.quizQuestion.upsert({
            where: { id: qid },
            update: questionData,
            create: { id: qid, ...questionData },
          });

          for (const [oi, option] of question.options.entries()) {
            const oid = optionId(quiz, qi, oi);
            const optionData = {
              organizationId,
              questionId: qid,
              content: option.content,
              isCorrect: option.isCorrect,
              position: oi + 1,
            };
            await tx.quizQuestionOption.upsert({
              where: { id: oid },
              update: optionData,
              create: { id: oid, ...optionData },
            });
          }
        }

        const numbers = new Map<string, number>();
        for (const [ai, attempt] of quiz.attempts.entries()) {
          const aid = attemptId(quiz, ai);
          const attemptNumber = (numbers.get(attempt.learnerId) ?? 0) + 1;
          numbers.set(attempt.learnerId, attemptNumber);
          const attemptData = {
            organizationId,
            assessmentId: id,
            learnerId: attempt.learnerId,
            attemptNumber,
            startedAt: attempt.startedAt,
            deadlineAt: addMinutes(attempt.startedAt, quiz.timeLimitMinutes),
            submittedAt: addMinutes(
              attempt.startedAt,
              attempt.submittedAfterMinutes,
            ),
            submissionKind: attempt.submissionKind,
            score: scoreOf(quiz, attempt.choices),
          };
          await tx.quizAttempt.upsert({
            where: { id: aid },
            update: attemptData,
            create: { id: aid, ...attemptData },
          });

          for (const [qi, chosen] of attempt.choices.entries()) {
            for (const oi of chosen) {
              const answerData = {
                organizationId,
                attemptId: aid,
                questionId: questionId(quiz, qi),
                optionId: optionId(quiz, qi, oi),
              };
              const anid = answerId(quiz, ai, qi, oi);
              await tx.quizAttemptAnswer.upsert({
                where: { id: anid },
                update: answerData,
                create: { id: anid, ...answerData },
              });
            }
          }
        }

        for (const state of learnerStates(quiz)) {
          const stateData = {
            organizationId,
            firstActivityAt: state.firstActivityAt,
            consecutiveCount: state.consecutiveCount,
            lockedUntil: state.lockedUntil,
            recordedAttemptId: state.recordedAttemptId,
          };
          await tx.learnerAssessmentState.upsert({
            where: {
              assessmentId_learnerId: {
                assessmentId: id,
                learnerId: state.learnerId,
              },
            },
            update: stateData,
            create: {
              id: state.id,
              assessmentId: id,
              learnerId: state.learnerId,
              ...stateData,
            },
          });
        }
      }
    },
    { timeout: 60_000 },
  );
}

async function printSummary(prisma: PrismaClient): Promise<void> {
  const quizIds = QUIZZES.map(quizId);
  const [quizzes, questions, options, attempts, answers, states] =
    await Promise.all([
      prisma.assessment.count({
        where: { id: { in: quizIds }, kind: QUIZ_KIND },
      }),
      prisma.quizQuestion.count({ where: { assessmentId: { in: quizIds } } }),
      prisma.quizQuestionOption.count({
        where: { question: { assessmentId: { in: quizIds } } },
      }),
      prisma.quizAttempt.count({ where: { assessmentId: { in: quizIds } } }),
      prisma.quizAttemptAnswer.count({
        where: { attempt: { assessmentId: { in: quizIds } } },
      }),
      prisma.learnerAssessmentState.count({
        where: { assessmentId: { in: quizIds } },
      }),
    ]);
  console.log('\nSố dòng của các Quiz demo trong DB:');
  console.table({
    assessments: quizzes,
    quiz_questions: questions,
    quiz_question_options: options,
    quiz_attempts: attempts,
    quiz_attempt_answers: answers,
    learner_assessment_states: states,
  });

  console.log('Quiz demo (course -> quiz):');
  for (const quiz of QUIZZES) {
    const tags = [
      quiz.moduleId ? `module ${quiz.moduleId}` : 'gắn Course',
      `pos ${quiz.position}`,
      quiz.isRequired ? 'bắt buộc' : 'không bắt buộc',
      `${quiz.questions.length} câu`,
      quiz.attempts.length ? `${quiz.attempts.length} lượt làm (khóa)` : '',
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `  ${quiz.course.id} -> ${quizId(quiz)}  ${quiz.title} [${tags}]`,
    );
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Refusing to seed: NODE_ENV=production. Seed data is for development only.',
    );
    process.exit(1);
  }

  const prisma = createPrismaClient();
  try {
    const errors = await validate(prisma);
    if (errors.length > 0) {
      console.error('Seed Quiz bị dừng, chưa ghi dòng nào:');
      for (const error of errors) console.error(`  - ${error}`);
      process.exitCode = 1;
      return;
    }
    await seed(prisma);
    console.log('assessment-service: quiz seed completed.');
    await printSummary(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
