/**
 * Seed dữ liệu phần QUẢN LÝ TÀI KHOẢN (UC12, UC13 và các UC con) – Trọng.
 *
 * Mục đích: có Organization, Organizer, Instructor, Learner, lời mời… để chạy và kiểm UC12
 * (xem danh sách Instructor) khi chưa có màn hình tạo tài khoản. Dựa trên câu chuyện mẫu
 * mục 0.7 của LearnUP_Database_Guide (Công ty ABC, chị Lan, anh Minh, An, Bình, Cường).
 *
 * Cách chạy (từ services/tenant-service):
 *   npm run prisma:seed            # 1. seed nền: platform_settings + gói (có gói "Standard")
 *   npm run prisma:seed:accounts   # 2. file này. Chạy lại nhiều lần được.
 *
 * Nguyên tắc:
 *   - KHÔNG tạo subscription_plans, platform_settings (do prisma/seed.ts lo).
 *     Subscription chép giá, thời hạn, 4 giới hạn từ gói "Standard" (bản chụp, BR-275).
 *   - Upsert theo UUID cố định: chạy lại không tạo trùng. KHÔNG xóa / truncate gì.
 *   - DB chưa có CHECK nên file này tự kiểm mọi ràng buộc của TenantService_Database_Design
 *     trước khi ghi (hàm validateSeed). Sai thì dừng, không ghi gì.
 *   - Token "còn hạn" tính expires_at theo thời điểm chạy seed, nên luôn còn hạn sau mỗi lần chạy.
 *
 * Dữ liệu tạo ra:
 *   - 1 Admin (organization_id = NULL).
 *   - Công ty ABC (Active) + subscription Active + Organizer Lan + 25 Instructor:
 *       15 Active, 5 Pending (2 lời mời còn hạn, 2 lời mời hết hạn, 1 không có token),
 *       3 Deactivated (2 từng kích hoạt, 1 chưa), 2 đã xóa (không được hiện trong danh sách)
 *       -> danh sách UC12 có 23 dòng = 3 trang với pageSize 10 (10, 10, 3).
 *     + 4 Learner (An, Bình, Cường, Dũng) để kiểm danh sách không lẫn role khác
 *       (UC13 bổ sung lên 25 Learner, xem phần "Bổ sung UC13" bên dưới).
 *   - Công ty TNHH XYZ (Active) + subscription Active + Organizer Hoa + 3 Instructor
 *     (để kiểm không xem chéo tổ chức).
 *
 * ID cố định để test (dạng 01900000-0000-7000-8000-00000000XXXX):
 *   Admin                      ...000000000001
 *   Org ABC / Org XYZ          ...00000000a001 / ...00000000b001
 *   Organizer Lan (ABC)        ...00000000a010   <- mặc định của DEV_FAKE_AUTH
 *   Organizer Hoa (XYZ)        ...00000000b010
 *   Instructor ABC             ...00000000a101 – a125 (Minh = a101)
 *   Learner ABC                ...00000000a201 – a204
 *   Instructor XYZ             ...00000000b101 – b103
 *   Pending lời mời hết hạn    a104, a109;  còn hạn: a123, a125;  không token: a117
 *   Đã xóa                     a111, a121
 *
 * Bổ sung UC12.2 (Thêm Instructor):
 *   - Subscription a301 của ABC chuyển sang bản chụp gói "Premium" (30 Instructor)
 *     -> ABC dùng 23/30 chỗ (đếm cả Pending, Deactivated; bỏ đã xóa – BR-36, BR-37), còn 7.
 *   - Công ty CP Gamma: subscription c301 ở Grace (đã hết hạn, đang ân hạn) -> thử chặn BR-15.
 *     expires_at = lúc chạy seed - 2 ngày, grace_ends_at = expires_at + subscription_grace_days
 *     (tính theo LÚC CHẠY SEED nên luôn còn trong thời gian ân hạn).
 *   - Công ty TNHH Delta: subscription d301 Active gói "Basic" (3 Instructor), đã có đủ 3 -> hết chỗ.
 *   ID mới:
 *     Org Gamma / Org Delta       ...00000000c001 / ...00000000d001
 *     Subscription Gamma / Delta  ...00000000c301 / ...00000000d301
 *     Organizer Gamma (Thảo)      ...00000000c010
 *     Organizer Delta (Quân)      ...00000000d010
 *     Instructor Delta            ...00000000d101 – d103
 *
 * Bổ sung UC13 (Xem danh sách Learner):
 *   - ABC có 25 Learner (a201 – a225, giữ nguyên a201 – a204), phân bố giống Instructor:
 *       15 Active, 5 Pending (2 lời mời còn hạn, 2 lời mời hết hạn, 1 không có token = Dũng a204),
 *       3 Deactivated (2 từng kích hoạt, 1 chưa), 2 đã xóa
 *       -> danh sách UC13 có 23 dòng = 3 trang với pageSize 10 (10, 10, 3).
 *     ABC gói Premium (500 Learner) -> dùng 23/500 chỗ Learner (BR-23).
 *   - XYZ có 3 Learner (b201 – b203) để kiểm không xem chéo tổ chức.
 *   - Token lời mời của Learner "x2NN" có ID "x5NN" (Instructor "x1NN" vẫn là "x4NN"),
 *     vì nếu cùng dùng "x4NN" thì a201 và a101 trùng token a401.
 *   - Số khóa đang học / quá hạn KHÔNG nằm ở tenant_db: xem FAKE_SUMMARIES trong
 *     src/integrations/fake-learning-service.client.ts (ID chép tay, phải khớp file này).
 *   ID mới:
 *     Learner ABC                 ...00000000a205 – a225
 *     Learner XYZ                 ...00000000b201 – b203
 *     Pending lời mời hết hạn     a205, a207;  còn hạn: a223, a225, b203
 *     Deactivated                 a209, a217 (từng kích hoạt), a213 (chưa kích hoạt)
 *     Đã xóa                      a211, a220
 *     Token Learner               a505, a507, a523, a525, b503
 *
 * Bổ sung UC13.2 (Thêm Learner):
 *   - Công ty TNHH Delta (gói Basic, max_learners = 30) có đủ 30 Learner Active chưa xóa
 *     -> hết chỗ Learner (remaining 0, canCreate false). Sinh bằng vòng lặp (DELTA_LEARNER_COUNT),
 *     tên "Học viên Delta NN", email hocvien.NN@delta.vn, không có token (đều Active).
 *   - Không đổi FAKE_SUMMARIES: Learner Delta không có trong bảng fake = 0 khóa đang học / 0 quá hạn.
 *   ID mới:
 *     Learner Delta               ...00000000d201 – d230
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { hashToken } from '../src/common/utils/token.util';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const STANDARD_PLAN_NAME = 'Standard';
const PREMIUM_PLAN_NAME = 'Premium'; // UC12.2: gói của ABC
const BASIC_PLAN_NAME = 'Basic'; // UC12.2: gói nhỏ nhất (Delta)
const id = (suffix: string) =>
  `01900000-0000-7000-8000-${suffix.padStart(12, '0')}`;
const at = (iso: string) => new Date(iso);
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

type Role = 'Admin' | 'Organizer' | 'Instructor' | 'Learner';
type Status = 'Pending' | 'Active' | 'Deactivated';

interface SeedOrg {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  createdAt: Date;
  subscriptionId: string;
  subscriptionStartsAt: Date;
  planName: string; // UC12.2: gói để chụp vào subscription
}

// UC12.2: tổ chức thêm cho các ca chặn; ngày subscription tính theo lúc chạy seed.
interface SeedExtraOrg {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  createdAt: Date;
  subscriptionId: string;
  planName: string;
  subscriptionStatus: 'Active' | 'Grace';
}

interface SeedPlan {
  id: string;
  name: string;
  price: bigint;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: bigint;
}

interface SeedUser {
  id: string;
  organizationId: string | null;
  email: string;
  fullName: string;
  role: Role;
  department: string | null;
  status: Status;
  activatedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

interface SeedToken {
  id: string;
  organizationId: string;
  userId: string;
  tokenHash: Uint8Array<ArrayBuffer>;
  createdAt: Date;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Tổ chức
// ---------------------------------------------------------------------------
const ORG_ABC = id('a001');
const ORG_XYZ = id('b001');

const organizations: SeedOrg[] = [
  {
    id: ORG_ABC,
    name: 'Công ty ABC',
    taxCode: '0312345678',
    address: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    contactPhone: '+84901234567',
    contactEmail: 'contact@abc.vn',
    createdAt: at('2026-08-25T02:00:00Z'),
    subscriptionId: id('a301'),
    subscriptionStartsAt: at('2026-08-25T03:00:00Z'),
    planName: PREMIUM_PLAN_NAME, // UC12.2: trước là Standard (10) < 23 Instructor đang có
  },
  {
    id: ORG_XYZ,
    name: 'Công ty TNHH XYZ',
    taxCode: '0109876543001',
    address: '45 Trần Phú, Quận Ba Đình, Hà Nội',
    contactPhone: '+84241234567',
    contactEmail: 'lienhe@xyz.vn',
    createdAt: at('2026-08-28T02:00:00Z'),
    subscriptionId: id('b301'),
    subscriptionStartsAt: at('2026-08-28T03:00:00Z'),
    planName: STANDARD_PLAN_NAME,
  },
];

const ORG_GAMMA = id('c001');
const ORG_DELTA = id('d001');

const extraOrganizations: SeedExtraOrg[] = [
  {
    id: ORG_GAMMA,
    name: 'Công ty CP Gamma',
    taxCode: '0301112223',
    address: '78 Lê Lợi, Quận Hải Châu, Đà Nẵng',
    contactPhone: '+842363123456',
    contactEmail: 'contact@gamma.vn',
    createdAt: at('2025-09-20T02:00:00Z'),
    subscriptionId: id('c301'),
    planName: STANDARD_PLAN_NAME,
    subscriptionStatus: 'Grace',
  },
  {
    id: ORG_DELTA,
    name: 'Công ty TNHH Delta',
    taxCode: '0401234567',
    address: '12 Hùng Vương, Quận Ninh Kiều, Cần Thơ',
    contactPhone: '+842923123456',
    contactEmail: 'lienhe@delta.vn',
    createdAt: at('2026-09-20T02:00:00Z'),
    subscriptionId: id('d301'),
    planName: BASIC_PLAN_NAME,
    subscriptionStatus: 'Active',
  },
];

/** Ngày của subscription tổ chức thêm, tính theo lúc chạy seed. */
function extraSubscriptionDates(
  org: SeedExtraOrg,
  plan: SeedPlan,
  now: Date,
  graceDays: number,
): { startsAt: Date; expiresAt: Date; graceEndsAt: Date | null } {
  if (org.subscriptionStatus === 'Grace') {
    // Hết hạn 2 ngày trước, còn (graceDays - 2) ngày ân hạn.
    const expiresAt = addDays(now, -2);
    return {
      startsAt: addDays(expiresAt, -plan.durationDays),
      expiresAt,
      graceEndsAt: addDays(expiresAt, graceDays),
    };
  }
  const startsAt = addDays(now, -5);
  return {
    startsAt,
    expiresAt: addDays(startsAt, plan.durationDays),
    graceEndsAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tài khoản
// ---------------------------------------------------------------------------
const users: SeedUser[] = [
  {
    id: id('1'),
    organizationId: null,
    email: 'admin@learnup.vn',
    fullName: 'Quản trị viên LearnUP',
    role: 'Admin',
    department: null,
    status: 'Active',
    activatedAt: at('2026-08-01T02:00:00Z'),
    deletedAt: null,
    createdAt: at('2026-08-01T01:00:00Z'),
  },
  {
    id: id('a010'),
    organizationId: ORG_ABC,
    email: 'lan.nguyen@abc.vn',
    fullName: 'Nguyễn Thị Lan',
    role: 'Organizer',
    department: null,
    status: 'Active',
    activatedAt: at('2026-08-25T03:00:00Z'),
    deletedAt: null,
    createdAt: at('2026-08-25T02:00:00Z'),
  },
  {
    id: id('b010'),
    organizationId: ORG_XYZ,
    email: 'hoa.hoang@xyz.vn',
    fullName: 'Hoàng Thị Hoa',
    role: 'Organizer',
    department: null,
    status: 'Active',
    activatedAt: at('2026-08-28T03:00:00Z'),
    deletedAt: null,
    createdAt: at('2026-08-28T02:00:00Z'),
  },
  // UC12.2
  {
    id: id('c010'),
    organizationId: ORG_GAMMA,
    email: 'thao.truong@gamma.vn',
    fullName: 'Trương Thị Thảo',
    role: 'Organizer',
    department: null,
    status: 'Active',
    activatedAt: at('2025-09-20T03:00:00Z'),
    deletedAt: null,
    createdAt: at('2025-09-20T02:00:00Z'),
  },
  {
    id: id('d010'),
    organizationId: ORG_DELTA,
    email: 'quan.vo@delta.vn',
    fullName: 'Võ Minh Quân',
    role: 'Organizer',
    department: null,
    status: 'Active',
    activatedAt: at('2026-09-20T03:00:00Z'),
    deletedAt: null,
    createdAt: at('2026-09-20T02:00:00Z'),
  },
];

// 25 Instructor của ABC. created_at: 01/09 + (n-1) ngày, nên a125 mới nhất.
// kind: A = Active, PV = Pending lời mời còn hạn, PE = Pending lời mời hết hạn,
//       PN = Pending không token, DA = Deactivated từng kích hoạt, DN = Deactivated chưa kích hoạt,
//       X = đã xóa.
type Kind = 'A' | 'PV' | 'PE' | 'PN' | 'DA' | 'DN' | 'X';
const abcInstructors: Array<[number, string, string, string | null, Kind]> = [
  [1, 'Trần Văn Minh', 'minh.tran@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [2, 'Nguyễn Thị Hương', 'huong.nguyen@abc.vn', 'Phòng Nhân sự', 'A'],
  [3, 'Lê Hoàng Nam', 'nam.le@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [4, 'Phạm Thị Mai', 'mai.pham@abc.vn', null, 'PE'],
  [5, 'Võ Thị Thu Hà', 'ha.vo@abc.vn', 'Phòng An toàn lao động', 'A'],
  [6, 'Đặng Quốc Bảo', 'bao.dang@abc.vn', 'Phòng Kinh doanh', 'DA'],
  [7, 'Bùi Thị Lan Anh', 'lananh.bui@abc.vn', 'Phòng Kế toán', 'A'],
  [8, 'Hoàng Minh Tuấn', 'tuan.hoang@abc.vn', null, 'A'],
  [9, 'Ngô Thị Ngọc', 'ngoc.ngo@abc.vn', 'Phòng Nhân sự', 'PE'],
  [10, 'Dương Văn Hải', 'hai.duong@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [11, 'Lý Thị Phương', 'phuong.ly@abc.vn', 'Phòng Pháp chế', 'X'],
  [12, 'Trịnh Văn Đức', 'duc.trinh@abc.vn', 'Phòng Sản xuất', 'A'],
  [13, 'Phan Thị Hồng', 'hong.phan@abc.vn', null, 'DN'],
  [14, 'Đinh Văn Long', 'long.dinh@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [15, 'Mai Thị Thanh', 'thanh.mai@abc.vn', 'Phòng Chất lượng', 'A'],
  [16, 'Cao Văn Thắng', 'thang.cao@abc.vn', 'Phòng Kinh doanh', 'A'],
  [17, 'Tô Thị Bích', 'bich.to@abc.vn', null, 'PN'],
  [18, 'Hà Văn Quang', 'quang.ha@abc.vn', 'Phòng An toàn lao động', 'A'],
  [19, 'Lương Thị Yến', 'yen.luong@abc.vn', 'Phòng Kế toán', 'DA'],
  [20, 'Vũ Đức Anh', 'anh.vu@abc.vn', 'Phòng Sản xuất', 'A'],
  [21, 'Đỗ Thị Kim', 'kim.do@abc.vn', 'Phòng Nhân sự', 'X'],
  [22, 'Kiều Văn Hùng', 'hung.kieu@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [23, 'Châu Thị Diễm', 'diem.chau@abc.vn', null, 'PV'],
  [24, 'Tạ Quang Vinh', 'vinh.ta@abc.vn', 'Phòng Chất lượng', 'A'],
  [25, 'La Thị Nhung', 'nhung.la@abc.vn', 'Phòng Kinh doanh', 'PV'],
];

const xyzInstructors: Array<[number, string, string, string | null, Kind]> = [
  [1, 'Hồ Văn Khoa', 'khoa.ho@xyz.vn', 'Phòng Đào tạo', 'A'],
  [2, 'Lâm Thị Tuyết', 'tuyet.lam@xyz.vn', null, 'A'],
  [3, 'Quách Minh Trí', 'tri.quach@xyz.vn', 'Phòng Kỹ thuật', 'PV'],
];

// UC13: 25 Learner của ABC (a201 – a204 giữ nguyên). created_at: 03/09 + (n-1) ngày, nên a225 mới nhất.
// Lời mời hết hạn (PE) đặt ở đầu danh sách: token phát ngày cố định (created_at + 1 giờ) nên đã hết hạn.
const abcLearners: Array<[number, string, string, string | null, Kind]> = [
  [1, 'Nguyễn Văn An', 'an.nguyen@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [2, 'Trần Thị Bình', 'binh.tran@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [3, 'Lê Văn Cường', 'cuong.le@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [4, 'Phạm Văn Dũng', 'dung.pham@abc.vn', 'Phòng Kỹ thuật', 'PN'],
  [5, 'Hoàng Thị Ánh', 'anh.hoang@abc.vn', 'Phòng Kinh doanh', 'PE'],
  [6, 'Ngô Văn Bảo', 'bao.ngo@abc.vn', 'Phòng Sản xuất', 'A'],
  [7, 'Lê Thị Cẩm Tú', 'tu.le@abc.vn', null, 'PE'],
  [8, 'Vũ Văn Định', 'dinh.vu@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [9, 'Phan Thị Giang', 'giang.phan@abc.vn', 'Phòng Kế toán', 'DA'],
  [10, 'Trịnh Minh Hiếu', 'hieu.trinh@abc.vn', 'Phòng Sản xuất', 'A'],
  [11, 'Đoàn Thị Hoài', 'hoai.doan@abc.vn', 'Phòng Nhân sự', 'X'],
  [12, 'Bùi Văn Khải', 'khai.bui@abc.vn', 'Phòng Kinh doanh', 'A'],
  [13, 'Lâm Thị Kiều', 'kieu.lam@abc.vn', null, 'DN'],
  [14, 'Nguyễn Hữu Lộc', 'loc.nguyen@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [15, 'Trần Thị Mỹ', 'my.tran@abc.vn', 'Phòng Chất lượng', 'A'],
  [16, 'Huỳnh Văn Nghĩa', 'nghia.huynh@abc.vn', 'Phòng An toàn lao động', 'A'],
  [17, 'Đặng Thị Oanh', 'oanh.dang@abc.vn', 'Phòng Kế toán', 'DA'],
  [18, 'Cao Minh Phúc', 'phuc.cao@abc.vn', 'Phòng Sản xuất', 'A'],
  [19, 'Tăng Thị Quyên', 'quyen.tang@abc.vn', 'Phòng Nhân sự', 'A'],
  [20, 'Lưu Văn Sơn', 'son.luu@abc.vn', 'Phòng Kinh doanh', 'X'],
  [21, 'Mạc Thị Tâm', 'tam.mac@abc.vn', 'Phòng Chất lượng', 'A'],
  [22, 'Hồ Văn Thịnh', 'thinh.ho@abc.vn', 'Phòng Kỹ thuật', 'A'],
  [23, 'Văn Thị Uyên', 'uyen.van@abc.vn', null, 'PV'],
  [24, 'Đỗ Quốc Vương', 'vuong.do@abc.vn', 'Phòng Sản xuất', 'A'],
  [25, 'Từ Thị Xuân', 'xuan.tu@abc.vn', 'Phòng Kinh doanh', 'PV'],
];

// UC13: Learner của XYZ, để kiểm Organizer ABC không thấy.
const xyzLearners: Array<[number, string, string, string | null, Kind]> = [
  [1, 'Phùng Văn Hậu', 'hau.phung@xyz.vn', 'Phòng Kỹ thuật', 'A'],
  [2, 'Nghiêm Thị Thu', 'thu.nghiem@xyz.vn', 'Phòng Kinh doanh', 'A'],
  [3, 'Thái Văn Tài', 'tai.thai@xyz.vn', null, 'PV'],
];

const tokenKinds = new Map<string, Kind>();

function buildUser(
  userId: string,
  organizationId: string,
  role: Role,
  fullName: string,
  email: string,
  department: string | null,
  kind: Kind,
  createdAt: Date,
): SeedUser {
  const activated = kind === 'A' || kind === 'DA' || kind === 'X';
  const status: Status =
    kind === 'DA' || kind === 'DN'
      ? 'Deactivated'
      : kind === 'A' || kind === 'X'
        ? 'Active'
        : 'Pending';
  tokenKinds.set(userId, kind);
  return {
    id: userId,
    organizationId,
    email,
    fullName,
    role,
    department,
    status,
    activatedAt: activated ? addDays(createdAt, 1) : null,
    deletedAt: kind === 'X' ? at('2026-09-28T03:00:00Z') : null,
    createdAt,
  };
}

for (const [n, fullName, email, department, kind] of abcInstructors) {
  const createdAt = addDays(at('2026-09-01T02:00:00Z'), n - 1);
  users.push(
    buildUser(
      id(`a1${String(n).padStart(2, '0')}`),
      ORG_ABC,
      'Instructor',
      fullName,
      email,
      department,
      kind,
      createdAt,
    ),
  );
}
for (const [n, fullName, email, department, kind] of xyzInstructors) {
  const createdAt = addDays(at('2026-09-02T02:00:00Z'), (n - 1) * 3);
  users.push(
    buildUser(
      id(`b1${String(n).padStart(2, '0')}`),
      ORG_XYZ,
      'Instructor',
      fullName,
      email,
      department,
      kind,
      createdAt,
    ),
  );
}
for (const [n, fullName, email, department, kind] of abcLearners) {
  const createdAt = addDays(at('2026-09-03T04:00:00Z'), n - 1);
  users.push(
    buildUser(
      id(`a2${String(n).padStart(2, '0')}`),
      ORG_ABC,
      'Learner',
      fullName,
      email,
      department,
      kind,
      createdAt,
    ),
  );
}
for (const [n, fullName, email, department, kind] of xyzLearners) {
  const createdAt = addDays(at('2026-09-04T04:00:00Z'), (n - 1) * 3);
  users.push(
    buildUser(
      id(`b2${String(n).padStart(2, '0')}`),
      ORG_XYZ,
      'Learner',
      fullName,
      email,
      department,
      kind,
      createdAt,
    ),
  );
}

// UC12.2: Delta có đúng max_instructors của gói Basic (3) Instructor chưa xóa -> hết chỗ.
const deltaInstructors: Array<[number, string, string, string | null, Kind]> = [
  [1, 'Lê Thị Hạnh', 'hanh.le@delta.vn', 'Phòng Đào tạo', 'A'],
  [2, 'Trần Quốc Việt', 'viet.tran@delta.vn', 'Phòng Kỹ thuật', 'A'],
  [3, 'Phạm Ngọc Ánh', 'anh.pham@delta.vn', null, 'A'],
];
for (const [n, fullName, email, department, kind] of deltaInstructors) {
  const createdAt = addDays(at('2026-09-21T02:00:00Z'), n - 1);
  users.push(
    buildUser(
      id(`d1${String(n).padStart(2, '0')}`),
      ORG_DELTA,
      'Instructor',
      fullName,
      email,
      department,
      kind,
      createdAt,
    ),
  );
}

// UC13.2: Delta có đúng max_learners của gói Basic (30) Learner chưa xóa -> hết chỗ Learner.
// Sinh bằng vòng lặp: d201 – d230, "Học viên Delta NN" / hocvien.NN@delta.vn, đều Active.
// created_at: 22/09 04:00 + (n-1) giờ, nên d230 mới nhất.
const DELTA_LEARNER_COUNT = 30;
const DELTA_DEPARTMENTS = [
  'Phòng Kỹ thuật',
  'Phòng Kinh doanh',
  'Phòng Sản xuất',
  'Phòng Kế toán',
  'Phòng Nhân sự',
];
for (let n = 1; n <= DELTA_LEARNER_COUNT; n++) {
  const nn = String(n).padStart(2, '0');
  users.push(
    buildUser(
      id(`d2${nn}`),
      ORG_DELTA,
      'Learner',
      `Học viên Delta ${nn}`,
      `hocvien.${nn}@delta.vn`,
      DELTA_DEPARTMENTS[(n - 1) % DELTA_DEPARTMENTS.length],
      'A',
      new Date(at('2026-09-22T04:00:00Z').getTime() + (n - 1) * HOUR_MS),
    ),
  );
}

// ---------------------------------------------------------------------------
// Lời mời (account_tokens, purpose = Invitation)
// ---------------------------------------------------------------------------
function buildTokens(now: Date, ttlDays: number): SeedToken[] {
  const tokens: SeedToken[] = [];
  for (const user of users) {
    const kind = tokenKinds.get(user.id);
    if (!user.organizationId || (kind !== 'PV' && kind !== 'PE')) continue;

    // Thay chữ số thứ 2 của phần đuôi: Instructor "x1NN" -> token "x4NN", Learner "x2NN" -> "x5NN"
    // (UC13: Learner không dùng 4 được vì a201 và a101 sẽ cùng ra a401).
    const suffix = user.id.slice(-4);
    const tokenDigit = user.role === 'Learner' ? '5' : '4';
    const tokenId = id(`${suffix[0]}${tokenDigit}${suffix.slice(2)}`);
    // Mã băm cố định của một chuỗi cố định (SHA-256 = 32 byte). Chuỗi gốc chỉ để seed, không gửi email.
    const tokenHash = hashToken(`learnup-seed-invitation-${user.id}`);
    // PV: phát 1 ngày trước lúc chạy seed -> còn hạn. PE: phát ngay sau khi tạo tài khoản -> đã hết hạn.
    const createdAt =
      kind === 'PV'
        ? new Date(now.getTime() - DAY_MS)
        : new Date(user.createdAt.getTime() + HOUR_MS);
    tokens.push({
      id: tokenId,
      organizationId: user.organizationId,
      userId: user.id,
      tokenHash,
      createdAt,
      expiresAt: addDays(createdAt, ttlDays),
    });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Kiểm ràng buộc thiết kế (DB chưa có CHECK)
// ---------------------------------------------------------------------------
function validateSeed(
  tokens: SeedToken[],
  plans: Map<string, SeedPlan>,
  now: Date,
  graceDays: number,
): void {
  const errors: string[] = [];
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };

  for (const org of organizations) {
    check(
      uuid.test(org.id) && uuid.test(org.subscriptionId),
      `UUID sai: ${org.id}`,
    );
    check(
      /^[0-9]{10}([0-9]{3})?$/.test(org.taxCode),
      `tax_code sai: ${org.name}`,
    );
    check(
      /^\+[1-9][0-9]{1,14}$/.test(org.contactPhone),
      `contact_phone sai: ${org.name}`,
    );
    check(
      org.contactEmail === org.contactEmail.trim().toLowerCase(),
      `contact_email chưa chuẩn hóa: ${org.name}`,
    );
    check(
      org.name.length <= 200 && org.address.length <= 300,
      `độ dài sai: ${org.name}`,
    );
    const plan = plans.get(org.planName)!;
    const expiresAt = addDays(org.subscriptionStartsAt, plan.durationDays);
    check(
      org.subscriptionStartsAt < expiresAt && expiresAt > now,
      `subscription sai: ${org.name}`,
    );
  }

  // UC12.2: tổ chức thêm (Gamma ở Grace, Delta Active).
  for (const org of extraOrganizations) {
    check(
      uuid.test(org.id) && uuid.test(org.subscriptionId),
      `UUID sai: ${org.id}`,
    );
    check(
      /^[0-9]{10}([0-9]{3})?$/.test(org.taxCode),
      `tax_code sai: ${org.name}`,
    );
    check(
      /^\+[1-9][0-9]{1,14}$/.test(org.contactPhone),
      `contact_phone sai: ${org.name}`,
    );
    check(
      org.contactEmail === org.contactEmail.trim().toLowerCase(),
      `contact_email chưa chuẩn hóa: ${org.name}`,
    );
    check(
      org.name.length <= 200 && org.address.length <= 300,
      `độ dài sai: ${org.name}`,
    );
    const plan = plans.get(org.planName)!;
    const dates = extraSubscriptionDates(org, plan, now, graceDays);
    check(dates.startsAt < dates.expiresAt, `subscription sai: ${org.name}`);
    if (org.subscriptionStatus === 'Grace') {
      // Đã hết hạn nhưng còn trong thời gian ân hạn.
      check(
        dates.expiresAt <= now &&
          dates.graceEndsAt !== null &&
          dates.graceEndsAt > now,
        `subscription Grace sai: ${org.name}`,
      );
    } else {
      check(dates.expiresAt > now, `subscription Active sai: ${org.name}`);
    }
  }
  // Delta phải hết chỗ Instructor đúng bằng max_instructors của gói.
  const deltaPlan = plans.get(
    extraOrganizations.find((org) => org.id === ORG_DELTA)!.planName,
  )!;
  const deltaUsed = users.filter(
    (u) =>
      u.organizationId === ORG_DELTA && u.role === 'Instructor' && !u.deletedAt,
  ).length;
  check(
    deltaUsed === deltaPlan.maxInstructors,
    `Delta phải có đúng ${deltaPlan.maxInstructors} Instructor chưa xóa, đang có ${deltaUsed}`,
  );
  // UC13.2: Delta phải hết chỗ Learner đúng bằng max_learners của gói.
  const deltaLearnersUsed = users.filter(
    (u) =>
      u.organizationId === ORG_DELTA && u.role === 'Learner' && !u.deletedAt,
  ).length;
  check(
    deltaLearnersUsed === deltaPlan.maxLearners,
    `Delta phải có đúng ${deltaPlan.maxLearners} Learner chưa xóa, đang có ${deltaLearnersUsed}`,
  );

  // BR-23: số Instructor chưa xóa không vượt bản chụp giới hạn của gói.
  for (const org of organizations) {
    const used = users.filter(
      (u) =>
        u.organizationId === org.id && u.role === 'Instructor' && !u.deletedAt,
    ).length;
    const max = plans.get(org.planName)!.maxInstructors;
    check(
      used <= max,
      `${org.name} có ${used} Instructor, vượt giới hạn ${max} của gói ${org.planName}`,
    );
  }

  const allOrganizations = [...organizations, ...extraOrganizations];

  // UC13 - BR-23: số Learner chưa xóa (mọi trạng thái, BR-36) không vượt max_learners của gói.
  for (const org of allOrganizations) {
    const used = users.filter(
      (u) =>
        u.organizationId === org.id && u.role === 'Learner' && !u.deletedAt,
    ).length;
    const max = plans.get(org.planName)!.maxLearners;
    check(
      used <= max,
      `${org.name} có ${used} Learner, vượt giới hạn ${max} của gói ${org.planName}`,
    );
  }

  const orgIds = new Set(allOrganizations.map((org) => org.id));
  const activeEmails = new Set<string>();
  for (const user of users) {
    check(uuid.test(user.id), `UUID sai: ${user.id}`);
    check(
      user.email === user.email.trim().toLowerCase() &&
        user.email.length <= 254,
      `email chưa chuẩn hóa: ${user.email}`,
    );
    check(
      user.fullName.length <= 100 && (user.department ?? '').length <= 100,
      `độ dài sai: ${user.email}`,
    );
    check(
      (user.role === 'Admin') === (user.organizationId === null),
      `Admin <=> organization_id NULL sai: ${user.email}`,
    );
    check(
      user.organizationId === null || orgIds.has(user.organizationId),
      `organization_id lạ: ${user.email}`,
    );
    check(
      user.status !== 'Pending' || user.activatedAt === null,
      `Pending phải có activated_at NULL: ${user.email}`,
    );
    check(
      user.status !== 'Active' || user.activatedAt !== null,
      `Active phải có activated_at: ${user.email}`,
    );
    if (!user.deletedAt) {
      // BR-30, BR-31: email duy nhất trong các tài khoản chưa xóa.
      check(!activeEmails.has(user.email), `email trùng: ${user.email}`);
      activeEmails.add(user.email);
    }
  }

  // BR-40: mỗi tổ chức đúng 1 Organizer chưa xóa, chưa vô hiệu hóa.
  for (const org of allOrganizations) {
    const organizers = users.filter(
      (u) =>
        u.organizationId === org.id &&
        u.role === 'Organizer' &&
        !u.deletedAt &&
        u.status !== 'Deactivated',
    );
    check(
      organizers.length === 1,
      `tổ chức ${org.name} phải có đúng 1 Organizer`,
    );
  }

  const openTokens = new Set<string>();
  const tokenIds = new Set<string>();
  for (const token of tokens) {
    const owner = users.find((u) => u.id === token.userId);
    check(uuid.test(token.id), `UUID token sai: ${token.id}`);
    // UC13: ID token suy ra từ ID user, trùng là ghi đè lời mời của người khác.
    check(!tokenIds.has(token.id), `ID token trùng: ${token.id}`);
    tokenIds.add(token.id);
    check(
      token.tokenHash.length === 32,
      `token_hash phải 32 byte: ${token.id}`,
    );
    check(
      token.expiresAt > token.createdAt,
      `expires_at phải > created_at: ${token.id}`,
    );
    check(
      owner?.organizationId === token.organizationId,
      `token khác tổ chức với user: ${token.id}`,
    );
    const key = `${token.userId}|Invitation`;
    check(!openTokens.has(key), `quá 1 token còn hiệu lực: ${key}`);
    openTokens.add(key);
  }

  for (const plan of plans.values()) {
    check(
      plan.price > 0n &&
        plan.durationDays > 0 &&
        plan.maxLearners > 0 &&
        plan.maxInstructors > 0 &&
        plan.maxCourseChains > 0 &&
        plan.maxStorageBytes > 0n,
      `gói ${plan.name} có giá trị <= 0`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Dữ liệu seed vi phạm ràng buộc:\n - ${errors.join('\n - ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // UC12.2: cần 3 gói của seed nền (ABC Premium, XYZ / Gamma Standard, Delta Basic).
  const plans = new Map<string, SeedPlan>();
  for (const name of [STANDARD_PLAN_NAME, PREMIUM_PLAN_NAME, BASIC_PLAN_NAME]) {
    const found = await prisma.subscriptionPlan.findFirst({ where: { name } });
    if (!found) {
      console.error(`Chưa có gói ${name}, hãy chạy npm run prisma:seed trước`);
      process.exitCode = 1;
      return;
    }
    plans.set(name, found);
  }
  // BR-278, BR-269: hạn lời mời theo tham số nền tảng (mặc định 7 ngày).
  const settings = await prisma.platformSetting.findFirst();
  const ttlDays = settings?.invitationLinkTtlDays ?? 7;
  // BR-15: thời gian ân hạn (UC12.2, subscription Grace của Gamma).
  const graceDays = settings?.subscriptionGraceDays ?? 7;

  const now = new Date();
  const tokens = buildTokens(now, ttlDays);
  validateSeed(tokens, plans, now, graceDays);

  await prisma.$transaction(async (tx) => {
    // UC12.2: ghi cả tổ chức thêm ở đây (trước users vì khóa ngoại).
    for (const org of [...organizations, ...extraOrganizations]) {
      const data = {
        name: org.name,
        taxCode: org.taxCode,
        address: org.address,
        contactPhone: org.contactPhone,
        contactEmail: org.contactEmail,
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'Active',
        createdAt: org.createdAt,
      };
      await tx.organization.upsert({
        where: { id: org.id },
        create: { id: org.id, ...data },
        update: data,
      });
    }

    for (const user of users) {
      const { id: userId, ...data } = user;
      await tx.user.upsert({
        where: { id: userId },
        create: user,
        update: data,
      });
    }

    for (const org of organizations) {
      const plan = plans.get(org.planName)!;
      const data = {
        organizationId: org.id,
        planId: plan.id,
        source: 'Registration',
        status: 'Active',
        // Bản chụp từ gói của tổ chức (BR-275).
        price: plan.price,
        durationDays: plan.durationDays,
        maxLearners: plan.maxLearners,
        maxInstructors: plan.maxInstructors,
        maxCourseChains: plan.maxCourseChains,
        maxStorageBytes: plan.maxStorageBytes,
        startsAt: org.subscriptionStartsAt,
        expiresAt: addDays(org.subscriptionStartsAt, plan.durationDays),
        createdAt: org.subscriptionStartsAt,
      };
      await tx.subscription.upsert({
        where: { id: org.subscriptionId },
        create: { id: org.subscriptionId, ...data },
        update: data,
      });
    }

    // UC12.2: subscription của Gamma (Grace) và Delta (Active, gói Basic).
    for (const org of extraOrganizations) {
      const plan = plans.get(org.planName)!;
      const dates = extraSubscriptionDates(org, plan, now, graceDays);
      const data = {
        organizationId: org.id,
        planId: plan.id,
        source: 'Registration',
        status: org.subscriptionStatus,
        price: plan.price,
        durationDays: plan.durationDays,
        maxLearners: plan.maxLearners,
        maxInstructors: plan.maxInstructors,
        maxCourseChains: plan.maxCourseChains,
        maxStorageBytes: plan.maxStorageBytes,
        startsAt: dates.startsAt,
        expiresAt: dates.expiresAt,
        graceEndsAt: dates.graceEndsAt,
        createdAt: dates.startsAt,
      };
      await tx.subscription.upsert({
        where: { id: org.subscriptionId },
        create: { id: org.subscriptionId, ...data },
        update: data,
      });
    }

    for (const token of tokens) {
      const data = {
        organizationId: token.organizationId,
        userId: token.userId,
        purpose: 'Invitation',
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        consumedAt: null,
        revokedAt: null,
        createdAt: token.createdAt,
      };
      await tx.accountToken.upsert({
        where: { id: token.id },
        create: { id: token.id, ...data },
        update: data,
      });
    }
  });

  const count = (role: Role, organizationId: string) =>
    users.filter((u) => u.role === role && u.organizationId === organizationId)
      .length;
  console.log('Đã seed dữ liệu quản lý tài khoản:');
  // UC13: số tài khoản chưa xóa (= số dòng danh sách, = số chỗ đã dùng).
  const countNotDeleted = (role: Role, organizationId: string) =>
    users.filter(
      (u) =>
        u.role === role && u.organizationId === organizationId && !u.deletedAt,
    ).length;
  console.log(
    `  - Công ty ABC: 1 Organizer, ${count('Instructor', ORG_ABC)} Instructor (2 đã xóa), ${count('Learner', ORG_ABC)} Learner (${countNotDeleted('Learner', ORG_ABC)} chưa xóa / ${plans.get(PREMIUM_PLAN_NAME)!.maxLearners} chỗ)`,
  );
  console.log(
    `  - Công ty TNHH XYZ: 1 Organizer, ${count('Instructor', ORG_XYZ)} Instructor, ${count('Learner', ORG_XYZ)} Learner`,
  );
  console.log(
    `  - 1 Admin, ${organizations.length} subscription Active (ABC gói ${PREMIUM_PLAN_NAME}, XYZ gói ${STANDARD_PLAN_NAME}), ${tokens.length} lời mời`,
  );
  console.log(
    `  - UC12.2: Công ty CP Gamma (subscription Grace), Công ty TNHH Delta (gói ${BASIC_PLAN_NAME}, ${count('Instructor', ORG_DELTA)}/${plans.get(BASIC_PLAN_NAME)!.maxInstructors} Instructor)`,
  );
  console.log(
    `  - UC13.2: Công ty TNHH Delta ${countNotDeleted('Learner', ORG_DELTA)}/${plans.get(BASIC_PLAN_NAME)!.maxLearners} Learner (hết chỗ Learner)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
