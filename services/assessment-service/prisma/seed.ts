/**
 * Dữ liệu demo cho assessment-service. CHỈ DÙNG CHO DEV.
 *
 * Chạy: npm run db:seed
 * Chạy lại an toàn: mọi bản ghi ghi bằng upsert theo ID cố định, lần sau đưa dữ liệu về đúng trạng thái demo.
 *
 * Dùng chung ID demo với course-service (tổ chức, Instructor, Course) để hai service khớp nhau.
 * Hãy chạy `npm run db:seed` của course-service trước: assessment-service hỏi Course Service về chủ sở hữu,
 * trạng thái và Locked của Course trước khi cho tạo/sửa/xóa Assignment.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// ID cố định (trùng với prisma/seed.ts của course-service)
// ---------------------------------------------------------------------------
// Tổ chức ABC, Instructor và Learner của tài khoản dev (identity-service DevAccountSeeder, course-service prisma/seed.ts).
const ORG_A = '01900000-0000-7000-8000-00000000a001'; // ABC
const LEARNER_1 = '01900000-0000-7000-8000-00000000a201'; // learner@learnup.local
// Tổ chức thứ hai chỉ để thử không xem chéo giữa các tổ chức; course-service không có tổ chức và Course nào như vậy.
const ORG_B = '0199a000-0000-7000-8000-0a0000000002';

// Course version của prisma/seed.ts của course-service: 01900000-…-c002 + (chuỗi * 10 + phiên bản) viết hex 8 chữ số.
const COURSE_AN_TOAN_V2 = '01900000-0000-7000-8000-c0020000005c'; // VERSION2_PUBLISHED
const COURSE_BAO_MAT = '01900000-0000-7000-8000-c00200000065'; // PUBLISHED_PRIVATE
const COURSE_QUY_TRINH = '01900000-0000-7000-8000-c00200000079'; // PUBLISHED_DISABLED_MATERIAL
const COURSE_NHAP_MON = '0199a000-0000-7000-8000-0e0000000006'; // Published, org B
// COURSE_GIAO_TIEP (…0e0000000005, Draft) cố ý không có Assignment: dùng để thử tạo mới (UC19.2).

// ID của riêng assessment-service. Quy ước: 2a = Assignment, 2b = tiêu chí Rubric, 2c = bài nộp, 2d = trạng thái Learner.
const PLATFORM_SETTINGS_ID = '0199a000-0000-7000-8000-1f0000000002';

// ---------------------------------------------------------------------------
// Dữ liệu
// ---------------------------------------------------------------------------
interface SeedCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
}

interface SeedAssignment {
  id: string;
  organizationId: string;
  courseId: string;
  title: string;
  prompt: string;
  passingScore: number;
  expectedDurationMinutes: number;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  peerReview?: {
    reviewersPerSubmission: number;
    cycleDays: number;
    deadlineDays: number;
    scoreGap: number;
  };
  /** Có bài nộp: Assignment bị khóa sửa đề bài, Rubric, n, m (BR-98) nên dùng để thử trạng thái "Editing Restricted". */
  withSubmission?: boolean;
  /** Position among the Course's Assignments (default 1). */
  position?: number;
  /** Disabled by the Organizer after a confirmed violation (BR-239). */
  disabled?: boolean;
  /** Number of Learners that already submitted (UI demo data only). */
  submissionCount?: number;
  rubric: SeedCriterion[];
}

const ASSIGNMENTS: SeedAssignment[] = [
  {
    id: '0199a000-0000-7000-8000-2a0000000001',
    organizationId: ORG_A,
    courseId: COURSE_AN_TOAN_V2,
    title: 'Kế hoạch ứng phó sự cố tại nơi làm việc',
    prompt:
      'Chọn một tình huống sự cố thực tế tại đơn vị của bạn, mô tả mối nguy, mức độ rủi ro và các bước ứng phó. Nộp bài dưới dạng văn bản.',
    passingScore: 80,
    expectedDurationMinutes: 90,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    peerReview: {
      reviewersPerSubmission: 2,
      cycleDays: 7,
      deadlineDays: 3,
      scoreGap: 20,
    },
    rubric: [
      {
        id: '0199a000-0000-7000-8000-2b0000000101',
        name: 'Nhận diện mối nguy',
        description: 'Nhận diện đúng và đầy đủ mối nguy của tình huống',
        maxPoints: 25,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000102',
        name: 'Đánh giá rủi ro',
        description: 'Đánh giá hợp lý mức độ rủi ro',
        maxPoints: 25,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000103',
        name: 'Biện pháp ứng phó',
        description: 'Các bước ứng phó cụ thể, khả thi',
        maxPoints: 30,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000104',
        name: 'Trình bày',
        description: 'Trình bày rõ ràng, mạch lạc',
        maxPoints: 20,
      },
    ],
  },
  {
    id: '0199a000-0000-7000-8000-2a0000000002',
    organizationId: ORG_A,
    courseId: COURSE_BAO_MAT,
    title: 'Báo cáo rà soát bảo mật thông tin',
    prompt:
      'Rà soát một quy trình làm việc của bạn theo các nguyên tắc bảo mật đã học và nêu ít nhất ba điểm cần cải thiện.',
    passingScore: 70,
    expectedDurationMinutes: 60,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    rubric: [
      {
        id: '0199a000-0000-7000-8000-2b0000000201',
        name: 'Tính đầy đủ',
        description: 'Bao quát các nguyên tắc bảo mật liên quan',
        maxPoints: 40,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000202',
        name: 'Độ chính xác',
        description: 'Nhận định đúng, có dẫn chứng',
        maxPoints: 40,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000203',
        name: 'Trình bày',
        description: 'Rõ ràng, súc tích',
        maxPoints: 20,
      },
    ],
  },
  {
    id: '0199a000-0000-7000-8000-2a0000000003',
    organizationId: ORG_A,
    courseId: COURSE_QUY_TRINH,
    title: 'Mô tả quy trình xử lý yêu cầu nội bộ',
    prompt:
      'Mô tả từng bước xử lý một yêu cầu nội bộ từ lúc tiếp nhận đến khi đóng yêu cầu.',
    passingScore: 70,
    expectedDurationMinutes: 45,
    maxConsecutiveAttempts: 5,
    lockoutHours: 12,
    withSubmission: true,
    rubric: [
      {
        id: '0199a000-0000-7000-8000-2b0000000301',
        name: 'Thứ tự các bước',
        description: 'Các bước đúng thứ tự và đầy đủ',
        maxPoints: 60,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000302',
        name: 'Rõ ràng',
        description: 'Mô tả dễ hiểu, không mơ hồ',
        maxPoints: 40,
      },
    ],
  },
  {
    // Tổ chức B: dùng để kiểm tra cách ly dữ liệu giữa các tổ chức.
    id: '0199a000-0000-7000-8000-2a0000000004',
    organizationId: ORG_B,
    courseId: COURSE_NHAP_MON,
    title: 'Bài tập nhập môn sản phẩm',
    prompt:
      'Giới thiệu ngắn gọn về sản phẩm theo cách bạn sẽ trình bày với khách hàng mới.',
    passingScore: 60,
    expectedDurationMinutes: 30,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    rubric: [
      {
        id: '0199a000-0000-7000-8000-2b0000000401',
        name: 'Nội dung',
        description: 'Nêu đúng giá trị chính của sản phẩm',
        maxPoints: 50,
      },
      {
        id: '0199a000-0000-7000-8000-2b0000000402',
        name: 'Cách trình bày',
        description: 'Dễ hiểu với người mới',
        maxPoints: 50,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Danh tính của giao diện (course-service/prisma/seed.ts: ORG_UI, INSTRUCTOR_UI): mỗi Course demo một trạng thái.
//   Course 1 Draft và Course 10 (Blank Draft): cố ý không có Assignment, dùng để thử tạo mới (UC19.2).
// ---------------------------------------------------------------------------
const ORG_UI = '22222222-2222-7222-8222-222222222222';
const UI_DISABLED_AT = new Date('2026-09-29T02:00:00Z');

ASSIGNMENTS.push(
  {
    id: '33333333-eeee-7333-8333-000000000001',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000002',
    title: 'Data protection case study',
    prompt:
      'Read the case and explain which data protection rules were broken and how to prevent it.',
    passingScore: 75,
    expectedDurationMinutes: 90,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    peerReview: {
      reviewersPerSubmission: 2,
      cycleDays: 7,
      deadlineDays: 3,
      scoreGap: 20,
    },
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000011',
        name: 'Analysis',
        description: 'Identifies the broken rules',
        maxPoints: 40,
      },
      {
        id: '33333333-ffff-7333-8333-000000000012',
        name: 'Prevention',
        description: 'Proposes realistic controls',
        maxPoints: 40,
      },
      {
        id: '33333333-ffff-7333-8333-000000000013',
        name: 'Clarity',
        description: 'Easy to follow',
        maxPoints: 20,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000002',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000003',
    title: 'Customer complaint role-play script',
    prompt:
      'Write a script for handling an angry customer, showing how you stay calm and solve the problem.',
    passingScore: 70,
    expectedDurationMinutes: 45,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    peerReview: {
      reviewersPerSubmission: 2,
      cycleDays: 7,
      deadlineDays: 3,
      scoreGap: 20,
    },
    submissionCount: 2,
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000021',
        name: 'Empathy',
        description: 'Acknowledges the customer feelings',
        maxPoints: 50,
      },
      {
        id: '33333333-ffff-7333-8333-000000000022',
        name: 'Solution',
        description: 'Offers a concrete next step',
        maxPoints: 50,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000003',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000003',
    title: 'Service improvement proposal',
    prompt:
      'Propose one improvement to the service process and explain the expected benefit.',
    passingScore: 70,
    expectedDurationMinutes: 30,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    position: 2,
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000031',
        name: 'Idea',
        description: 'Clear and realistic improvement',
        maxPoints: 60,
      },
      {
        id: '33333333-ffff-7333-8333-000000000032',
        name: 'Benefit',
        description: 'Expected benefit is explained',
        maxPoints: 40,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000004',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000004',
    title: 'Onboarding reflection',
    prompt:
      'Write what you learned in your first week and what you still need help with.',
    passingScore: 70,
    expectedDurationMinutes: 20,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000041',
        name: 'Reflection',
        description: 'Honest and specific',
        maxPoints: 100,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000005',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000005',
    title: 'Remote team charter',
    prompt:
      'Draft a short charter for how your remote team communicates and meets.',
    passingScore: 70,
    expectedDurationMinutes: 40,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000051',
        name: 'Communication rules',
        description: 'Clear rules for chat and meetings',
        maxPoints: 60,
      },
      {
        id: '33333333-ffff-7333-8333-000000000052',
        name: 'Availability',
        description: 'Working hours and response times',
        maxPoints: 40,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000006',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000006',
    title: 'Evacuation drill report',
    prompt:
      'Report on the last evacuation drill: what went well and what did not.',
    passingScore: 70,
    expectedDurationMinutes: 30,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    submissionCount: 1,
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000061',
        name: 'Observations',
        description: 'Concrete observations',
        maxPoints: 70,
      },
      {
        id: '33333333-ffff-7333-8333-000000000062',
        name: 'Follow-up',
        description: 'Actions to improve',
        maxPoints: 30,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000007',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000008',
    title: 'Compliance scenario analysis',
    prompt:
      'Analyse the scenario and decide which compliance obligations apply.',
    passingScore: 70,
    expectedDurationMinutes: 50,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    disabled: true,
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000071',
        name: 'Obligations',
        description: 'Correct obligations identified',
        maxPoints: 100,
      },
    ],
  },
  {
    id: '33333333-eeee-7333-8333-000000000008',
    organizationId: ORG_UI,
    courseId: '33333333-bbbb-7333-8333-000000000009',
    title: 'Leadership vision statement',
    prompt:
      'Write a one-page vision statement for your team and how you will measure it.',
    passingScore: 70,
    expectedDurationMinutes: 60,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    peerReview: {
      reviewersPerSubmission: 2,
      cycleDays: 7,
      deadlineDays: 3,
      scoreGap: 20,
    },
    rubric: [
      {
        id: '33333333-ffff-7333-8333-000000000081',
        name: 'Vision',
        description: 'Inspiring and specific',
        maxPoints: 50,
      },
      {
        id: '33333333-ffff-7333-8333-000000000082',
        name: 'Measures',
        description: 'Measurable indicators',
        maxPoints: 50,
      },
    ],
  },
);

const SUBMISSION_ID = '0199a000-0000-7000-8000-2c0000000001';
const LEARNER_STATE_ID = '0199a000-0000-7000-8000-2d0000000001';
const SUBMITTED_AT = new Date('2026-09-25T03:00:00Z');

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
  // Tham số cấp nền tảng (BR-268): lấy mặc định từ schema (n=3, m=24, chu kỳ 7 ngày, hạn 3 ngày, nhắc 24 giờ).
  await prisma.platformSetting.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    update: {},
    create: {
      id: PLATFORM_SETTINGS_ID,
      sourceAsOf: new Date('2026-09-01T00:00:00Z'),
    },
  });

  for (const a of ASSIGNMENTS) {
    const data = {
      organizationId: a.organizationId,
      courseId: a.courseId,
      moduleId: null,
      kind: 'ASSIGNMENT',
      title: a.title,
      position: a.position ?? 1,
      passingScore: a.passingScore,
      maxConsecutiveAttempts: a.maxConsecutiveAttempts,
      lockoutHours: a.lockoutHours,
      isRequired: true, // BR-165: Assignment không có cờ bắt buộc, luôn tính vào điều kiện cấp Certificate
      prompt: a.prompt,
      expectedDurationMinutes: a.expectedDurationMinutes,
      peerReviewEnabled: a.peerReview !== undefined,
      peerReviewersPerSubmission: a.peerReview?.reviewersPerSubmission ?? null,
      peerReviewCycleDays: a.peerReview?.cycleDays ?? null,
      peerReviewDeadlineDays: a.peerReview?.deadlineDays ?? null,
      peerReviewScoreGap: a.peerReview?.scoreGap ?? null,
      disabledAt: a.disabled ? UI_DISABLED_AT : null,
    };
    await prisma.assessment.upsert({
      where: { id: a.id },
      update: data,
      create: { id: a.id, ...data },
    });

    for (const [index, criterion] of a.rubric.entries()) {
      const criterionData = {
        organizationId: a.organizationId,
        assessmentId: a.id,
        name: criterion.name,
        description: criterion.description,
        maxPoints: criterion.maxPoints,
        position: index + 1,
      };
      await prisma.rubricCriterion.upsert({
        where: { id: criterion.id },
        update: criterionData,
        create: { id: criterion.id, ...criterionData },
      });
    }
  }

  // Một bài nộp cho Assignment "Quy trình nội bộ" để có trạng thái bị khóa sửa (BR-98).
  // gradingStatus 'Pending' chỉ là giá trị tạm cho demo: bộ giá trị thật sẽ được chốt khi làm UC30 (nộp bài).
  const submitted = ASSIGNMENTS.find((a) => a.withSubmission);
  if (submitted) {
    const submissionData = {
      organizationId: submitted.organizationId,
      assessmentId: submitted.id,
      learnerId: LEARNER_1,
      submissionNumber: 1,
      content:
        'Bước 1: tiếp nhận yêu cầu. Bước 2: phân loại. Bước 3: xử lý. Bước 4: xác nhận và đóng yêu cầu.',
      submittedAt: SUBMITTED_AT,
      gradingStatus: 'Pending',
    };
    await prisma.submission.upsert({
      where: { id: SUBMISSION_ID },
      update: submissionData,
      create: { id: SUBMISSION_ID, ...submissionData },
    });

    // Tìm theo id (không theo cặp Assessment + Learner): một DB đã seed bằng bản cũ có dòng này với Learner 0199a…,
    // và seed lại phải chuyển nó sang Learner mới chứ không tạo thêm dòng trùng id.
    const stateData = {
      organizationId: submitted.organizationId,
      assessmentId: submitted.id,
      learnerId: LEARNER_1,
      firstActivityAt: SUBMITTED_AT,
      consecutiveCount: 1,
      latestSubmissionId: SUBMISSION_ID,
    };
    await prisma.learnerAssessmentState.upsert({
      where: { id: LEARNER_STATE_ID },
      update: stateData,
      create: { id: LEARNER_STATE_ID, ...stateData },
    });
  }

  // Submissions of the UI demo Assignments (a Learner id is only a number here: Learners live in other services).
  let counter = 0;
  for (const a of ASSIGNMENTS.filter(
    (x) => x.organizationId === ORG_UI && x.submissionCount,
  )) {
    for (let i = 1; i <= (a.submissionCount ?? 0); i++) {
      counter++;
      const learnerId = `33333333-9999-7333-8333-${String(i).padStart(12, '0')}`;
      const submissionId = `33333333-1111-7333-8333-${String(counter).padStart(12, '0')}`;
      const submissionData = {
        organizationId: a.organizationId,
        assessmentId: a.id,
        learnerId,
        submissionNumber: 1,
        content: 'Demo submission: step 1, step 2, step 3.',
        submittedAt: SUBMITTED_AT,
        gradingStatus: 'Pending',
      };
      await prisma.submission.upsert({
        where: { id: submissionId },
        update: submissionData,
        create: { id: submissionId, ...submissionData },
      });
      const stateData = {
        organizationId: a.organizationId,
        firstActivityAt: SUBMITTED_AT,
        consecutiveCount: 1,
        latestSubmissionId: submissionId,
      };
      await prisma.learnerAssessmentState.upsert({
        where: { assessmentId_learnerId: { assessmentId: a.id, learnerId } },
        update: stateData,
        create: {
          id: `33333333-2222-7333-8333-${String(counter).padStart(12, '0')}`,
          assessmentId: a.id,
          learnerId,
          ...stateData,
        },
      });
    }
  }
}

function printIds(): void {
  console.log('\nAssignment demo (course -> assignment):');
  for (const a of ASSIGNMENTS) {
    const tags = [
      a.peerReview ? 'peer review ON' : 'peer review off',
      a.withSubmission || a.submissionCount ? 'có bài nộp (khóa sửa)' : '',
      a.disabled ? 'bị vô hiệu hóa' : '',
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`  ${a.courseId} -> ${a.id}  ${a.title} [${tags}]`);
  }
  console.log(
    '\nCourse không có Assignment (thử tạo mới): 0199a000-0000-7000-8000-0e0000000005 (Draft)',
  );
  console.log(
    'Instructor org ABC: 01900000-0000-7000-8000-00000000a101, org ABC: 01900000-0000-7000-8000-00000000a001',
  );
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
    await seed(prisma);
    console.log('assessment-service: seed completed.');
    printIds();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
