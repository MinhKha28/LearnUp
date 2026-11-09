import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import {
  OrganizationStatus,
  RegistrationStatus,
  SubscriptionStatus,
  TokenPurpose,
  UserRoleValue,
  UserStatus,
} from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const PROFILE_SELECT = {
  id: true,
  name: true,
  taxCode: true,
  address: true,
  contactPhone: true,
  contactEmail: true,
  logoFileKey: true,
  timezone: true,
  status: true,
  updatedAt: true,
} as const;

const CURRENT_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Grace,
  SubscriptionStatus.Suspended,
];

const PLAN_SELECT = { select: { id: true, name: true } } as const;

/** UC44: các cột một dòng danh sách Organization của Admin cần. */
const ADMIN_LIST_SELECT = {
  id: true,
  name: true,
  contactEmail: true,
  status: true,
  createdAt: true,
  // Partial unique index bảo đảm mỗi tổ chức có tối đa một Subscription hiện hành.
  subscriptions: {
    where: { status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
    take: 1,
    select: {
      status: true,
      startsAt: true,
      expiresAt: true,
      graceEndsAt: true,
      plan: PLAN_SELECT,
    },
  },
  // Đăng ký mới nhất: cho gói và hạn thanh toán khi tổ chức chưa có Subscription.
  registrations: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { status: true, expiresAt: true, plan: PLAN_SELECT },
  },
} satisfies Prisma.OrganizationSelect;

export type AdminOrganizationRow = Prisma.OrganizationGetPayload<{
  select: typeof ADMIN_LIST_SELECT;
}>;

// Đăng ký mới nhất, đủ để tính trạng thái hiệu lực như UC44 (BR-7).
const LATEST_REGISTRATION = {
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 1,
  select: { status: true, expiresAt: true, plan: PLAN_SELECT },
} satisfies Prisma.Organization$registrationsArgs;

/** UC44.1: các cột trang chi tiết Organization của Admin cần. */
const ADMIN_DETAIL_SELECT = {
  id: true,
  name: true,
  taxCode: true,
  address: true,
  contactPhone: true,
  contactEmail: true,
  logoFileKey: true,
  timezone: true,
  status: true,
  createdAt: true,
  subscriptions: {
    where: { status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
    take: 1,
    select: {
      status: true,
      startsAt: true,
      expiresAt: true,
      graceEndsAt: true,
      readOnlyEndsAt: true,
      maxLearners: true,
      maxInstructors: true,
      maxCourseChains: true,
      maxStorageBytes: true,
      plan: PLAN_SELECT,
    },
  },
  registrations: LATEST_REGISTRATION,
  // BR-40: Organizer hiện tại = chưa xóa và chưa vô hiệu hóa, gồm cả Pending (chờ nhận lời mời).
  // Partial unique users_one_organizer_per_org_key bảo đảm tối đa một dòng.
  users: {
    where: {
      role: UserRoleValue.Organizer,
      deletedAt: null,
      status: { not: UserStatus.Deactivated },
    },
    take: 1,
    select: {
      id: true,
      fullName: true,
      email: true,
      status: true,
      activatedAt: true,
      // Lời mời đang mở (có thể đã quá hạn); account_tokens_one_open_link_key: tối đa một token.
      accountTokens: {
        where: {
          purpose: TokenPurpose.Invitation,
          consumedAt: null,
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, expiresAt: true },
      },
    },
  },
  // BR-45: lịch sử tạm khóa, mới nhất trước.
  suspensions: {
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, startedAt: true, endedAt: true, reason: true },
  },
} satisfies Prisma.OrganizationSelect;

export type AdminOrganizationDetailRow = Prisma.OrganizationGetPayload<{
  select: typeof ADMIN_DETAIL_SELECT;
}>;

const DUPLICATE_TAX_CODE_SELECT = {
  id: true,
  name: true,
  status: true,
  registrations: LATEST_REGISTRATION,
} satisfies Prisma.OrganizationSelect;

export type DuplicateTaxCodeRow = Prisma.OrganizationGetPayload<{
  select: typeof DUPLICATE_TAX_CODE_SELECT;
}>;

@Injectable()
export class OrganizationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * UC44: một trang Organization, mới nhất trước.
   * Mặc định ẩn Cancelled (BR-7, BR-276), gồm cả tổ chức còn PendingPayment mà đăng ký đã quá hạn
   * nhưng chưa được hủy (BR-7 chỉ chạy khi có request chạm vào đăng ký). Chỉ đọc, không ghi gì.
   */
  async findAdminPage(params: {
    includeCancelled: boolean;
    now: Date;
    skip: number;
    take: number;
  }): Promise<{ rows: AdminOrganizationRow[]; total: number }> {
    const where: Prisma.OrganizationWhereInput = params.includeCancelled
      ? {}
      : {
          OR: [
            {
              status: {
                in: [OrganizationStatus.Active, OrganizationStatus.Suspended],
              },
            },
            {
              status: OrganizationStatus.PendingPayment,
              registrations: {
                some: {
                  status: RegistrationStatus.PendingPayment,
                  expiresAt: { gt: params.now },
                },
              },
            },
          ],
        };
    // count và findMany dùng chung where để total đếm đúng theo bộ lọc.
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        // id là uuid v7 (tăng theo thời gian), thêm vào để thứ tự ổn định khi trùng created_at.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: ADMIN_LIST_SELECT,
      }),
    ]);
    return { rows, total };
  }

  /** UC44.1: một Organization kèm Subscription hiện hành, Organizer hiện tại và lịch sử tạm khóa. Chỉ đọc. */
  findAdminDetail(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: ADMIN_DETAIL_SELECT,
    });
  }

  /**
   * UC44.1 - BR-280: Organization KHÁC cùng mã số thuế (so khớp nguyên văn, gồm cả Cancelled).
   * Trả tổng số và tối đa `take` tổ chức mới nhất.
   */
  async findDuplicateTaxCodes(
    organizationId: string,
    taxCode: string,
    take: number,
  ): Promise<{ rows: DuplicateTaxCodeRow[]; total: number }> {
    const where: Prisma.OrganizationWhereInput = {
      taxCode,
      id: { not: organizationId },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: DUPLICATE_TAX_CODE_SELECT,
      }),
    ]);
    return { rows, total };
  }

  /** BR-36, BR-37: tài khoản chưa xóa của role, mọi trạng thái (giống countSeats của UC15 / UC12.2). */
  countSeats(organizationId: string, role: string) {
    return this.prisma.user.count({
      where: { organizationId, role, deletedAt: null },
    });
  }

  findProfile(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organization.findUnique({
      where: { id: organizationId },
      select: PROFILE_SELECT,
    });
  }

  /** Tên chuẩn của múi giờ theo PostgreSQL, nơi learning-service tra múi giờ; null nếu không có. */
  async findCanonicalTimezone(name: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM pg_timezone_names
      WHERE lower(name) = lower(${name})
        AND name NOT LIKE 'posix/%' AND name NOT LIKE 'right/%'
      LIMIT 1`;
    return rows[0]?.name ?? null;
  }

  /** Khóa dòng tổ chức tới hết transaction, để hai lượt sửa hoặc thay logo chạy lần lượt. */
  async lockOrganization(organizationId: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }

  findCurrentSubscriptionStatus(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [
            SubscriptionStatus.Active,
            SubscriptionStatus.Grace,
            SubscriptionStatus.Suspended,
          ],
        },
      },
      select: { status: true },
    });
  }

  updateProfile(
    organizationId: string,
    data: Prisma.OrganizationUpdateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.organization.update({
      where: { id: organizationId },
      data,
      select: PROFILE_SELECT,
    });
  }
}
