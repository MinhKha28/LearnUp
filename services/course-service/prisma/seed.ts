import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client';
import { COURSE_STATUS, COURSE_TYPE, type CourseStatus, type CourseType } from '../src/modules/courses/course-values';

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const ORG_B = '0199a000-0000-7000-8000-0a0000000002';

const LEARNER_1 = '0199a000-0000-7000-8000-0b0000000001';
const LEARNER_2 = '0199a000-0000-7000-8000-0b0000000002';
const LEARNER_3 = '0199a000-0000-7000-8000-0b0000000003';
const INSTRUCTOR_1 = '0199a000-0000-7000-8000-0c0000000001';
const INSTRUCTOR_2 = '0199a000-0000-7000-8000-0c0000000002';
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

const ORG_TEST = '0199a000-0000-7000-8000-0a00000000f2';
const INSTRUCTOR_TEST = '0199a000-0000-7000-8000-0c00000000f1';
const CHAIN_TEST_PUBLIC = '0199a000-0000-7000-8000-0d00000000f1';
const CHAIN_TEST_PRIVATE = '0199a000-0000-7000-8000-0d00000000f2';
const COURSE_TEST_PUBLIC = '0199a000-0000-7000-8000-0e00000000f1';
const COURSE_TEST_PRIVATE = '0199a000-0000-7000-8000-0e00000000f2';

const ORG_UI = '22222222-2222-7222-8222-222222222222';
const INSTRUCTOR_UI = '33333333-3333-7333-8333-333333333333';
const CHAIN_UI_DRAFT = '33333333-aaaa-7333-8333-000000000001';
const CHAIN_UI_PUBLISHED = '33333333-aaaa-7333-8333-000000000002';
const COURSE_UI_DRAFT = '33333333-bbbb-7333-8333-000000000001';
const COURSE_UI_PUBLISHED = '33333333-bbbb-7333-8333-000000000002';
const CHAIN_UI_3 = '33333333-aaaa-7333-8333-000000000003';
const CHAIN_UI_4 = '33333333-aaaa-7333-8333-000000000004';
const CHAIN_UI_5 = '33333333-aaaa-7333-8333-000000000005';
const CHAIN_UI_6 = '33333333-aaaa-7333-8333-000000000006';
const CHAIN_UI_7 = '33333333-aaaa-7333-8333-000000000007';
const CHAIN_UI_8 = '33333333-aaaa-7333-8333-000000000008';
const CHAIN_UI_9 = '33333333-aaaa-7333-8333-000000000009';
const COURSE_UI_3 = '33333333-bbbb-7333-8333-000000000003';
const COURSE_UI_4 = '33333333-bbbb-7333-8333-000000000004';
const COURSE_UI_5 = '33333333-bbbb-7333-8333-000000000005';
const COURSE_UI_6 = '33333333-bbbb-7333-8333-000000000006';
const COURSE_UI_7 = '33333333-bbbb-7333-8333-000000000007';
const COURSE_UI_8 = '33333333-bbbb-7333-8333-000000000008';
const COURSE_UI_9 = '33333333-bbbb-7333-8333-000000000009';
const COURSE_UI_10 = '33333333-bbbb-7333-8333-000000000010';

type MaterialType = 'Video' | 'Reading';

interface SeedMaterial {
  id: string;
  fileId: string;
  type: MaterialType;
  title: string;
  isRequired: boolean;

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
  courseType: CourseType;
  status: CourseStatus;
  expectedCompletionDays: number;
  shortDescription: string | null;
  trainingObjectives: string | null;
  learningOutcomes: string[];
  submittedAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  lockedAt?: Date | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  disabledAt?: Date | null;
  disabledReason?: string | null;
  modules: SeedModule[];
}

const CHAINS = [
  {"id": CHAIN_AN_TOAN, "organizationId": ORG_A, "instructorId": INSTRUCTOR_1},
  {"id": CHAIN_BAO_MAT, "organizationId": ORG_A, "instructorId": INSTRUCTOR_1},
  {"id": CHAIN_QUY_TRINH, "organizationId": ORG_A, "instructorId": INSTRUCTOR_1},
  {"id": CHAIN_GIAO_TIEP, "organizationId": ORG_A, "instructorId": INSTRUCTOR_1},
  {"id": CHAIN_NHAP_MON, "organizationId": ORG_B, "instructorId": INSTRUCTOR_2},
  {"id": CHAIN_TEST_PUBLIC, "organizationId": ORG_TEST, "instructorId": INSTRUCTOR_TEST},
  {"id": CHAIN_TEST_PRIVATE, "organizationId": ORG_TEST, "instructorId": INSTRUCTOR_TEST},
  {"id": CHAIN_UI_DRAFT, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_PUBLISHED, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_3, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_4, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_5, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_6, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_7, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_8, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
  {"id": CHAIN_UI_9, "organizationId": ORG_UI, "instructorId": INSTRUCTOR_UI},
];

const COURSES: SeedCourse[] = [
  {
    id: COURSE_AN_TOAN_V1,
    organizationId: ORG_A,
    chainId: CHAIN_AN_TOAN,
    versionNumber: 1,
    name: "An toàn lao động",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.ARCHIVED,
    expectedCompletionDays: 14,
    shortDescription: "Khóa học giúp người lao động nhận diện mối nguy và làm việc an toàn mỗi ngày.",
    trainingObjectives: "Sau khóa học, học viên nhận diện được các mối nguy phổ biến tại nơi làm việc, sử dụng đúng trang bị bảo hộ và biết cách ứng phó khi xảy ra sự cố.",
    learningOutcomes: ["Nhận diện các loại mối nguy tại nơi làm việc", "Đánh giá mức độ rủi ro của một công việc cụ thể", "Lựa chọn và sử dụng đúng trang bị bảo hộ cá nhân", "Thực hiện các bước sơ cứu cơ bản"],
    submittedAt: new Date("2026-07-30T02:00:00.000Z"),
    publishedAt: new Date("2026-08-01T02:00:00.000Z"),
    archivedAt: new Date("2026-09-15T02:00:00.000Z"),
    modules: [
    ],
  },
  {
    id: COURSE_AN_TOAN_V2,
    organizationId: ORG_A,
    chainId: CHAIN_AN_TOAN,
    versionNumber: 2,
    name: "An toàn lao động",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 14,
    shortDescription: "Khóa học giúp người lao động nhận diện mối nguy và làm việc an toàn mỗi ngày.",
    trainingObjectives: "Sau khóa học, học viên nhận diện được các mối nguy phổ biến tại nơi làm việc, sử dụng đúng trang bị bảo hộ và biết cách ứng phó khi xảy ra sự cố.",
    learningOutcomes: ["Nhận diện các loại mối nguy tại nơi làm việc", "Đánh giá mức độ rủi ro của một công việc cụ thể", "Lựa chọn và sử dụng đúng trang bị bảo hộ cá nhân", "Thực hiện các bước sơ cứu cơ bản"],
    submittedAt: new Date("2026-09-12T02:00:00.000Z"),
    publishedAt: new Date("2026-09-15T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "0199a000-0000-7000-8000-1a0000000011", title: "Nhận diện mối nguy", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000011", title: "Các loại mối nguy tại nơi làm việc", content: "## Mối nguy là gì?\n\nMối nguy là bất kỳ yếu tố nào có thể gây tổn hại cho sức khỏe con người.\n\n- Mối nguy vật lý: tiếng ồn, nhiệt độ, điện\n- Mối nguy hóa học: dung môi, bụi\n- Mối nguy cơ học: máy móc đang vận hành", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000111", "fileId": "0199a000-0000-7000-8000-1d0000000111", "type": "Video", "title": "Bài giảng: Các loại mối nguy", "isRequired": true, "amount": 600},
          {"id": "0199a000-0000-7000-8000-1c0000000112", "fileId": "0199a000-0000-7000-8000-1d0000000112", "type": "Reading", "title": "Tài liệu: Bảng phân loại mối nguy", "isRequired": true, "amount": 1200},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000012", title: "Đánh giá rủi ro", content: "## Ba bước đánh giá rủi ro\n\n1. Xác định mối nguy\n2. Ước lượng khả năng xảy ra và mức độ nghiêm trọng\n3. Đề xuất biện pháp kiểm soát", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000121", "fileId": "0199a000-0000-7000-8000-1d0000000121", "type": "Video", "title": "Bài giảng: Ma trận rủi ro", "isRequired": true, "amount": 900},
        ] },
      ] },
      { id: "0199a000-0000-7000-8000-1a0000000012", title: "Phòng ngừa và ứng phó", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000013", title: "Trang bị bảo hộ cá nhân", content: "## Trang bị bảo hộ cá nhân\n\nMũ, kính, găng tay và giày bảo hộ phải **phù hợp với công việc** và được kiểm tra trước mỗi ca.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000131", "fileId": "0199a000-0000-7000-8000-1d0000000131", "type": "Reading", "title": "Tài liệu: Hướng dẫn chọn trang bị bảo hộ", "isRequired": true, "amount": 800},
          {"id": "0199a000-0000-7000-8000-1c0000000132", "fileId": "0199a000-0000-7000-8000-1d0000000132", "type": "Video", "title": "Video minh họa: Đeo găng tay đúng cách", "isRequired": false, "amount": 420},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000014", title: "Xử lý sự cố và sơ cứu", content: "## Khi xảy ra sự cố\n\n1. Bình tĩnh, đảm bảo an toàn cho bản thân\n2. Báo ngay cho người phụ trách\n3. Sơ cứu theo hướng dẫn nếu đã được đào tạo", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000141", "fileId": "0199a000-0000-7000-8000-1d0000000141", "type": "Video", "title": "Bài giảng: Sơ cứu cơ bản", "isRequired": true, "amount": 1080},
          {"id": "0199a000-0000-7000-8000-1c0000000142", "fileId": "0199a000-0000-7000-8000-1d0000000142", "type": "Reading", "title": "Tài liệu: Quy trình báo cáo sự cố", "isRequired": true, "amount": 1500},
          {"id": "0199a000-0000-7000-8000-1c0000000143", "fileId": "0199a000-0000-7000-8000-1d0000000143", "type": "Reading", "title": "Đọc thêm: Các tình huống sơ cứu thường gặp", "isRequired": false, "amount": 2200},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000015", title: "Tài liệu tham khảo thêm", content: "## Tài liệu tham khảo\n\nPhần này dành cho học viên muốn tìm hiểu sâu hơn, không bắt buộc để hoàn thành khóa học.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000151", "fileId": "0199a000-0000-7000-8000-1d0000000151", "type": "Reading", "title": "Đọc thêm: Văn bản pháp luật về an toàn lao động", "isRequired": false, "amount": 2600},
        ] },
      ] },
    ],
  },
  {
    id: COURSE_BAO_MAT,
    organizationId: ORG_A,
    chainId: CHAIN_BAO_MAT,
    versionNumber: 1,
    name: "Bảo mật thông tin",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 7,
    shortDescription: "Những thói quen cơ bản để bảo vệ thông tin của bạn và của công ty.",
    trainingObjectives: "Học viên hiểu vì sao bảo mật thông tin quan trọng, đặt mật khẩu an toàn, bật xác thực hai lớp và nhận diện được email lừa đảo.",
    learningOutcomes: ["Giải thích được hậu quả của việc rò rỉ dữ liệu", "Tạo và quản lý mật khẩu an toàn", "Nhận diện dấu hiệu của email lừa đảo"],
    submittedAt: new Date("2026-08-18T02:00:00.000Z"),
    publishedAt: new Date("2026-08-20T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "0199a000-0000-7000-8000-1a0000000021", title: "Nền tảng bảo mật", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000021", title: "Vì sao bảo mật thông tin quan trọng", content: "## Thông tin là tài sản\n\nMột lần rò rỉ dữ liệu có thể gây thiệt hại về tài chính, uy tín và pháp lý cho cả công ty.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000211", "fileId": "0199a000-0000-7000-8000-1d0000000211", "type": "Video", "title": "Bài giảng: Giá trị của thông tin", "isRequired": true, "amount": 480},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000022", title: "Mật khẩu và xác thực hai lớp", content: "## Mật khẩu an toàn\n\n- Dài ít nhất 12 ký tự\n- Không dùng lại giữa các dịch vụ\n- Luôn bật **xác thực hai lớp** khi có thể", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000221", "fileId": "0199a000-0000-7000-8000-1d0000000221", "type": "Reading", "title": "Tài liệu: Chính sách mật khẩu", "isRequired": true, "amount": 900},
          {"id": "0199a000-0000-7000-8000-1c0000000222", "fileId": "0199a000-0000-7000-8000-1d0000000222", "type": "Video", "title": "Video minh họa: Bật xác thực hai lớp", "isRequired": false, "amount": 360},
        ] },
      ] },
      { id: "0199a000-0000-7000-8000-1a0000000022", title: "Thực hành an toàn hằng ngày", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000023", title: "Nhận diện email lừa đảo", content: "## Dấu hiệu email lừa đảo\n\n1. Địa chỉ người gửi lạ hoặc gần giống địa chỉ thật\n2. Thúc giục hành động gấp\n3. Đường dẫn hoặc tệp đính kèm đáng ngờ", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000231", "fileId": "0199a000-0000-7000-8000-1d0000000231", "type": "Video", "title": "Bài giảng: Phân tích một email lừa đảo", "isRequired": true, "amount": 720},
          {"id": "0199a000-0000-7000-8000-1c0000000232", "fileId": "0199a000-0000-7000-8000-1d0000000232", "type": "Reading", "title": "Tài liệu: Danh sách kiểm tra trước khi bấm đường dẫn", "isRequired": true, "amount": 1100},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000024", title: "Câu chuyện thực tế về rò rỉ dữ liệu", content: "## Bài học từ thực tế\n\nMột số vụ rò rỉ dữ liệu nổi tiếng và điều chúng ta có thể học được.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000241", "fileId": "0199a000-0000-7000-8000-1d0000000241", "type": "Video", "title": "Video tham khảo: Phân tích một vụ rò rỉ dữ liệu", "isRequired": false, "amount": 540},
        ] },
      ] },
    ],
  },
  {
    id: COURSE_QUY_TRINH,
    organizationId: ORG_A,
    chainId: CHAIN_QUY_TRINH,
    versionNumber: 1,
    name: "Quy trình nội bộ",
    courseType: COURSE_TYPE.PRIVATE,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 10,
    shortDescription: "Nắm vững cơ cấu tổ chức và các quy trình làm việc nội bộ của công ty.",
    trainingObjectives: "Nhân viên mới hiểu được cơ cấu tổ chức, quy trình phê duyệt chứng từ và cách báo cáo công việc định kỳ.",
    learningOutcomes: ["Mô tả được cơ cấu tổ chức và trách nhiệm của từng bộ phận", "Thực hiện đúng quy trình phê duyệt chứng từ", "Lập báo cáo công việc định kỳ đúng mẫu", "Tìm và sử dụng đúng biểu mẫu nội bộ"],
    submittedAt: new Date("2026-08-25T02:00:00.000Z"),
    publishedAt: new Date("2026-08-27T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "0199a000-0000-7000-8000-1a0000000031", title: "Tổng quan quy trình", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000031", title: "Sơ đồ tổ chức và trách nhiệm", content: "## Sơ đồ tổ chức\n\nMỗi bộ phận có một người phụ trách. Khi cần hỗ trợ, hãy liên hệ đúng đầu mối theo sơ đồ.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000311", "fileId": "0199a000-0000-7000-8000-1d0000000311", "type": "Reading", "title": "Tài liệu: Sơ đồ tổ chức công ty", "isRequired": true, "amount": 1300},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000032", title: "Quy trình phê duyệt chứng từ", content: "## Các bước phê duyệt\n\n1. Người đề nghị lập chứng từ\n2. Trưởng bộ phận xem xét\n3. Kế toán kiểm tra và lưu trữ", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000321", "fileId": "0199a000-0000-7000-8000-1d0000000321", "type": "Video", "title": "Bài giảng: Luồng phê duyệt chứng từ", "isRequired": true, "amount": 840},
          {"id": "0199a000-0000-7000-8000-1c0000000322", "fileId": "0199a000-0000-7000-8000-1d0000000322", "type": "Reading", "title": "Đọc thêm: Các lỗi thường gặp khi lập chứng từ", "isRequired": false, "amount": 1700},
        ] },
      ] },
      { id: "0199a000-0000-7000-8000-1a0000000032", title: "Áp dụng vào công việc", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000033", title: "Báo cáo công việc định kỳ", content: "## Báo cáo tuần\n\nBáo cáo gửi trước **17 giờ thứ Sáu**, gồm việc đã làm, việc đang làm và khó khăn cần hỗ trợ.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000331", "fileId": "0199a000-0000-7000-8000-1d0000000331", "type": "Video", "title": "Bài giảng: Viết báo cáo tuần hiệu quả", "isRequired": true, "amount": 660},
          {"id": "0199a000-0000-7000-8000-1c0000000332", "fileId": "0199a000-0000-7000-8000-1d0000000332", "type": "Reading", "title": "Tài liệu: Mẫu báo cáo tuần", "isRequired": true, "amount": 950},
          {"id": "0199a000-0000-7000-8000-1c0000000333", "fileId": "0199a000-0000-7000-8000-1d0000000333", "type": "Video", "title": "Video minh họa: Một báo cáo tuần mẫu", "isRequired": false, "amount": 300},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000034", title: "Câu hỏi thường gặp", content: "## Câu hỏi thường gặp\n\nTổng hợp các thắc mắc của nhân viên mới về quy trình nội bộ.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000341", "fileId": "0199a000-0000-7000-8000-1d0000000341", "type": "Reading", "title": "Đọc thêm: Hỏi đáp về quy trình nội bộ", "isRequired": false, "amount": 600},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000035", title: "Biểu mẫu nội bộ", content: "## Biểu mẫu\n\nDanh sách biểu mẫu dùng chung và nơi lưu trữ bản mới nhất.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000351", "fileId": "0199a000-0000-7000-8000-1d0000000351", "type": "Reading", "title": "Tài liệu: Danh mục biểu mẫu nội bộ", "isRequired": true, "amount": 500},
        ] },
      ] },
    ],
  },
  {
    id: COURSE_GIAO_TIEP,
    organizationId: ORG_A,
    chainId: CHAIN_GIAO_TIEP,
    versionNumber: 1,
    name: "Kỹ năng giao tiếp",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.DRAFT,
    expectedCompletionDays: 12,
    shortDescription: null,
    trainingObjectives: null,
    learningOutcomes: [],
    submittedAt: null,
    publishedAt: null,
    archivedAt: null,
    modules: [
    ],
  },
  {
    id: COURSE_NHAP_MON,
    organizationId: ORG_B,
    chainId: CHAIN_NHAP_MON,
    versionNumber: 1,
    name: "Nhập môn sản phẩm",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 5,
    shortDescription: "Làm quen với sản phẩm, khách hàng mục tiêu và các tính năng chính.",
    trainingObjectives: "Nhân viên mới hiểu sản phẩm giải quyết vấn đề gì, phục vụ ai và tự thao tác được các tính năng chính.",
    learningOutcomes: ["Trình bày được giá trị cốt lõi của sản phẩm", "Mô tả được chân dung khách hàng mục tiêu", "Thao tác được các tính năng chính của sản phẩm"],
    submittedAt: new Date("2026-09-01T02:00:00.000Z"),
    publishedAt: new Date("2026-09-03T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "0199a000-0000-7000-8000-1a0000000041", title: "Giới thiệu sản phẩm", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000041", title: "Sản phẩm của chúng ta là gì", content: "## Tổng quan sản phẩm\n\nSản phẩm giúp doanh nghiệp quản lý đào tạo nội bộ một cách tập trung.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000411", "fileId": "0199a000-0000-7000-8000-1d0000000411", "type": "Video", "title": "Bài giảng: Giới thiệu sản phẩm", "isRequired": true, "amount": 750},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000042", title: "Khách hàng mục tiêu", content: "## Khách hàng của chúng ta\n\n- Doanh nghiệp vừa và nhỏ\n- Có nhu cầu đào tạo nhân viên định kỳ", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000421", "fileId": "0199a000-0000-7000-8000-1d0000000421", "type": "Reading", "title": "Tài liệu: Chân dung khách hàng", "isRequired": true, "amount": 1400},
          {"id": "0199a000-0000-7000-8000-1c0000000422", "fileId": "0199a000-0000-7000-8000-1d0000000422", "type": "Video", "title": "Video tham khảo: Phỏng vấn khách hàng", "isRequired": false, "amount": 390},
        ] },
      ] },
      { id: "0199a000-0000-7000-8000-1a0000000042", title: "Sử dụng sản phẩm", lessons: [
        { id: "0199a000-0000-7000-8000-1b0000000043", title: "Các tính năng chính", content: "## Tính năng chính\n\n1. Quản lý khóa học\n2. Phân công đào tạo\n3. Theo dõi tiến độ và báo cáo", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000431", "fileId": "0199a000-0000-7000-8000-1d0000000431", "type": "Video", "title": "Bài giảng: Hướng dẫn sử dụng tính năng chính", "isRequired": true, "amount": 1200},
          {"id": "0199a000-0000-7000-8000-1c0000000432", "fileId": "0199a000-0000-7000-8000-1d0000000432", "type": "Reading", "title": "Tài liệu: Sổ tay sử dụng", "isRequired": true, "amount": 2000},
        ] },
        { id: "0199a000-0000-7000-8000-1b0000000044", title: "Mẹo sử dụng nâng cao", content: "## Mẹo nâng cao\n\nMột số thủ thuật giúp thao tác nhanh hơn, dành cho người đã quen sản phẩm.", materials: [
          {"id": "0199a000-0000-7000-8000-1c0000000441", "fileId": "0199a000-0000-7000-8000-1d0000000441", "type": "Video", "title": "Video tham khảo: Phím tắt và thao tác nhanh", "isRequired": false, "amount": 960},
          {"id": "0199a000-0000-7000-8000-1c0000000442", "fileId": "0199a000-0000-7000-8000-1d0000000442", "type": "Reading", "title": "Đọc thêm: Câu hỏi thường gặp nâng cao", "isRequired": false, "amount": 3000},
        ] },
      ] },
    ],
  },
  {
    id: COURSE_TEST_PUBLIC,
    organizationId: ORG_TEST,
    chainId: CHAIN_TEST_PUBLIC,
    versionNumber: 1,
    name: "Course kiểm thử tích hợp (không dùng cho demo)",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 3,
    shortDescription: "Dữ liệu cố định cho test tích hợp learning-service.",
    trainingObjectives: "Cung cấp một Course Published đủ trường bắt buộc để test tích hợp tự ghi và tự dọn mà không đụng dữ liệu demo.",
    learningOutcomes: ["Không dùng cho demo"],
    submittedAt: new Date("2026-09-20T02:00:00.000Z"),
    publishedAt: new Date("2026-09-22T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "0199a000-0000-7000-8000-1a00000000f1", title: "Module kiểm thử", lessons: [
        { id: "0199a000-0000-7000-8000-1b00000000f1", title: "Lesson kiểm thử", content: "## Lesson kiểm thử\n\nNội dung cố định cho test tích hợp.", materials: [
          {"id": "0199a000-0000-7000-8000-1c00000000f1", "fileId": "0199a000-0000-7000-8000-1d00000000f1", "type": "Video", "title": "Video kiểm thử (bắt buộc)", "isRequired": true, "amount": 300},
          {"id": "0199a000-0000-7000-8000-1c00000000f2", "fileId": "0199a000-0000-7000-8000-1d00000000f2", "type": "Reading", "title": "Reading kiểm thử (không bắt buộc)", "isRequired": false, "amount": 500},
        ] },
      ] },
    ],
  },
  {
    id: COURSE_TEST_PRIVATE,
    organizationId: ORG_TEST,
    chainId: CHAIN_TEST_PRIVATE,
    versionNumber: 1,
    name: "Course Private kiểm thử tích hợp (không dùng cho demo)",
    courseType: COURSE_TYPE.PRIVATE,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 3,
    shortDescription: "Dữ liệu cố định cho test tích hợp learning-service.",
    trainingObjectives: "Cung cấp một Course Published đủ trường bắt buộc để test tích hợp tự ghi và tự dọn mà không đụng dữ liệu demo.",
    learningOutcomes: ["Không dùng cho demo"],
    submittedAt: new Date("2026-09-20T02:00:00.000Z"),
    publishedAt: new Date("2026-09-22T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "0199a000-0000-7000-8000-1a00000000f2", title: "Module kiểm thử", lessons: [
        { id: "0199a000-0000-7000-8000-1b00000000f2", title: "Lesson kiểm thử", content: "## Lesson kiểm thử\n\nNội dung cố định cho test tích hợp.", materials: [
          {"id": "0199a000-0000-7000-8000-1c00000000f3", "fileId": "0199a000-0000-7000-8000-1d00000000f3", "type": "Video", "title": "Video kiểm thử (bắt buộc)", "isRequired": true, "amount": 300},
          {"id": "0199a000-0000-7000-8000-1c00000000f4", "fileId": "0199a000-0000-7000-8000-1d00000000f4", "type": "Reading", "title": "Reading kiểm thử (không bắt buộc)", "isRequired": false, "amount": 500},
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_DRAFT,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_DRAFT,
    versionNumber: 1,
    name: "An toàn lao động tại nhà máy",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.DRAFT,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về an toàn lao động tại nhà máy.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: null,
    publishedAt: null,
    archivedAt: null,
    modules: [
      { id: "33333333-cccc-7333-8333-000000000001", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000001", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
        { id: "33333333-dddd-7333-8333-000000000002", title: "Tình huống thực tế", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
      { id: "33333333-cccc-7333-8333-000000000002", title: "Thực hành và vận dụng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000003", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_PUBLISHED,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_PUBLISHED,
    versionNumber: 1,
    name: "Bảo mật thông tin doanh nghiệp",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về bảo mật thông tin doanh nghiệp.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-09-20T02:00:00.000Z"),
    publishedAt: new Date("2026-09-22T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "33333333-cccc-7333-8333-000000000003", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000004", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_3,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_3,
    versionNumber: 1,
    name: "Chăm sóc khách hàng",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về chăm sóc khách hàng.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-09-10T02:00:00.000Z"),
    publishedAt: new Date("2026-09-12T02:00:00.000Z"),
    archivedAt: null,
    lockedAt: new Date("2026-09-20T02:00:00.000Z"),
    modules: [
      { id: "33333333-cccc-7333-8333-000000000004", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000005", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
        { id: "33333333-dddd-7333-8333-000000000006", title: "Tình huống thực tế", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
      { id: "33333333-cccc-7333-8333-000000000005", title: "Thực hành và vận dụng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000007", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_4,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_4,
    versionNumber: 1,
    name: "Báo cáo sự cố tại nơi làm việc",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.SUBMITTED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về báo cáo sự cố tại nơi làm việc.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-09-30T02:00:00.000Z"),
    publishedAt: null,
    archivedAt: null,
    modules: [
      { id: "33333333-cccc-7333-8333-000000000006", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000008", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
        { id: "33333333-dddd-7333-8333-000000000009", title: "Tình huống thực tế", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_5,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_5,
    versionNumber: 1,
    name: "Kỹ năng làm việc nhóm",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.REJECTED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về kỹ năng làm việc nhóm.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-09-25T02:00:00.000Z"),
    publishedAt: null,
    archivedAt: null,
    rejectedAt: new Date("2026-09-27T02:00:00.000Z"),
    rejectionReason: "Cần bổ sung mục tiêu và hướng dẫn thực hành.",
    modules: [
      { id: "33333333-cccc-7333-8333-000000000007", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000010", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_6,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_6,
    versionNumber: 1,
    name: "Bảo vệ dữ liệu cá nhân",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.ARCHIVED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về bảo vệ dữ liệu cá nhân.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-08-01T02:00:00.000Z"),
    publishedAt: new Date("2026-08-05T02:00:00.000Z"),
    archivedAt: new Date("2026-09-22T02:00:00.000Z"),
    lockedAt: new Date("2026-08-15T02:00:00.000Z"),
    modules: [
      { id: "33333333-cccc-7333-8333-000000000008", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000011", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
        { id: "33333333-dddd-7333-8333-000000000012", title: "Tình huống thực tế", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_7,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_6,
    versionNumber: 2,
    name: "Phòng cháy và thoát hiểm",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về phòng cháy và thoát hiểm.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-09-18T02:00:00.000Z"),
    publishedAt: new Date("2026-09-22T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "33333333-cccc-7333-8333-000000000009", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000013", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
        { id: "33333333-dddd-7333-8333-000000000014", title: "Tình huống thực tế", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
      { id: "33333333-cccc-7333-8333-000000000010", title: "Thực hành và vận dụng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000015", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_8,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_7,
    versionNumber: 1,
    name: "Quy tắc ứng xử nội bộ",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.DISABLED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về quy tắc ứng xử nội bộ.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-07-01T02:00:00.000Z"),
    publishedAt: new Date("2026-07-05T02:00:00.000Z"),
    archivedAt: null,
    lockedAt: new Date("2026-07-20T02:00:00.000Z"),
    disabledAt: new Date("2026-09-29T02:00:00.000Z"),
    disabledReason: "Nội dung vi phạm quy định của tổ chức.",
    modules: [
      { id: "33333333-cccc-7333-8333-000000000011", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000016", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_9,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_8,
    versionNumber: 1,
    name: "Kỹ năng lãnh đạo đội nhóm",
    courseType: COURSE_TYPE.PRIVATE,
    status: COURSE_STATUS.PUBLISHED,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về kỹ năng lãnh đạo đội nhóm.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: new Date("2026-09-15T02:00:00.000Z"),
    publishedAt: new Date("2026-09-17T02:00:00.000Z"),
    archivedAt: null,
    modules: [
      { id: "33333333-cccc-7333-8333-000000000012", title: "Kiến thức nền tảng", lessons: [
        { id: "33333333-dddd-7333-8333-000000000017", title: "Khái niệm và nguyên tắc", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
        { id: "33333333-dddd-7333-8333-000000000018", title: "Tình huống thực tế", content: "Tìm hiểu các nguyên tắc và vận dụng qua tình huống trong công việc.", materials: [
        ] },
      ] },
    ],
  },
  {
    id: COURSE_UI_10,
    organizationId: ORG_UI,
    chainId: CHAIN_UI_9,
    versionNumber: 1,
    name: "Hội nhập nhân viên mới",
    courseType: COURSE_TYPE.PUBLIC,
    status: COURSE_STATUS.DRAFT,
    expectedCompletionDays: 14,
    shortDescription: "Kiến thức và tình huống thực hành về hội nhập nhân viên mới.",
    trainingObjectives: "Giúp học viên vận dụng kiến thức vào công việc hằng ngày.",
    learningOutcomes: ["Nhận diện tình huống thường gặp", "Lựa chọn cách xử lý phù hợp"],
    submittedAt: null,
    publishedAt: null,
    archivedAt: null,
    modules: [
    ],
  },
];

function mediaFileData(organizationId: string, material: SeedMaterial, readyAt: Date) {
  const isVideo = material.type === 'Video';
  return {
    organizationId,
    purpose: isVideo ? 'MaterialVideo' : 'MaterialReading',
    status: 'Ready',
    storageKey: `seed/${material.id}`,
    originalFilename: `${material.id}.${isVideo ? 'mp4' : 'pdf'}`,
    mimeType: isVideo ? 'video/mp4' : 'application/pdf',
    sizeBytes: BigInt(isVideo ? material.amount * 250_000 : material.amount * 60),
    durationSeconds: isVideo ? material.amount : null,
    wordCount: isVideo ? null : material.amount,
    readyAt,
    releasedAt: null,
  };
}


async function seed(prisma: PrismaClient): Promise<void> {
  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.platformSetting.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: { id: PLATFORM_SETTINGS_ID, sourceAsOf: new Date('2026-10-01T00:00:00Z') },
      update: {},
    }),
    ...CHAINS.map((chain) => prisma.courseChain.upsert({
      where: { id: chain.id }, create: chain, update: chain,
    })),
  ];
  for (const { modules, ...course } of COURSES) {
    // BR-83: chạy lại seed không gỡ khóa do learning-service đã gắn.
    operations.push(prisma.course.upsert({
      where: { id: course.id },
      create: { ...course, lockedAt: course.lockedAt ?? null },
      update: course,
    }));
    modules.forEach((module, moduleIndex) => {
      const moduleData = { id: module.id, organizationId: course.organizationId,
        courseId: course.id, title: module.title, position: moduleIndex + 1 };
      operations.push(prisma.courseModule.upsert({
        where: { id: module.id }, create: moduleData, update: moduleData,
      }));
      module.lessons.forEach((lesson, lessonIndex) => {
        const lessonData = { id: lesson.id, organizationId: course.organizationId,
          moduleId: module.id, title: lesson.title, content: lesson.content, position: lessonIndex + 1 };
        operations.push(prisma.lesson.upsert({
          where: { id: lesson.id }, create: lessonData, update: lessonData,
        }));
        lesson.materials.forEach((material, materialIndex) => {
          const fileData = mediaFileData(course.organizationId, material,
            course.publishedAt ?? new Date('2026-10-01T00:00:00Z'));
          operations.push(prisma.mediaFile.upsert({
            where: { id: material.fileId }, create: { id: material.fileId, ...fileData }, update: fileData,
          }));
          const materialData = { id: material.id, organizationId: course.organizationId,
            lessonId: lesson.id, materialType: material.type, title: material.title,
            isRequired: material.isRequired, fileId: material.fileId, position: materialIndex + 1 };
          operations.push(prisma.material.upsert({
            where: { id: material.id }, create: materialData, update: materialData,
          }));
        });
      });
    });
  }
  await prisma.$transaction(operations);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await seed(prisma);
    console.table([{ organizationId: ORG_A, learnerId: LEARNER_1 }, { organizationId: ORG_A, learnerId: LEARNER_2 }, { organizationId: ORG_B, learnerId: LEARNER_3 }]);
    console.table(COURSES.map(({ id, organizationId, name, status, courseType }) =>
      ({ id, organizationId, name, status, courseType })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
