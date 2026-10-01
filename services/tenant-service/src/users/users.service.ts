import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser, PageResponse } from '@learnup/ts-common';
import { STANDARD_ERROR_CODES, createPageResponse } from '@learnup/ts-common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseServiceClient } from '../integrations/course-service.client';
import {
  LearnerEnrollmentSummary,
  LearningServiceClient,
} from '../integrations/learning-service.client';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  DAY_MS,
  OrganizationStatus,
  SubscriptionStatus,
  TokenPurpose,
  UserRoleValue,
  UserStatus,
} from '../common/constants/tenant.constants';
import { generateSecretToken } from '../common/utils/token.util';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import {
  AccountListItem,
  InstructorListItem,
  LearnerListItem,
} from './interfaces/account-list-item.interface';
import { SeatUsage } from './interfaces/seat-usage.interface';

// Role do Organizer tạo và bị giới hạn số chỗ theo Subscription (BR-23).
type SeatRole = typeof UserRoleValue.Instructor | typeof UserRoleValue.Learner;

// Subscription "hiện hành" (khớp partial unique subscriptions_one_current_per_org_key).
const CURRENT_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Grace,
  SubscriptionStatus.Suspended,
];

const INVITATION_TEMPLATE: Record<SeatRole, string> = {
  Instructor: 'INSTRUCTOR_INVITATION',
  Learner: 'LEARNER_INVITATION',
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courseClient: CourseServiceClient,
    private readonly config: ConfigService,
    private readonly settingsService: PlatformSettingsService,
    private readonly outbox: OutboxService,
    private readonly learningClient: LearningServiceClient, // UC13
  ) {}

  // ===========================================================================
  // UC12 - Xem danh sách Instructor
  // ===========================================================================
  async findInstructors(
    user: CurrentUser,
    query: ListAccountsQueryDto,
  ): Promise<PageResponse<InstructorListItem>> {
    const { page, pageSize } = query;
    const { rows, total } = await this.findAccountPage(
      user,
      query,
      UserRoleValue.Instructor,
    );
    const courseCounts = await this.countManagedCourses(
      user,
      rows.map((row) => row.id),
    );

    const items: InstructorListItem[] = rows.map((row) => ({
      ...row,
      managedCourseCount: courseCounts ? (courseCounts[row.id] ?? 0) : null,
    }));
    return createPageResponse(items, page, pageSize, total);
  }

  // ===========================================================================
  // UC13 - Xem danh sách Learner
  // ===========================================================================
  async findLearners(
    user: CurrentUser,
    query: ListAccountsQueryDto,
  ): Promise<PageResponse<LearnerListItem>> {
    const { page, pageSize } = query;
    const { rows, total } = await this.findAccountPage(
      user,
      query,
      UserRoleValue.Learner,
    );
    const summaries = await this.summarizeLearnerEnrollments(
      user,
      rows.map((row) => row.id),
    );

    // Learner không có trong kết quả của learning-service = không có Enrollment -> 0.
    const items: LearnerListItem[] = rows.map((row) => ({
      ...row,
      activeCourseCount: summaries
        ? (summaries[row.id]?.activeCourseCount ?? 0)
        : null,
      overdueCourseCount: summaries
        ? (summaries[row.id]?.overdueCourseCount ?? 0)
        : null,
    }));
    return createPageResponse(items, page, pageSize, total);
  }

  /**
   * Phần chung của danh sách tài khoản trong tổ chức (UC12 Instructor, UC13 Learner):
   * một trang tài khoản chưa xóa của role, mới nhất trước, kèm cờ invitationExpired.
   */
  private async findAccountPage(
    user: CurrentUser,
    query: ListAccountsQueryDto,
    role: SeatRole,
  ): Promise<{ rows: AccountListItem[]; total: number }> {
    // Tổ chức luôn lấy từ danh tính người gọi, không nhận từ client.
    const organizationId = this.organizationIdOf(user);
    const { page, pageSize } = query;

    // BR-37: xóa tài khoản là gán deleted_at, nên loại các dòng đã xóa.
    const where = {
      organizationId,
      role,
      deletedAt: null,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        // id là uuid v7 (tăng theo thời gian), thêm vào để thứ tự ổn định khi trùng created_at.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          email: true,
          department: true,
          status: true,
          activatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const expiredIds = await this.findExpiredInvitationUserIds(
      organizationId,
      rows
        .filter((row) => row.status === UserStatus.Pending)
        .map((row) => row.id),
    );

    return {
      rows: rows.map((row) => ({
        ...row,
        invitationExpired: expiredIds.has(row.id),
      })),
      total,
    };
  }

  // ===========================================================================
  // UC12.2 - Thêm Instructor
  // ===========================================================================
  createInstructor(
    user: CurrentUser,
    dto: CreateAccountDto,
  ): Promise<AccountListItem> {
    return this.createAccount(user, dto, UserRoleValue.Instructor);
  }

  getInstructorSeats(user: CurrentUser): Promise<SeatUsage> {
    return this.getSeatUsage(
      this.organizationIdOf(user),
      UserRoleValue.Instructor,
    );
  }

  /** Số chỗ của một role trong tổ chức. Dùng chung cho seats Instructor / Learner (UC13.2). */
  async getSeatUsage(
    organizationId: string,
    role: SeatRole,
  ): Promise<SeatUsage> {
    const [organization, subscription, used] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { status: true },
      }),
      this.findCurrentSubscription(this.prisma, organizationId),
      this.countUsedSeats(this.prisma, organizationId, role),
    ]);
    const max = subscription ? this.seatLimitOf(subscription, role) : 0;
    const remaining = Math.max(0, max - used);
    return {
      used,
      max,
      remaining,
      subscriptionStatus: subscription?.status ?? null,
      canCreate:
        organization?.status === OrganizationStatus.Active &&
        subscription?.status === SubscriptionStatus.Active &&
        remaining > 0,
    };
  }

  /**
   * BR-36: vô hiệu hóa không giải phóng chỗ -> đếm mọi trạng thái (Pending, Active, Deactivated).
   * BR-37: chỉ xóa (deleted_at) mới giải phóng chỗ.
   */
  countUsedSeats(
    client: Prisma.TransactionClient,
    organizationId: string,
    role: SeatRole,
  ): Promise<number> {
    return client.user.count({
      where: { organizationId, role, deletedAt: null },
    });
  }

  /**
   * Tạo tài khoản Instructor / Learner ở trạng thái Pending và gửi lời mời (BR-21, BR-34).
   * tenant không xử lý mật khẩu: người nhận tự đặt khi kích hoạt (UC04).
   */
  private async createAccount(
    user: CurrentUser,
    dto: CreateAccountDto,
    role: SeatRole,
  ): Promise<AccountListItem> {
    const organizationId = this.organizationIdOf(user);
    const settings = await this.settingsService.get();
    const { rawToken, tokenHash } = generateSecretToken();

    try {
      return await this.prisma.$transaction(async (tx) => {
        // ---- 1. Khóa dòng tổ chức để 2 request đồng thời không cùng lấy chỗ cuối
        // (tenant_db: "Kiểm số chỗ khi thao tác đồng thời").
        const [organization] = await tx.$queryRaw<
          Array<{ name: string; status: string }>
        >`SELECT name, status FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;

        // ---- 2. BR-45: tổ chức bị tạm khóa thì không thao tác.
        if (
          !organization ||
          organization.status !== OrganizationStatus.Active
        ) {
          throw new ForbiddenException({
            code: 'ORGANIZATION_NOT_ACTIVE',
            message:
              'Tổ chức đang không hoạt động nên không tạo được tài khoản.',
          });
        }

        // ---- 3. BR-15 (ân hạn: không tạo tài khoản), BR-17 (Suspended: chỉ xem, kết xuất báo cáo).
        const subscription = await this.findCurrentSubscription(
          tx,
          organizationId,
        );
        if (
          !subscription ||
          subscription.status !== SubscriptionStatus.Active
        ) {
          throw new ForbiddenException({
            code: 'SUBSCRIPTION_NOT_ACTIVE',
            message:
              'Subscription không ở trạng thái hoạt động nên không tạo được tài khoản.',
          });
        }

        // ---- 4. BR-23: kiểm số chỗ còn lại theo bản chụp giới hạn trên Subscription.
        const used = await this.countUsedSeats(tx, organizationId, role);
        if (used >= this.seatLimitOf(subscription, role)) {
          throw new ConflictException({
            code: 'SEAT_LIMIT_REACHED',
            message: 'Đã dùng hết số chỗ theo giới hạn của Subscription.',
          });
        }

        // ---- 5. BR-30, BR-31: email duy nhất toàn nền tảng trong tài khoản chưa xóa.
        // Thông báo chung, không cho biết email thuộc tổ chức nào.
        if (await this.findAccountByEmailAcrossOrganizations(tx, dto.email)) {
          throw this.emailAlreadyUsed();
        }

        // ---- 6. Tài khoản chờ kích hoạt.
        const created = await tx.user.create({
          data: {
            organizationId,
            email: dto.email,
            fullName: dto.fullName,
            role,
            department: dto.department ?? null,
            status: UserStatus.Pending,
            activatedAt: null,
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            department: true,
            status: true,
            activatedAt: true,
            createdAt: true,
          },
        });

        // ---- 7. Lời mời: chỉ lưu mã băm. BR-278 + BR-269: hạn tính và chép ngay lúc tạo.
        const expiresAt = new Date(
          created.createdAt.getTime() + settings.invitationLinkTtlDays * DAY_MS,
        );
        await tx.accountToken.create({
          data: {
            organizationId,
            userId: created.id,
            purpose: TokenPurpose.Invitation,
            tokenHash,
            expiresAt,
          },
        });

        // ---- 8. Thư mời qua outbox, cùng transaction: rollback thì thư cũng không gửi.
        await this.outbox.enqueueEmail(tx, {
          aggregateType: 'User',
          aggregateId: created.id,
          organizationId,
          email: {
            to: created.email,
            subject: `LearnUP - Lời mời tham gia ${organization.name}`,
            templateCode: INVITATION_TEMPLATE[role],
            body:
              `Xin chào ${created.fullName},\n` +
              `${organization.name} đã tạo cho bạn tài khoản ${role} trên LearnUP.\n` +
              `Mở liên kết sau để đặt mật khẩu và kích hoạt tài khoản: ${this.activationLink(rawToken)}\n` +
              `Liên kết có hiệu lực tới ${expiresAt.toISOString()}.`,
          },
        });

        return { ...created, invitationExpired: false };
      });
    } catch (error) {
      // P2002: 2 request cùng email gửi đồng thời, partial unique users_email_not_deleted_key chặn.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.emailAlreadyUsed();
      }
      throw error;
    }
  }

  /** Truy vấn ngoại lệ toàn nền tảng (tenant_db: hậu tố AcrossOrganizations). Email đã ở chữ thường. */
  private findAccountByEmailAcrossOrganizations(
    client: Prisma.TransactionClient,
    email: string,
  ): Promise<{ id: string } | null> {
    return client.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });
  }

  private findCurrentSubscription(
    client: Prisma.TransactionClient,
    organizationId: string,
  ) {
    return client.subscription.findFirst({
      where: { organizationId, status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
      select: { status: true, maxInstructors: true, maxLearners: true },
    });
  }

  private seatLimitOf(
    subscription: { maxInstructors: number; maxLearners: number },
    role: SeatRole,
  ): number {
    return role === UserRoleValue.Instructor
      ? subscription.maxInstructors
      : subscription.maxLearners;
  }

  private emailAlreadyUsed(): ConflictException {
    return new ConflictException({
      code: 'EMAIL_ALREADY_USED',
      message: 'Email đã được sử dụng cho một tài khoản khác.',
    });
  }

  // Route kích hoạt của frontend: activate/:token (UC04 của A).
  private activationLink(rawToken: string): string {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `${frontendUrl}/activate/${rawToken}`;
  }

  /**
   * Trong các user Pending, ai không còn lời mời hiệu lực (BR-22, BR-278).
   * Lời mời hiệu lực = token Invitation chưa dùng, chưa thu hồi, expires_at > now.
   * Một truy vấn cho cả trang.
   */
  private async findExpiredInvitationUserIds(
    organizationId: string,
    pendingUserIds: string[],
  ): Promise<Set<string>> {
    if (pendingUserIds.length === 0) return new Set();

    const usable = await this.prisma.accountToken.findMany({
      where: {
        organizationId,
        userId: { in: pendingUserIds },
        purpose: TokenPurpose.Invitation,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });
    const hasUsable = new Set(usable.map((token) => token.userId));
    return new Set(pendingUserIds.filter((id) => !hasUsable.has(id)));
  }

  /** Lỗi khi hỏi course-service không làm hỏng cả danh sách: trả null, ghi cảnh báo. */
  private async countManagedCourses(
    user: CurrentUser,
    instructorIds: string[],
  ): Promise<Record<string, number> | null> {
    if (instructorIds.length === 0) return {};
    try {
      return await this.courseClient.countCourseChainsByInstructors(
        user,
        instructorIds,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không lấy được số Course phụ trách từ course-service: ${reason}`,
      );
      return null;
    }
  }

  /** Lỗi khi hỏi learning-service không làm hỏng cả danh sách: trả null, ghi cảnh báo. */
  private async summarizeLearnerEnrollments(
    user: CurrentUser,
    learnerIds: string[],
  ): Promise<Record<string, LearnerEnrollmentSummary> | null> {
    if (learnerIds.length === 0) return {};
    try {
      return await this.learningClient.summarizeEnrollmentsByLearners(
        user,
        learnerIds,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không lấy được tình trạng đào tạo của Learner từ learning-service: ${reason}`,
      );
      return null;
    }
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException({
        code: STANDARD_ERROR_CODES.FORBIDDEN,
        message: 'Tài khoản không thuộc Organization nào.',
      });
    }
    return user.organizationId;
  }
}
