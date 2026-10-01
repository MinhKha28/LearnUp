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
 *     + 4 Learner (An, Bình, Cường, Dũng) để kiểm danh sách không lẫn role khác.
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
  },
];

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

const abcLearners: Array<[number, string, string, Kind]> = [
  [1, 'Nguyễn Văn An', 'an.nguyen@abc.vn', 'A'],
  [2, 'Trần Thị Bình', 'binh.tran@abc.vn', 'A'],
  [3, 'Lê Văn Cường', 'cuong.le@abc.vn', 'A'],
  [4, 'Phạm Văn Dũng', 'dung.pham@abc.vn', 'PN'],
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
for (const [n, fullName, email, kind] of abcLearners) {
  const createdAt = addDays(at('2026-09-03T04:00:00Z'), n - 1);
  users.push(
    buildUser(
      id(`a2${String(n).padStart(2, '0')}`),
      ORG_ABC,
      'Learner',
      fullName,
      email,
      'Phòng Kỹ thuật',
      kind,
      createdAt,
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

    // Token "x4NN" của user "x1NN" / "x2NN" (thay chữ số thứ 2 của phần đuôi bằng 4).
    const suffix = user.id.slice(-4);
    const tokenId = id(`${suffix[0]}4${suffix.slice(2)}`);
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
  plan: {
    price: bigint;
    durationDays: number;
    maxLearners: number;
    maxInstructors: number;
    maxCourseChains: number;
    maxStorageBytes: bigint;
  },
  now: Date,
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
    const expiresAt = addDays(org.subscriptionStartsAt, plan.durationDays);
    check(
      org.subscriptionStartsAt < expiresAt && expiresAt > now,
      `subscription sai: ${org.name}`,
    );
  }

  const orgIds = new Set(organizations.map((org) => org.id));
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
  for (const org of organizations) {
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
  for (const token of tokens) {
    const owner = users.find((u) => u.id === token.userId);
    check(uuid.test(token.id), `UUID token sai: ${token.id}`);
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

  check(
    plan.price > 0n &&
      plan.durationDays > 0 &&
      plan.maxLearners > 0 &&
      plan.maxInstructors > 0 &&
      plan.maxCourseChains > 0 &&
      plan.maxStorageBytes > 0n,
    'gói Standard có giá trị <= 0',
  );

  if (errors.length > 0) {
    throw new Error(
      `Dữ liệu seed vi phạm ràng buộc:\n - ${errors.join('\n - ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { name: STANDARD_PLAN_NAME },
  });
  if (!plan) {
    console.error('Chưa có gói Standard, hãy chạy npm run prisma:seed trước');
    process.exitCode = 1;
    return;
  }
  // BR-278, BR-269: hạn lời mời theo tham số nền tảng (mặc định 7 ngày).
  const settings = await prisma.platformSetting.findFirst();
  const ttlDays = settings?.invitationLinkTtlDays ?? 7;

  const now = new Date();
  const tokens = buildTokens(now, ttlDays);
  validateSeed(tokens, plan, now);

  await prisma.$transaction(async (tx) => {
    for (const org of organizations) {
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
      const data = {
        organizationId: org.id,
        planId: plan.id,
        source: 'Registration',
        status: 'Active',
        // Bản chụp từ gói Standard (BR-275).
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
  console.log(
    `  - Công ty ABC: 1 Organizer, ${count('Instructor', ORG_ABC)} Instructor (2 đã xóa), ${count('Learner', ORG_ABC)} Learner`,
  );
  console.log(
    `  - Công ty TNHH XYZ: 1 Organizer, ${count('Instructor', ORG_XYZ)} Instructor`,
  );
  console.log(
    `  - 1 Admin, ${organizations.length} subscription Active (gói ${plan.name}), ${tokens.length} lời mời`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
