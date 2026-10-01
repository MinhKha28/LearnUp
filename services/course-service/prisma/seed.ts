/**
 * Dữ liệu demo Inter 1 cho course-service. CHỈ DÙNG CHO DEV.
 *
 * Chạy: npm run db:seed
 * Chạy lại an toàn: mọi bản ghi ghi bằng upsert theo ID cố định, lần sau đưa dữ liệu về đúng trạng thái demo.
 * Giá trị trạng thái theo docs/database/CourseService_Database_Design.md mục 3 (PascalCase),
 * và dữ liệu thỏa các CHECK của thiết kế dù database chưa có CHECK.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// ID cố định
// ---------------------------------------------------------------------------
const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const ORG_B = '0199a000-0000-7000-8000-0a0000000002';

// Người dùng chỉ là UUID logic do tenant-service sở hữu; course-service không có bảng người dùng.
const LEARNER_1 = '0199a000-0000-7000-8000-0b0000000001'; // org A
const LEARNER_2 = '0199a000-0000-7000-8000-0b0000000002'; // org A
const LEARNER_3 = '0199a000-0000-7000-8000-0b0000000003'; // org B
const INSTRUCTOR_1 = '0199a000-0000-7000-8000-0c0000000001'; // org A
const INSTRUCTOR_2 = '0199a000-0000-7000-8000-0c0000000002'; // org B

const PLATFORM_SETTINGS_ID = '0199a000-0000-7000-8000-1f0000000001';

const CHAIN_AN_TOAN = '0199a000-0000-7000-8000-0d0000000001';
const CHAIN_BAO_MAT = '0199a000-0000-7000-8000-0d0000000002';
const CHAIN_QUY_TRINH = '0199a000-0000-7000-8000-0d0000000003';
const CHAIN_GIAO_TIEP = '0199a000-0000-7000-8000-0d0000000004';
const CHAIN_NHAP_MON = '0199a000-0000-7000-8000-0d0000000005';

const COURSE_AN_TOAN_V1 = '0199a000-0000-7000-8000-0e0000000001';
const COURSE_AN_TOAN_V2 = '0199a000-0000-7000-8000-0e0000000002';
const COURSE_BAO_MAT = '0199a000-0000-7000-8000-0e0000000003';
const COURSE_QUY_TRINH = '0199a000-0000-7000-8000-0e0000000004';
const COURSE_GIAO_TIEP = '0199a000-0000-7000-8000-0e0000000005';
const COURSE_NHAP_MON = '0199a000-0000-7000-8000-0e0000000006';

// Quy ước phần cuối ID trong cây: 1a = module, 1b = lesson, 1c = học liệu, 1d = tệp; tiếp theo là số Course, Lesson, học liệu.

/**
 * Fixture cho test tích hợp learning-service (D34), không dùng cho demo: dải ID đuôi …f*.
 * Test được phép ghi rồi dọn mọi dữ liệu của ORG_TEST; không thêm dữ liệu demo vào tổ chức này.
 * …0a00000000f1 đã thuộc TEST_ORG của test:catalog:db nên không dùng.
 */
const ORG_TEST = '0199a000-0000-7000-8000-0a00000000f2';
const INSTRUCTOR_TEST = '0199a000-0000-7000-8000-0c00000000f1';
const CHAIN_TEST_PUBLIC = '0199a000-0000-7000-8000-0d00000000f1';
const CHAIN_TEST_PRIVATE = '0199a000-0000-7000-8000-0d00000000f2';
const COURSE_TEST_PUBLIC = '0199a000-0000-7000-8000-0e00000000f1';
const COURSE_TEST_PRIVATE = '0199a000-0000-7000-8000-0e00000000f2';

/**
 * Dữ liệu cho danh tính mà giao diện đang gắn cứng (course.service.ts: x-user-id 3333…, x-organization-id 2222…),
 * để trang My Courses và Course Builder có Course ngay khi chưa có gateway/đăng nhập. Dải ID …bbbb/cccc/dddd.
 * Status viết hoa (DRAFT/PUBLISHED) giống giá trị mà nút Create Course của giao diện ghi vào DB.
 */
const ORG_UI = '22222222-2222-7222-8222-222222222222';
const INSTRUCTOR_UI = '33333333-3333-7333-8333-333333333333';
const CHAIN_UI_DRAFT = '33333333-aaaa-7333-8333-000000000001';
const CHAIN_UI_PUBLISHED = '33333333-aaaa-7333-8333-000000000002';
const COURSE_UI_DRAFT = '33333333-bbbb-7333-8333-000000000001';
const COURSE_UI_PUBLISHED = '33333333-bbbb-7333-8333-000000000002';

// ---------------------------------------------------------------------------
// Dữ liệu
// ---------------------------------------------------------------------------
type MaterialType = 'Video' | 'Reading';

interface SeedMaterial {
  id: string;
  fileId: string;
  type: MaterialType;
  title: string;
  isRequired: boolean;
  /** Giây với Video (300–1200), số từ với Reading (500–3000) */
  amount: number;
}

interface SeedLesson {
  id: string;
  title: string;
  content: string;
  materials: SeedMaterial[];
}

interface SeedModule {
  id: string;
  title: string;
  lessons: SeedLesson[];
}

interface SeedCourse {
  id: string;
  organizationId: string;
  chainId: string;
  versionNumber: number;
  name: string;
  courseType: 'Public' | 'Private';
  status: 'Draft' | 'Published' | 'Archived' | 'DRAFT' | 'PUBLISHED';
  expectedCompletionDays: number;
  shortDescription: string | null;
  trainingObjectives: string | null;
  learningOutcomes: string[];
  submittedAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  modules: SeedModule[];
}

const CHAINS = [
  { id: CHAIN_AN_TOAN, organizationId: ORG_A, instructorId: INSTRUCTOR_1 },
  { id: CHAIN_BAO_MAT, organizationId: ORG_A, instructorId: INSTRUCTOR_1 },
  { id: CHAIN_QUY_TRINH, organizationId: ORG_A, instructorId: INSTRUCTOR_1 },
  { id: CHAIN_GIAO_TIEP, organizationId: ORG_A, instructorId: INSTRUCTOR_1 },
  { id: CHAIN_NHAP_MON, organizationId: ORG_B, instructorId: INSTRUCTOR_2 },
  { id: CHAIN_TEST_PUBLIC, organizationId: ORG_TEST, instructorId: INSTRUCTOR_TEST },
  { id: CHAIN_TEST_PRIVATE, organizationId: ORG_TEST, instructorId: INSTRUCTOR_TEST },
  { id: CHAIN_UI_DRAFT, organizationId: ORG_UI, instructorId: INSTRUCTOR_UI },
  { id: CHAIN_UI_PUBLISHED, organizationId: ORG_UI, instructorId: INSTRUCTOR_UI },
];

const TEST_COURSE_DESCRIPTION = {
  shortDescription: 'Dữ liệu cố định cho test tích hợp learning-service.',
  trainingObjectives:
    'Cung cấp một Course Published đủ trường bắt buộc để test tích hợp tự ghi và tự dọn mà không đụng dữ liệu demo.',
  learningOutcomes: ['Không dùng cho demo'],
  submittedAt: new Date('2026-09-20T02:00:00Z'),
  publishedAt: new Date('2026-09-22T02:00:00Z'),
  archivedAt: null,
};

const TEST_LESSON_CONTENT =
  '## Lesson kiểm thử\n\nNội dung cố định cho test tích hợp.';

const AN_TOAN_DESCRIPTION = {
  shortDescription:
    'Khóa học giúp người lao động nhận diện mối nguy và làm việc an toàn mỗi ngày.',
  trainingObjectives:
    'Sau khóa học, học viên nhận diện được các mối nguy phổ biến tại nơi làm việc, sử dụng đúng trang bị bảo hộ và biết cách ứng phó khi xảy ra sự cố.',
  learningOutcomes: [
    'Nhận diện các loại mối nguy tại nơi làm việc',
    'Đánh giá mức độ rủi ro của một công việc cụ thể',
    'Lựa chọn và sử dụng đúng trang bị bảo hộ cá nhân',
    'Thực hiện các bước sơ cứu cơ bản',
  ],
};

const COURSES: SeedCourse[] = [
  {
    id: COURSE_AN_TOAN_V1,
    organizationId: ORG_A,
    chainId: CHAIN_AN_TOAN,
    versionNumber: 1,
    name: 'An toàn lao động',
    courseType: 'Public',
    status: 'Archived',
    expectedCompletionDays: 14,
    ...AN_TOAN_DESCRIPTION,
    submittedAt: new Date('2026-07-30T02:00:00Z'),
    publishedAt: new Date('2026-08-01T02:00:00Z'),
    // Bị thay bởi v2 đúng lúc v2 được duyệt
    archivedAt: new Date('2026-09-15T02:00:00Z'),
    modules: [],
  },
  {
    id: COURSE_AN_TOAN_V2,
    organizationId: ORG_A,
    chainId: CHAIN_AN_TOAN,
    versionNumber: 2,
    name: 'An toàn lao động',
    courseType: 'Public',
    status: 'Published',
    expectedCompletionDays: 14,
    ...AN_TOAN_DESCRIPTION,
    submittedAt: new Date('2026-09-12T02:00:00Z'),
    publishedAt: new Date('2026-09-15T02:00:00Z'),
    archivedAt: null,
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a0000000011',
        title: 'Nhận diện mối nguy',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000011',
            title: 'Các loại mối nguy tại nơi làm việc',
            content:
              '## Mối nguy là gì?\n\nMối nguy là bất kỳ yếu tố nào có thể gây tổn hại cho sức khỏe con người.\n\n- Mối nguy vật lý: tiếng ồn, nhiệt độ, điện\n- Mối nguy hóa học: dung môi, bụi\n- Mối nguy cơ học: máy móc đang vận hành',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000111', fileId: '0199a000-0000-7000-8000-1d0000000111', type: 'Video', title: 'Bài giảng: Các loại mối nguy', isRequired: true, amount: 600 },
              { id: '0199a000-0000-7000-8000-1c0000000112', fileId: '0199a000-0000-7000-8000-1d0000000112', type: 'Reading', title: 'Tài liệu: Bảng phân loại mối nguy', isRequired: true, amount: 1200 },
            ],
          },
          {
            id: '0199a000-0000-7000-8000-1b0000000012',
            title: 'Đánh giá rủi ro',
            content:
              '## Ba bước đánh giá rủi ro\n\n1. Xác định mối nguy\n2. Ước lượng khả năng xảy ra và mức độ nghiêm trọng\n3. Đề xuất biện pháp kiểm soát',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000121', fileId: '0199a000-0000-7000-8000-1d0000000121', type: 'Video', title: 'Bài giảng: Ma trận rủi ro', isRequired: true, amount: 900 },
            ],
          },
        ],
      },
      {
        id: '0199a000-0000-7000-8000-1a0000000012',
        title: 'Phòng ngừa và ứng phó',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000013',
            title: 'Trang bị bảo hộ cá nhân',
            content:
              '## Trang bị bảo hộ cá nhân\n\nMũ, kính, găng tay và giày bảo hộ phải **phù hợp với công việc** và được kiểm tra trước mỗi ca.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000131', fileId: '0199a000-0000-7000-8000-1d0000000131', type: 'Reading', title: 'Tài liệu: Hướng dẫn chọn trang bị bảo hộ', isRequired: true, amount: 800 },
              { id: '0199a000-0000-7000-8000-1c0000000132', fileId: '0199a000-0000-7000-8000-1d0000000132', type: 'Video', title: 'Video minh họa: Đeo găng tay đúng cách', isRequired: false, amount: 420 },
            ],
          },
          {
            id: '0199a000-0000-7000-8000-1b0000000014',
            title: 'Xử lý sự cố và sơ cứu',
            content:
              '## Khi xảy ra sự cố\n\n1. Bình tĩnh, đảm bảo an toàn cho bản thân\n2. Báo ngay cho người phụ trách\n3. Sơ cứu theo hướng dẫn nếu đã được đào tạo',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000141', fileId: '0199a000-0000-7000-8000-1d0000000141', type: 'Video', title: 'Bài giảng: Sơ cứu cơ bản', isRequired: true, amount: 1080 },
              { id: '0199a000-0000-7000-8000-1c0000000142', fileId: '0199a000-0000-7000-8000-1d0000000142', type: 'Reading', title: 'Tài liệu: Quy trình báo cáo sự cố', isRequired: true, amount: 1500 },
              { id: '0199a000-0000-7000-8000-1c0000000143', fileId: '0199a000-0000-7000-8000-1d0000000143', type: 'Reading', title: 'Đọc thêm: Các tình huống sơ cứu thường gặp', isRequired: false, amount: 2200 },
            ],
          },
          {
            // Lesson chỉ có học liệu không bắt buộc
            id: '0199a000-0000-7000-8000-1b0000000015',
            title: 'Tài liệu tham khảo thêm',
            content:
              '## Tài liệu tham khảo\n\nPhần này dành cho học viên muốn tìm hiểu sâu hơn, không bắt buộc để hoàn thành khóa học.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000151', fileId: '0199a000-0000-7000-8000-1d0000000151', type: 'Reading', title: 'Đọc thêm: Văn bản pháp luật về an toàn lao động', isRequired: false, amount: 2600 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_BAO_MAT,
    organizationId: ORG_A,
    chainId: CHAIN_BAO_MAT,
    versionNumber: 1,
    name: 'Bảo mật thông tin',
    courseType: 'Public',
    status: 'Published',
    expectedCompletionDays: 7,
    shortDescription:
      'Những thói quen cơ bản để bảo vệ thông tin của bạn và của công ty.',
    trainingObjectives:
      'Học viên hiểu vì sao bảo mật thông tin quan trọng, đặt mật khẩu an toàn, bật xác thực hai lớp và nhận diện được email lừa đảo.',
    learningOutcomes: [
      'Giải thích được hậu quả của việc rò rỉ dữ liệu',
      'Tạo và quản lý mật khẩu an toàn',
      'Nhận diện dấu hiệu của email lừa đảo',
    ],
    submittedAt: new Date('2026-08-18T02:00:00Z'),
    publishedAt: new Date('2026-08-20T02:00:00Z'),
    archivedAt: null,
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a0000000021',
        title: 'Nền tảng bảo mật',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000021',
            title: 'Vì sao bảo mật thông tin quan trọng',
            content:
              '## Thông tin là tài sản\n\nMột lần rò rỉ dữ liệu có thể gây thiệt hại về tài chính, uy tín và pháp lý cho cả công ty.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000211', fileId: '0199a000-0000-7000-8000-1d0000000211', type: 'Video', title: 'Bài giảng: Giá trị của thông tin', isRequired: true, amount: 480 },
            ],
          },
          {
            id: '0199a000-0000-7000-8000-1b0000000022',
            title: 'Mật khẩu và xác thực hai lớp',
            content:
              '## Mật khẩu an toàn\n\n- Dài ít nhất 12 ký tự\n- Không dùng lại giữa các dịch vụ\n- Luôn bật **xác thực hai lớp** khi có thể',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000221', fileId: '0199a000-0000-7000-8000-1d0000000221', type: 'Reading', title: 'Tài liệu: Chính sách mật khẩu', isRequired: true, amount: 900 },
              { id: '0199a000-0000-7000-8000-1c0000000222', fileId: '0199a000-0000-7000-8000-1d0000000222', type: 'Video', title: 'Video minh họa: Bật xác thực hai lớp', isRequired: false, amount: 360 },
            ],
          },
        ],
      },
      {
        id: '0199a000-0000-7000-8000-1a0000000022',
        title: 'Thực hành an toàn hằng ngày',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000023',
            title: 'Nhận diện email lừa đảo',
            content:
              '## Dấu hiệu email lừa đảo\n\n1. Địa chỉ người gửi lạ hoặc gần giống địa chỉ thật\n2. Thúc giục hành động gấp\n3. Đường dẫn hoặc tệp đính kèm đáng ngờ',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000231', fileId: '0199a000-0000-7000-8000-1d0000000231', type: 'Video', title: 'Bài giảng: Phân tích một email lừa đảo', isRequired: true, amount: 720 },
              { id: '0199a000-0000-7000-8000-1c0000000232', fileId: '0199a000-0000-7000-8000-1d0000000232', type: 'Reading', title: 'Tài liệu: Danh sách kiểm tra trước khi bấm đường dẫn', isRequired: true, amount: 1100 },
            ],
          },
          {
            // Lesson chỉ có học liệu không bắt buộc
            id: '0199a000-0000-7000-8000-1b0000000024',
            title: 'Câu chuyện thực tế về rò rỉ dữ liệu',
            content:
              '## Bài học từ thực tế\n\nMột số vụ rò rỉ dữ liệu nổi tiếng và điều chúng ta có thể học được.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000241', fileId: '0199a000-0000-7000-8000-1d0000000241', type: 'Video', title: 'Video tham khảo: Phân tích một vụ rò rỉ dữ liệu', isRequired: false, amount: 540 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_QUY_TRINH,
    organizationId: ORG_A,
    chainId: CHAIN_QUY_TRINH,
    versionNumber: 1,
    name: 'Quy trình nội bộ',
    courseType: 'Private',
    status: 'Published',
    expectedCompletionDays: 10,
    shortDescription:
      'Nắm vững cơ cấu tổ chức và các quy trình làm việc nội bộ của công ty.',
    trainingObjectives:
      'Nhân viên mới hiểu được cơ cấu tổ chức, quy trình phê duyệt chứng từ và cách báo cáo công việc định kỳ.',
    learningOutcomes: [
      'Mô tả được cơ cấu tổ chức và trách nhiệm của từng bộ phận',
      'Thực hiện đúng quy trình phê duyệt chứng từ',
      'Lập báo cáo công việc định kỳ đúng mẫu',
      'Tìm và sử dụng đúng biểu mẫu nội bộ',
    ],
    submittedAt: new Date('2026-08-25T02:00:00Z'),
    publishedAt: new Date('2026-08-27T02:00:00Z'),
    archivedAt: null,
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a0000000031',
        title: 'Tổng quan quy trình',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000031',
            title: 'Sơ đồ tổ chức và trách nhiệm',
            content:
              '## Sơ đồ tổ chức\n\nMỗi bộ phận có một người phụ trách. Khi cần hỗ trợ, hãy liên hệ đúng đầu mối theo sơ đồ.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000311', fileId: '0199a000-0000-7000-8000-1d0000000311', type: 'Reading', title: 'Tài liệu: Sơ đồ tổ chức công ty', isRequired: true, amount: 1300 },
            ],
          },
          {
            id: '0199a000-0000-7000-8000-1b0000000032',
            title: 'Quy trình phê duyệt chứng từ',
            content:
              '## Các bước phê duyệt\n\n1. Người đề nghị lập chứng từ\n2. Trưởng bộ phận xem xét\n3. Kế toán kiểm tra và lưu trữ',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000321', fileId: '0199a000-0000-7000-8000-1d0000000321', type: 'Video', title: 'Bài giảng: Luồng phê duyệt chứng từ', isRequired: true, amount: 840 },
              { id: '0199a000-0000-7000-8000-1c0000000322', fileId: '0199a000-0000-7000-8000-1d0000000322', type: 'Reading', title: 'Đọc thêm: Các lỗi thường gặp khi lập chứng từ', isRequired: false, amount: 1700 },
            ],
          },
        ],
      },
      {
        id: '0199a000-0000-7000-8000-1a0000000032',
        title: 'Áp dụng vào công việc',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000033',
            title: 'Báo cáo công việc định kỳ',
            content:
              '## Báo cáo tuần\n\nBáo cáo gửi trước **17 giờ thứ Sáu**, gồm việc đã làm, việc đang làm và khó khăn cần hỗ trợ.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000331', fileId: '0199a000-0000-7000-8000-1d0000000331', type: 'Video', title: 'Bài giảng: Viết báo cáo tuần hiệu quả', isRequired: true, amount: 660 },
              { id: '0199a000-0000-7000-8000-1c0000000332', fileId: '0199a000-0000-7000-8000-1d0000000332', type: 'Reading', title: 'Tài liệu: Mẫu báo cáo tuần', isRequired: true, amount: 950 },
              { id: '0199a000-0000-7000-8000-1c0000000333', fileId: '0199a000-0000-7000-8000-1d0000000333', type: 'Video', title: 'Video minh họa: Một báo cáo tuần mẫu', isRequired: false, amount: 300 },
            ],
          },
          {
            // Lesson chỉ có học liệu không bắt buộc
            id: '0199a000-0000-7000-8000-1b0000000034',
            title: 'Câu hỏi thường gặp',
            content:
              '## Câu hỏi thường gặp\n\nTổng hợp các thắc mắc của nhân viên mới về quy trình nội bộ.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000341', fileId: '0199a000-0000-7000-8000-1d0000000341', type: 'Reading', title: 'Đọc thêm: Hỏi đáp về quy trình nội bộ', isRequired: false, amount: 600 },
            ],
          },
          {
            id: '0199a000-0000-7000-8000-1b0000000035',
            title: 'Biểu mẫu nội bộ',
            content:
              '## Biểu mẫu\n\nDanh sách biểu mẫu dùng chung và nơi lưu trữ bản mới nhất.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000351', fileId: '0199a000-0000-7000-8000-1d0000000351', type: 'Reading', title: 'Tài liệu: Danh mục biểu mẫu nội bộ', isRequired: true, amount: 500 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_GIAO_TIEP,
    organizationId: ORG_A,
    chainId: CHAIN_GIAO_TIEP,
    versionNumber: 1,
    name: 'Kỹ năng giao tiếp',
    courseType: 'Public',
    status: 'Draft',
    expectedCompletionDays: 12,
    // Draft: chỉ có tên và số ngày
    shortDescription: null,
    trainingObjectives: null,
    learningOutcomes: [],
    submittedAt: null,
    publishedAt: null,
    archivedAt: null,
    modules: [],
  },
  {
    id: COURSE_NHAP_MON,
    organizationId: ORG_B,
    chainId: CHAIN_NHAP_MON,
    versionNumber: 1,
    name: 'Nhập môn sản phẩm',
    courseType: 'Public',
    status: 'Published',
    expectedCompletionDays: 5,
    shortDescription:
      'Làm quen với sản phẩm, khách hàng mục tiêu và các tính năng chính.',
    trainingObjectives:
      'Nhân viên mới hiểu sản phẩm giải quyết vấn đề gì, phục vụ ai và tự thao tác được các tính năng chính.',
    learningOutcomes: [
      'Trình bày được giá trị cốt lõi của sản phẩm',
      'Mô tả được chân dung khách hàng mục tiêu',
      'Thao tác được các tính năng chính của sản phẩm',
    ],
    submittedAt: new Date('2026-09-01T02:00:00Z'),
    publishedAt: new Date('2026-09-03T02:00:00Z'),
    archivedAt: null,
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a0000000041',
        title: 'Giới thiệu sản phẩm',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000041',
            title: 'Sản phẩm của chúng ta là gì',
            content:
              '## Tổng quan sản phẩm\n\nSản phẩm giúp doanh nghiệp quản lý đào tạo nội bộ một cách tập trung.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000411', fileId: '0199a000-0000-7000-8000-1d0000000411', type: 'Video', title: 'Bài giảng: Giới thiệu sản phẩm', isRequired: true, amount: 750 },
            ],
          },
          {
            id: '0199a000-0000-7000-8000-1b0000000042',
            title: 'Khách hàng mục tiêu',
            content:
              '## Khách hàng của chúng ta\n\n- Doanh nghiệp vừa và nhỏ\n- Có nhu cầu đào tạo nhân viên định kỳ',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000421', fileId: '0199a000-0000-7000-8000-1d0000000421', type: 'Reading', title: 'Tài liệu: Chân dung khách hàng', isRequired: true, amount: 1400 },
              { id: '0199a000-0000-7000-8000-1c0000000422', fileId: '0199a000-0000-7000-8000-1d0000000422', type: 'Video', title: 'Video tham khảo: Phỏng vấn khách hàng', isRequired: false, amount: 390 },
            ],
          },
        ],
      },
      {
        id: '0199a000-0000-7000-8000-1a0000000042',
        title: 'Sử dụng sản phẩm',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b0000000043',
            title: 'Các tính năng chính',
            content:
              '## Tính năng chính\n\n1. Quản lý khóa học\n2. Phân công đào tạo\n3. Theo dõi tiến độ và báo cáo',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000431', fileId: '0199a000-0000-7000-8000-1d0000000431', type: 'Video', title: 'Bài giảng: Hướng dẫn sử dụng tính năng chính', isRequired: true, amount: 1200 },
              { id: '0199a000-0000-7000-8000-1c0000000432', fileId: '0199a000-0000-7000-8000-1d0000000432', type: 'Reading', title: 'Tài liệu: Sổ tay sử dụng', isRequired: true, amount: 2000 },
            ],
          },
          {
            // Lesson chỉ có học liệu không bắt buộc
            id: '0199a000-0000-7000-8000-1b0000000044',
            title: 'Mẹo sử dụng nâng cao',
            content:
              '## Mẹo nâng cao\n\nMột số thủ thuật giúp thao tác nhanh hơn, dành cho người đã quen sản phẩm.',
            materials: [
              { id: '0199a000-0000-7000-8000-1c0000000441', fileId: '0199a000-0000-7000-8000-1d0000000441', type: 'Video', title: 'Video tham khảo: Phím tắt và thao tác nhanh', isRequired: false, amount: 960 },
              { id: '0199a000-0000-7000-8000-1c0000000442', fileId: '0199a000-0000-7000-8000-1d0000000442', type: 'Reading', title: 'Đọc thêm: Câu hỏi thường gặp nâng cao', isRequired: false, amount: 3000 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_TEST_PUBLIC,
    organizationId: ORG_TEST,
    chainId: CHAIN_TEST_PUBLIC,
    versionNumber: 1,
    name: 'Course kiểm thử tích hợp (không dùng cho demo)',
    courseType: 'Public',
    status: 'Published',
    expectedCompletionDays: 3,
    ...TEST_COURSE_DESCRIPTION,
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a00000000f1',
        title: 'Module kiểm thử',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b00000000f1',
            title: 'Lesson kiểm thử',
            content: TEST_LESSON_CONTENT,
            materials: [
              { id: '0199a000-0000-7000-8000-1c00000000f1', fileId: '0199a000-0000-7000-8000-1d00000000f1', type: 'Video', title: 'Video kiểm thử (bắt buộc)', isRequired: true, amount: 300 },
              { id: '0199a000-0000-7000-8000-1c00000000f2', fileId: '0199a000-0000-7000-8000-1d00000000f2', type: 'Reading', title: 'Reading kiểm thử (không bắt buộc)', isRequired: false, amount: 500 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_TEST_PRIVATE,
    organizationId: ORG_TEST,
    chainId: CHAIN_TEST_PRIVATE,
    versionNumber: 1,
    name: 'Course Private kiểm thử tích hợp (không dùng cho demo)',
    courseType: 'Private',
    status: 'Published',
    expectedCompletionDays: 3,
    ...TEST_COURSE_DESCRIPTION,
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a00000000f2',
        title: 'Module kiểm thử',
        lessons: [
          {
            id: '0199a000-0000-7000-8000-1b00000000f2',
            title: 'Lesson kiểm thử',
            content: TEST_LESSON_CONTENT,
            materials: [
              { id: '0199a000-0000-7000-8000-1c00000000f3', fileId: '0199a000-0000-7000-8000-1d00000000f3', type: 'Video', title: 'Video kiểm thử (bắt buộc)', isRequired: true, amount: 300 },
              { id: '0199a000-0000-7000-8000-1c00000000f4', fileId: '0199a000-0000-7000-8000-1d00000000f4', type: 'Reading', title: 'Reading kiểm thử (không bắt buộc)', isRequired: false, amount: 500 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_UI_DRAFT,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_DRAFT,
    versionNumber: 1,
    name: 'Workplace Safety Essentials (dev)',
    courseType: 'Public',
    status: 'DRAFT',
    expectedCompletionDays: 14,
    shortDescription: 'Course demo cho danh tính giao diện (My Courses / Course Builder).',
    trainingObjectives: 'Course demo để thử tạo Assignment trong Course Builder khi chưa có gateway.',
    learningOutcomes: ['Dùng thử Course Builder'],
    submittedAt: null,
    publishedAt: null,
    archivedAt: null,
    modules: [
      {
        id: '33333333-cccc-7333-8333-000000000001',
        title: 'Safety basics',
        lessons: [
          {
            id: '33333333-dddd-7333-8333-000000000001',
            title: 'Why safety matters',
            content: 'Giới thiệu về an toàn lao động.',
            materials: [],
          },
          {
            id: '33333333-dddd-7333-8333-000000000002',
            title: 'Common hazards',
            content: 'Các mối nguy thường gặp.',
            materials: [],
          },
        ],
      },
      {
        id: '33333333-cccc-7333-8333-000000000002',
        title: 'Emergency procedures',
        lessons: [
          {
            id: '33333333-dddd-7333-8333-000000000003',
            title: 'Evacuation plan',
            content: 'Việc cần làm khi có báo động.',
            materials: [],
          },
        ],
      },
    ],
  },
  {
    id: COURSE_UI_PUBLISHED,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_PUBLISHED,
    versionNumber: 1,
    name: 'Data Security Basics (dev)',
    courseType: 'Public',
    status: 'PUBLISHED',
    expectedCompletionDays: 14,
    shortDescription: 'Course demo cho danh tính giao diện (My Courses / Course Builder).',
    trainingObjectives: 'Course demo để thử tạo Assignment trong Course Builder khi chưa có gateway.',
    learningOutcomes: ['Dùng thử Course Builder'],
    submittedAt: new Date('2026-09-20T02:00:00Z'),
    publishedAt: new Date('2026-09-22T02:00:00Z'),
    archivedAt: null,
    modules: [
      {
        id: '33333333-cccc-7333-8333-000000000003',
        title: 'Security fundamentals',
        lessons: [
          {
            id: '33333333-dddd-7333-8333-000000000004',
            title: 'Passwords and phishing',
            content: 'Bảo vệ tài khoản cơ bản.',
            materials: [],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Thực thi
// ---------------------------------------------------------------------------
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function mediaFileData(organizationId: string, material: SeedMaterial, readyAt: Date) {
  const isVideo = material.type === 'Video';
  return {
    organizationId,
    purpose: isVideo ? 'MaterialVideo' : 'MaterialReading',
    status: 'Ready',
    storageKey: `seed/${material.id}`,
    originalFilename: `${material.id}.${isVideo ? 'mp4' : 'pdf'}`,
    mimeType: isVideo ? 'video/mp4' : 'application/pdf',
    // Ước lượng: video ~250 KB mỗi giây, PDF ~60 byte mỗi từ
    sizeBytes: BigInt(isVideo ? material.amount * 250_000 : material.amount * 60),
    durationSeconds: isVideo ? material.amount : null,
    wordCount: isVideo ? null : material.amount,
    readyAt,
    releasedAt: null,
  };
}

async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.platformSetting.upsert({
        where: { id: PLATFORM_SETTINGS_ID },
        create: { id: PLATFORM_SETTINGS_ID, sourceAsOf: new Date() },
        update: { sourceAsOf: new Date() },
      });

      for (const chain of CHAINS) {
        await tx.courseChain.upsert({
          where: { id: chain.id },
          create: chain,
          update: chain,
        });
      }

      for (const { modules, ...course } of COURSES) {
        // locked_at chỉ đặt khi tạo mới; chạy lại seed không gỡ Locked do learning-service gắn (BR-83)
        await tx.course.upsert({
          where: { id: course.id },
          create: { ...course, lockedAt: null },
          update: course,
        });

        for (const [moduleIndex, module] of modules.entries()) {
          const moduleData = {
            id: module.id,
            organizationId: course.organizationId,
            courseId: course.id,
            title: module.title,
            position: moduleIndex + 1,
          };
          await tx.courseModule.upsert({
            where: { id: module.id },
            create: moduleData,
            update: moduleData,
          });

          for (const [lessonIndex, lesson] of module.lessons.entries()) {
            const lessonData = {
              id: lesson.id,
              organizationId: course.organizationId,
              moduleId: module.id,
              title: lesson.title,
              content: lesson.content,
              position: lessonIndex + 1,
            };
            await tx.lesson.upsert({
              where: { id: lesson.id },
              create: lessonData,
              update: lessonData,
            });

            for (const [materialIndex, material] of lesson.materials.entries()) {
              const fileData = mediaFileData(course.organizationId, material, course.publishedAt ?? new Date());
              await tx.mediaFile.upsert({
                where: { id: material.fileId },
                create: { id: material.fileId, ...fileData },
                update: fileData,
              });

              const materialData = {
                id: material.id,
                organizationId: course.organizationId,
                lessonId: lesson.id,
                materialType: material.type,
                title: material.title,
                isRequired: material.isRequired,
                fileId: material.fileId,
                position: materialIndex + 1,
              };
              await tx.material.upsert({
                where: { id: material.id },
                create: materialData,
                update: materialData,
              });
            }
          }
        }
      }
    },
    { timeout: 60_000 },
  );
}

function printIds(): void {
  console.log('\nID demo Inter 1 (dùng làm header x-organization-id / x-user-id):\n');
  console.table([
    { loại: 'organization', tên: 'ORG_A', id: ORG_A },
    { loại: 'organization', tên: 'ORG_B', id: ORG_B },
    { loại: 'learner', tên: 'LEARNER_1 (org A)', id: LEARNER_1 },
    { loại: 'learner', tên: 'LEARNER_2 (org A)', id: LEARNER_2 },
    { loại: 'learner', tên: 'LEARNER_3 (org B)', id: LEARNER_3 },
    { loại: 'instructor', tên: 'INSTRUCTOR_1 (org A)', id: INSTRUCTOR_1 },
    { loại: 'instructor', tên: 'INSTRUCTOR_2 (org B)', id: INSTRUCTOR_2 },
    { loại: 'organization', tên: 'ORG_UI (danh tính giao diện)', id: ORG_UI },
    { loại: 'instructor', tên: 'INSTRUCTOR_UI (danh tính giao diện)', id: INSTRUCTOR_UI },
    ...COURSES.filter((course) => course.organizationId !== ORG_TEST).map((course) => ({
      loại: 'course',
      tên: `${course.name} v${course.versionNumber} (${course.status}, ${course.courseType}, org ${course.organizationId === ORG_A ? 'A' : course.organizationId === ORG_UI ? 'UI' : 'B'})`,
      id: course.id,
    })),
  ]);
  console.log('Fixture test tích hợp (không dùng cho demo):');
  console.table([
    { loại: 'organization', tên: 'ORG_TEST', id: ORG_TEST },
    { loại: 'instructor', tên: 'INSTRUCTOR_TEST', id: INSTRUCTOR_TEST },
    { loại: 'course', tên: 'Course test Public', id: COURSE_TEST_PUBLIC },
    { loại: 'course', tên: 'Course test Private', id: COURSE_TEST_PRIVATE },
  ]);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production. Seed data is for development only.');
    process.exit(1);
  }

  const prisma = createPrismaClient();
  try {
    await seed(prisma);
    console.log('course-service: seed completed.');
    printIds();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
