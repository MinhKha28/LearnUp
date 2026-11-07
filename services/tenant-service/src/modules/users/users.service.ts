import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser, PageResponse } from '@learnup/ts-common';
import { STANDARD_ERROR_CODES, createPageResponse } from '@learnup/ts-common';
import type { IStorageProvider } from '@learnup/ts-storage';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import type { IManagedCourseChain } from '../../infrastructure/clients/course/interfaces/managed-course-chain.interface';
import {
  LearnerEnrollment,
  LearnerEnrollmentSummary,
  LearningServiceClient,
} from '../../infrastructure/clients/learning/learning-service.client';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { OutboxService } from '../outbox/outbox.service';
import { AccountTokensService } from '../account-tokens/account-tokens.service';
import {
  DAY_MS,
  OrganizationStatus,
  SubscriptionStatus,
  TokenPurpose,
  UserRoleValue,
  UserStatus,
} from '../../common/constants/tenant.constants';
import { generateSecretToken } from '../../common/utils/token.util';
import {
  AccountStatusAction,
  ChangeAccountStatusDto,
} from './dto/change-account-status.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import {
  AccountListItem,
  InstructorListItem,
  LearnerListItem,
} from './interfaces/account-list-item.interface';
import {
  InstructorDetail,
  InstructorInvitation,
} from './interfaces/instructor-detail.interface';
import {
  IInstructorStatusChange,
  IInstructorStatusResult,
  IStatusChangeReceiver,
} from './interfaces/instructor-status.interface';
import { LearnerDetail } from './interfaces/learner-detail.interface';
import { IReinvitationResult } from './interfaces/reinvitation-result.interface';
import { SeatUsage } from './interfaces/seat-usage.interface';
import { UpdateAccountResult } from './interfaces/update-account-result.interface';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CourseServiceClient } from 'src/infrastructure/clients/course/course-service.client';

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

// UC12.2: chỉ Subscription Active mới tạo tài khoản (BR-15, BR-17).
const CREATE_SUBSCRIPTION_STATUSES = [SubscriptionStatus.Active];
// UC12.3: ân hạn vẫn sửa được (BR-15 chỉ cấm tạo); Suspended chỉ xem (BR-17).
const UPDATE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Grace,
];

// UC12.5: thời gian chờ một lời gọi course-service, như HttpCourseServiceClient.
const DEFAULT_COURSE_TIMEOUT_MS = 3000;

// UC12.5: một dòng users đã khóa FOR UPDATE.
interface LockedInstructor {
  id: string;
  fullName: string;
  email: string;
  status: string;
  activatedAt: Date | null;
}

// Partial unique index (migration init_tenant_schema) mà UC12.3 đổi thành 409 riêng.
const USERS_EMAIL_UNIQUE_INDEX = 'users_email_not_deleted_key';
const ONE_OPEN_LINK_UNIQUE_INDEX = 'account_tokens_one_open_link_key';

const ACCOUNT_NOT_FOUND: Record<SeatRole, { code: string; message: string }> = {
  Instructor: {
    code: 'INSTRUCTOR_NOT_FOUND',
    message: 'Không tìm thấy Instructor.',
  },
  Learner: { code: 'LEARNER_NOT_FOUND', message: 'Không tìm thấy Learner.' },
};

/**
 * Tên unique index bị vi phạm trong lỗi P2002.
 * Prisma 7 + adapter-pg: meta.driverAdapterError.cause.constraint.index (tên index của Postgres);
 * engine cũ (không adapter): meta.target là tên index hoặc danh sách cột.
 */
function violatedUniqueIndex(
  error: Prisma.PrismaClientKnownRequestError,
): string | undefined {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: {
          cause?: { constraint?: { index?: unknown } };
        };
      }
    | undefined;
  const index = meta?.driverAdapterError?.cause?.constraint?.index;
  if (typeof index === 'string') return index;
  return typeof meta?.target === 'string' ? meta.target : undefined;
}

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
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider, // UC12.1: avatarUrl
    private readonly accountTokens: AccountTokensService, // UC12.3: lời mời khi đổi email
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
  // UC12.1 - Xem chi tiết Instructor
  // ===========================================================================
  async findInstructorDetail(
    user: CurrentUser,
    instructorId: string,
  ): Promise<InstructorDetail> {
    const organizationId = this.organizationIdOf(user);

    // Một truy vấn: không tồn tại, khác tổ chức, đã xóa (BR-37) hay không phải Instructor
    // đều ra cùng một 404. BR-36: Deactivated (và Pending) vẫn xem được.
    const instructor = await this.prisma.user.findFirst({
      where: {
        id: instructorId,
        organizationId,
        role: UserRoleValue.Instructor,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarFileKey: true,
        department: true,
        status: true,
        activatedAt: true,
        createdAt: true,
      },
    });
    if (!instructor) {
      throw new NotFoundException({
        code: 'INSTRUCTOR_NOT_FOUND',
        message: 'Không tìm thấy Instructor.',
      });
    }

    const isPending = instructor.status === UserStatus.Pending;
    const [expiredIds, invitation, courses] = await Promise.all([
      // Dùng chung cách tính với danh sách UC12 để cờ invitationExpired luôn khớp.
      this.findExpiredInvitationUserIds(
        organizationId,
        isPending ? [instructor.id] : [],
      ),
      isPending
        ? this.findOpenInvitation(organizationId, instructor.id)
        : Promise.resolve(null),
      this.listManagedCourses(user, instructor.id),
    ]);

    const { avatarFileKey, ...account } = instructor;
    return {
      ...account,
      avatarUrl: this.avatarUrl(avatarFileKey),
      invitationExpired: expiredIds.has(instructor.id),
      invitation,
      courses,
      violations: null, // GĐ2: kiểm duyệt nội dung (course-service)
    };
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

  // ===========================================================================
  // UC13.1 - Xem chi tiết Learner
  // ===========================================================================
  async findLearnerDetail(
    user: CurrentUser,
    learnerId: string,
  ): Promise<LearnerDetail> {
    const organizationId = this.organizationIdOf(user);

    // Một truy vấn: không tồn tại, khác tổ chức, đã xóa (BR-37) hay không phải Learner
    // đều ra cùng một 404. BR-36: Deactivated (và Pending) vẫn xem được.
    const learner = await this.prisma.user.findFirst({
      where: {
        id: learnerId,
        organizationId,
        role: UserRoleValue.Learner,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarFileKey: true,
        department: true,
        status: true,
        activatedAt: true,
        createdAt: true,
      },
    });
    if (!learner) {
      throw new NotFoundException({
        code: 'LEARNER_NOT_FOUND',
        message: 'Không tìm thấy Learner.',
      });
    }

    const isPending = learner.status === UserStatus.Pending;
    const [expiredIds, invitation, enrollments] = await Promise.all([
      // Dùng chung cách tính với danh sách UC13 để cờ invitationExpired luôn khớp.
      this.findExpiredInvitationUserIds(
        organizationId,
        isPending ? [learner.id] : [],
      ),
      isPending
        ? this.findOpenInvitation(organizationId, learner.id)
        : Promise.resolve(null),
      this.listLearnerEnrollments(user, learner.id),
    ]);

    const { avatarFileKey, ...account } = learner;
    return {
      ...account,
      avatarUrl: this.avatarUrl(avatarFileKey),
      invitationExpired: expiredIds.has(learner.id),
      invitation,
      enrollments,
    };
  }

  /**
   * Phần chung của danh sách tài khoản trong tổ chức (UC12 Instructor, UC13 Learner):
   * một trang tài khoản chưa xóa của role, mới nhất trước, kèm cờ invitationExpired.
   * UC12.4 / UC13.4: lọc thêm theo keyword (họ tên hoặc email) và status nếu có.
   */
  private async findAccountPage(
    user: CurrentUser,
    query: ListAccountsQueryDto,
    role: SeatRole,
  ): Promise<{ rows: AccountListItem[]; total: number }> {
    // Tổ chức luôn lấy từ danh tính người gọi, không nhận từ client.
    const organizationId = this.organizationIdOf(user);
    const { page, pageSize, keyword, status } = query;

    // Prisma sinh ILIKE '%' || kw || '%' mà không escape: "%", "_" trong từ khóa
    // sẽ thành wildcard (UC13.4). Thay một lượt cả "\", "%", "_" nên "\" sinh ra khi escape
    // "%", "_" không bị escape lần nữa (tương đương escape "\" trước rồi mới "%", "_").
    const pattern = keyword?.replace(/[\\%_]/g, (char) => `\\${char}`);

    // BR-37: xóa tài khoản là gán deleted_at, nên loại các dòng đã xóa.
    // count và findMany dùng chung where để total đếm đúng theo bộ lọc.
    const where: Prisma.UserWhereInput = {
      organizationId,
      role,
      deletedAt: null,
      ...(status && { status }),
      ...(pattern && {
        OR: [
          { fullName: { contains: pattern, mode: 'insensitive' } },
          { email: { contains: pattern, mode: 'insensitive' } },
        ],
      }),
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

  // ===========================================================================
  // UC13.2 - Thêm Learner (dùng chung lõi createAccount / getSeatUsage với UC12.2)
  // ===========================================================================
  createLearner(
    user: CurrentUser,
    dto: CreateAccountDto,
  ): Promise<AccountListItem> {
    return this.createAccount(user, dto, UserRoleValue.Learner);
  }

  getLearnerSeats(user: CurrentUser): Promise<SeatUsage> {
    return this.getSeatUsage(
      this.organizationIdOf(user),
      UserRoleValue.Learner,
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
        // ---- 1-3. Khóa dòng tổ chức để 2 request đồng thời không cùng lấy chỗ cuối
        // (tenant_db: "Kiểm số chỗ khi thao tác đồng thời"); BR-45; BR-15 (ân hạn: không tạo
        // tài khoản), BR-17 (Suspended: chỉ xem, kết xuất báo cáo).
        const { organization, subscription } =
          await this.assertCanManageAccounts(tx, organizationId, {
            action: 'tạo',
            subscriptionStatuses: CREATE_SUBSCRIPTION_STATUSES,
            lockOrganization: true,
          });

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
        await this.enqueueInvitationEmail(tx, {
          organizationId,
          organizationName: organization.name,
          userId: created.id,
          to: created.email,
          fullName: created.fullName,
          role,
          rawToken,
          expiresAt,
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

  // ===========================================================================
  // UC12.3 - Cập nhật thông tin Instructor
  // ===========================================================================
  updateInstructor(
    user: CurrentUser,
    instructorId: string,
    dto: UpdateAccountDto,
  ): Promise<UpdateAccountResult> {
    return this.updateAccount(
      user,
      instructorId,
      dto,
      UserRoleValue.Instructor,
    );
  }

  // ===========================================================================
  // UC13.3 - Cập nhật thông tin Learner (cùng quy tắc, cùng phạm vi sửa với UC12.3)
  // ===========================================================================
  updateLearner(
    user: CurrentUser,
    learnerId: string,
    dto: UpdateAccountDto,
  ): Promise<UpdateAccountResult> {
    return this.updateAccount(user, learnerId, dto, UserRoleValue.Learner);
  }

  /**
   * UC12.3, UC13.3. Sửa họ tên, email (chỉ khi chưa kích hoạt) và đơn vị công tác (mọi lúc) - BR-34, BR-35.
   * Không kiểm số chỗ (BR-23): không tạo tài khoản, không đổi deleted_at.
   * Thứ tự khóa: token TRƯỚC, user SAU, cùng thứ tự với InvitationsService.accept (UC04)
   * để Organizer lưu đúng lúc người dùng kích hoạt không gây deadlock.
   */
  private async updateAccount(
    user: CurrentUser,
    accountId: string,
    dto: UpdateAccountDto,
    role: SeatRole,
  ): Promise<UpdateAccountResult> {
    const organizationId = this.organizationIdOf(user);
    if (
      dto.fullName === undefined &&
      dto.email === undefined &&
      dto.department === undefined
    ) {
      throw new BadRequestException({
        code: 'NO_FIELDS_TO_UPDATE',
        message: 'Cần gửi ít nhất một trường để cập nhật.',
      });
    }
    const settings = await this.settingsService.get();
    const scope: Prisma.UserWhereInput = {
      id: accountId,
      organizationId,
      role,
      deletedAt: null,
    };

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // ---- 1. BR-45, BR-17; ân hạn vẫn sửa được. Không khóa dòng tổ chức (không đụng số chỗ).
        const { organization } = await this.assertCanManageAccounts(
          tx,
          organizationId,
          {
            action: 'cập nhật',
            subscriptionStatuses: UPDATE_SUBSCRIPTION_STATUSES,
            lockOrganization: false,
          },
        );

        // ---- 2. Không tồn tại, khác tổ chức, đã xóa, sai role đều là cùng một 404 (như UC12.1).
        const account = await tx.user.findFirst({
          where: scope,
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
        if (!account) throw this.accountNotFound(role);

        // ---- 3. So với giá trị đang lưu (DTO đã chuẩn hóa như lúc tạo). Trùng = không đổi (H2).
        const nameChanged =
          dto.fullName !== undefined && dto.fullName !== account.fullName;
        const emailChanged =
          dto.email !== undefined && dto.email !== account.email;
        const departmentChanged =
          dto.department !== undefined && dto.department !== account.department;
        if (!nameChanged && !emailChanged && !departmentChanged) {
          return { account, invitationResent: false };
        }

        // ---- 4. BR-34: từ khi kích hoạt, họ tên do người dùng quản lý, email không sửa được.
        if ((nameChanged || emailChanged) && account.activatedAt !== null) {
          throw this.accountAlreadyActivated();
        }

        // Giá trị sau khi sửa: trường không gửi giữ nguyên.
        const updated = {
          ...account,
          fullName: dto.fullName ?? account.fullName,
          email: dto.email ?? account.email,
          department:
            dto.department === undefined ? account.department : dto.department,
        };

        // ---- 5. BR-30, BR-31: email mới chưa thuộc tài khoản chưa xóa nào (kể cả tổ chức khác).
        let invitation: { rawToken: string; expiresAt: Date } | null = null;
        if (emailChanged) {
          if (
            await this.findAccountByEmailAcrossOrganizations(tx, updated.email)
          ) {
            throw this.emailAlreadyUsed();
          }

          // ---- 6. BR-35: lời mời cũ mất hiệu lực. Pending -> phát liên kết mới (BR-278);
          // Deactivated chưa kích hoạt -> chỉ thu hồi, không gửi thư.
          if (account.status === UserStatus.Pending) {
            invitation = await this.accountTokens.issue(tx, {
              organizationId,
              userId: account.id,
              purpose: TokenPurpose.Invitation,
              ttlDays: settings.invitationLinkTtlDays,
            });
          } else {
            await this.accountTokens.revokeOpen(tx, {
              userId: account.id,
              purpose: TokenPurpose.Invitation,
            });
          }
        }

        // ---- 7. Cập nhật có điều kiện: người dùng vừa kích hoạt, hoặc request khác vừa đổi email
        // -> 0 dòng, throw để rollback cả bước 6.
        const { count } = await tx.user.updateMany({
          where: {
            ...scope,
            ...((nameChanged || emailChanged) && { activatedAt: null }),
            ...(emailChanged && { email: account.email }),
          },
          data: {
            ...(nameChanged && { fullName: updated.fullName }),
            ...(emailChanged && { email: updated.email }),
            ...(departmentChanged && { department: updated.department }),
          },
        });
        if (count === 0) throw await this.updateConflict(tx, scope, role);

        // ---- 8. Thư mời tới email mới qua outbox, cùng transaction.
        if (invitation) {
          await this.enqueueInvitationEmail(tx, {
            organizationId,
            organizationName: organization.name,
            userId: updated.id,
            to: updated.email,
            fullName: updated.fullName,
            role,
            rawToken: invitation.rawToken,
            expiresAt: invitation.expiresAt,
          });
        }
        return { account: updated, invitationResent: invitation !== null };
      });

      const { account, invitationResent } = result;
      const expiredIds =
        account.status === UserStatus.Pending && !invitationResent
          ? await this.findExpiredInvitationUserIds(organizationId, [
              account.id,
            ])
          : new Set<string>();
      return {
        ...account,
        invitationExpired: expiredIds.has(account.id),
        invitationResent,
      };
    } catch (error) {
      // P2002 theo index: hai request đổi sang cùng email (users_email_not_deleted_key);
      // hai request cùng phát lời mời cho một tài khoản (account_tokens_one_open_link_key).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const index = violatedUniqueIndex(error);
        if (index === USERS_EMAIL_UNIQUE_INDEX) throw this.emailAlreadyUsed();
        if (index === ONE_OPEN_LINK_UNIQUE_INDEX) throw this.concurrentUpdate();
      }
      throw error;
    }
  }

  // ===========================================================================
  // UC12.7 - Mời lại Instructor / UC13.7 - Mời lại Learner
  // ===========================================================================
  resendInstructorInvitation(
    user: CurrentUser,
    instructorId: string,
  ): Promise<IReinvitationResult> {
    return this.resendInvitation(user, instructorId, UserRoleValue.Instructor);
  }

  resendLearnerInvitation(
    user: CurrentUser,
    learnerId: string,
  ): Promise<IReinvitationResult> {
    return this.resendInvitation(user, learnerId, UserRoleValue.Learner);
  }

  /**
   * BR-29: chỉ tài khoản chưa kích hoạt (Pending). BR-30: liên kết mới, liên kết cũ mất hiệu lực.
   * Không tạo tài khoản nên không kiểm số chỗ; ân hạn vẫn mời lại được, Suspended thì không.
   * Thứ tự khóa: token trước, user sau, như InvitationsService.accept (UC04).
   */
  private async resendInvitation(
    user: CurrentUser,
    accountId: string,
    role: SeatRole,
  ): Promise<IReinvitationResult> {
    const organizationId = this.organizationIdOf(user);
    const settings = await this.settingsService.get();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const { organization } = await this.assertCanManageAccounts(
          tx,
          organizationId,
          {
            action: 'mời lại',
            subscriptionStatuses: UPDATE_SUBSCRIPTION_STATUSES,
            lockOrganization: false,
          },
        );

        const account = await tx.user.findFirst({
          where: { id: accountId, organizationId, role, deletedAt: null },
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
            activatedAt: true,
          },
        });
        if (!account) throw this.accountNotFound(role);
        if (account.status !== UserStatus.Pending || account.activatedAt) {
          throw this.accountNotPending();
        }

        const invitation = await this.accountTokens.issue(tx, {
          organizationId,
          userId: account.id,
          purpose: TokenPurpose.Invitation,
          ttlDays: settings.invitationLinkTtlDays,
        });

        const [locked] = await tx.$queryRaw<
          Array<{ status: string; email: string; activated_at: Date | null }>
        >`SELECT status, email, activated_at FROM users
          WHERE id = ${account.id}::uuid AND deleted_at IS NULL FOR UPDATE`;
        if (!locked) throw this.accountNotFound(role);
        if (locked.status !== UserStatus.Pending || locked.activated_at) {
          throw this.accountNotPending();
        }
        if (locked.email !== account.email) throw this.concurrentUpdate();

        await this.enqueueInvitationEmail(tx, {
          organizationId,
          organizationName: organization.name,
          userId: account.id,
          to: account.email,
          fullName: account.fullName,
          role,
          rawToken: invitation.rawToken,
          expiresAt: invitation.expiresAt,
        });

        return {
          id: account.id,
          status: account.status,
          invitationExpired: false as const,
          invitation: {
            sentAt: invitation.issuedAt,
            expiresAt: invitation.expiresAt,
          },
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        violatedUniqueIndex(error) === ONE_OPEN_LINK_UNIQUE_INDEX
      ) {
        throw this.concurrentUpdate();
      }
      throw error;
    }
  }

  private accountNotPending(): ConflictException {
    return new ConflictException({
      code: 'ACCOUNT_NOT_PENDING',
      message: 'Chỉ mời lại được tài khoản chưa kích hoạt.',
    });
  }

  // ===========================================================================
  // UC12.5 - Đổi trạng thái Instructor
  // BR-36: vô hiệu hóa không xóa dữ liệu học tập, không trả lại chỗ -> kích hoạt lại không kiểm số chỗ.
  // BR-41: không vô hiệu hóa được Instructor còn phụ trách Course chưa Archived; phải chọn Instructor
  //        tiếp nhận cùng Organization, chuyển quyền (BR-76) rồi mới vô hiệu hóa; không còn ai hợp lệ
  //        thì chặn kèm danh sách Course.
  // BR-287: điều kiện BR-41 xét theo chuỗi; chuyển quyền chuyển nguyên chuỗi (course-service làm).
  // ===========================================================================
  /** Dữ liệu cho modal: chuỗi đang phụ trách và Instructor tiếp nhận hợp lệ. Chỉ đọc, không khóa. */
  async getInstructorStatusChange(
    user: CurrentUser,
    instructorId: string,
  ): Promise<IInstructorStatusChange> {
    const organizationId = this.organizationIdOf(user);
    const instructor = await this.prisma.user.findFirst({
      where: {
        id: instructorId,
        organizationId,
        role: UserRoleValue.Instructor,
        deletedAt: null,
      },
      select: { id: true, status: true, activatedAt: true },
    });
    if (!instructor) throw this.accountNotFound(UserRoleValue.Instructor);

    const base = {
      id: instructor.id,
      status: instructor.status,
      activated: instructor.activatedAt !== null,
      receivers: [] as IStatusChangeReceiver[],
    };
    if (instructor.status === UserStatus.Deactivated) {
      return {
        ...base,
        canDeactivate: false,
        blockReason: 'ALREADY_DEACTIVATED',
        courses: [],
      };
    }
    if (
      instructor.status !== UserStatus.Active ||
      instructor.activatedAt === null
    ) {
      return {
        ...base,
        canDeactivate: false,
        blockReason: 'ACCOUNT_NOT_ACTIVATED',
        courses: [],
      };
    }

    // Ca A dùng count-by-instructors (course-service đã có); danh sách chỉ cần cho ca B, C.
    let courses: IManagedCourseChain[];
    try {
      const counts = await this.courseClient.countCourseChainsByInstructors(
        user,
        [instructor.id],
      );
      courses =
        (counts[instructor.id] ?? 0) === 0
          ? []
          : await this.courseClient.listCourseChainsByInstructor(
              user,
              instructor.id,
            );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không lấy được Course phụ trách từ course-service: ${reason}`,
      );
      return {
        ...base,
        canDeactivate: false,
        blockReason: 'COURSE_SERVICE_UNAVAILABLE',
        courses: null,
      };
    }
    if (courses.length === 0) {
      return { ...base, canDeactivate: true, blockReason: null, courses };
    }

    const receivers = await this.findValidReceivers(
      this.prisma,
      organizationId,
      instructor.id,
    );
    return {
      ...base,
      receivers,
      courses,
      canDeactivate: receivers.length > 0,
      blockReason: receivers.length > 0 ? null : 'NO_VALID_RECEIVER',
    };
  }

  changeInstructorStatus(
    user: CurrentUser,
    instructorId: string,
    dto: ChangeAccountStatusDto,
  ): Promise<IInstructorStatusResult> {
    const organizationId = this.organizationIdOf(user);
    return dto.action === AccountStatusAction.Reactivate
      ? this.reactivateInstructor(user, organizationId, instructorId, dto)
      : this.deactivateInstructor(user, organizationId, instructorId, dto);
  }

  /**
   * Một transaction. Khóa FOR UPDATE dòng users của người bị vô hiệu hóa và người tiếp nhận theo id
   * tăng dần (không khóa organizations), kiểm lại cả hai sau khi khóa, rồi mới hỏi / chuyển quyền ở
   * course-service. Chuyển quyền xong mà bước sau lỗi thì KHÔNG hoàn tác chuyển quyền: tenant rollback,
   * lần bấm sau người này không còn chuỗi nên vô hiệu hóa thẳng (ca A).
   */
  private deactivateInstructor(
    user: CurrentUser,
    organizationId: string,
    instructorId: string,
    dto: ChangeAccountStatusDto,
  ): Promise<IInstructorStatusResult> {
    const targetId = instructorId.toLowerCase();
    const receiverId = dto.receiverInstructorId?.toLowerCase();
    if (receiverId === targetId) throw this.invalidReceiver();

    return this.prisma.$transaction(
      async (tx) => {
        // BR-15: ân hạn chỉ cấm tạo tài khoản / Course / tải học liệu -> vẫn đổi trạng thái được.
        // BR-17: Suspended chỉ còn xem và kết xuất báo cáo -> chặn.
        const { organization } = await this.assertCanManageAccounts(
          tx,
          organizationId,
          {
            action: 'vô hiệu hóa',
            subscriptionStatuses: UPDATE_SUBSCRIPTION_STATUSES,
            lockOrganization: false,
          },
        );

        const locked = await this.lockInstructors(tx, organizationId, [
          targetId,
          ...(receiverId ? [receiverId] : []),
        ]);
        const target = locked.get(targetId);
        if (!target) throw this.accountNotFound(UserRoleValue.Instructor);
        if (target.status === UserStatus.Deactivated) {
          return this.statusUnchanged(target);
        }
        if (
          target.status !== UserStatus.Active ||
          target.activatedAt === null
        ) {
          throw this.accountNotActivated(
            'Tài khoản chưa kích hoạt nên không vô hiệu hóa được. Nếu không dùng nữa, hãy xóa tài khoản.',
          );
        }

        let transferred: IManagedCourseChain[] = [];
        let receiver: LockedInstructor | null = null;
        const managed = await this.countManagedChainsOrFail(user, target.id);
        if (managed > 0) {
          const courses = await this.callCourseService(() =>
            this.courseClient.listCourseChainsByInstructor(user, target.id),
          );
          const candidate = receiverId ? locked.get(receiverId) : undefined;
          if (
            !candidate ||
            candidate.status !== UserStatus.Active ||
            candidate.activatedAt === null
          ) {
            const others = await this.findValidReceivers(
              tx,
              organizationId,
              target.id,
            );
            if (others.length === 0) {
              throw new ConflictException({
                code: 'NO_VALID_RECEIVER',
                message:
                  'Instructor còn phụ trách Course nhưng tổ chức không còn Instructor hợp lệ nào khác để tiếp nhận.',
                courses,
              });
            }
            if (!receiverId) {
              throw new ConflictException({
                code: 'RECEIVER_REQUIRED',
                message:
                  'Instructor còn phụ trách Course: cần chọn Instructor tiếp nhận.',
                courses,
              });
            }
            throw this.invalidReceiver();
          }
          receiver = candidate;

          transferred = await this.callCourseService(() =>
            this.courseClient.transferCourseChains(
              user,
              target.id,
              candidate.id,
            ),
          );
          // Instructor có thể vừa tạo chuỗi mới trong lúc chuyển: còn chuỗi thì không vô hiệu hóa (BR-41).
          if ((await this.countManagedChainsOrFail(user, target.id)) > 0) {
            const latest = await this.courseClient
              .listCourseChainsByInstructor(user, target.id)
              .catch(() => null);
            throw new ConflictException({
              code: 'MANAGED_COURSES_REMAINING',
              message:
                'Instructor vừa có thêm Course phụ trách. Hãy tải lại và thử lại.',
              courses: latest,
            });
          }
        }

        const { count } = await tx.user.updateMany({
          where: {
            id: target.id,
            organizationId,
            role: UserRoleValue.Instructor,
            deletedAt: null,
            status: UserStatus.Active,
            activatedAt: { not: null },
          },
          data: { status: UserStatus.Deactivated },
        });
        if (count === 0) throw this.concurrentUpdate();

        await this.enqueueStatusEmail(tx, {
          organizationId,
          userId: target.id,
          to: target.email,
          templateCode: 'INSTRUCTOR_DEACTIVATED',
          subject: `LearnUP - Tài khoản Instructor tại ${organization.name} đã bị vô hiệu hóa`,
          // Không kèm lý do (quyết định đã chốt).
          body:
            `Xin chào ${target.fullName},\n` +
            `${organization.name} đã vô hiệu hóa tài khoản Instructor của bạn trên LearnUP.\n` +
            `Bạn không đăng nhập được cho tới khi tài khoản được kích hoạt lại. ` +
            `Nếu có thắc mắc, hãy liên hệ Organizer của tổ chức.`,
        });
        if (receiver && transferred.length > 0) {
          await this.enqueueStatusEmail(tx, {
            organizationId,
            userId: receiver.id,
            to: receiver.email,
            templateCode: 'COURSE_CHAINS_TRANSFERRED',
            subject: `LearnUP - Bạn được giao phụ trách ${transferred.length} Course tại ${organization.name}`,
            body:
              `Xin chào ${receiver.fullName},\n` +
              `${organization.name} đã chuyển cho bạn quyền phụ trách các Course sau:\n` +
              transferred
                .map(
                  (chain) =>
                    `- ${chain.name} (phiên bản ${chain.versionNumber})`,
                )
                .join('\n') +
              `\nBạn có quyền chỉnh sửa nội dung, chấm điểm và tạo phiên bản mới cho các Course này.`,
          });
        }
        await this.enqueueStatusAudit(tx, user, {
          organizationId,
          actionType: 'INSTRUCTOR_DEACTIVATED',
          targetId: target.id,
          reason: dto.reason,
          receiverId: receiver?.id ?? null,
          chainIds: transferred.map((chain) => chain.chainId),
        });

        return {
          id: target.id,
          status: UserStatus.Deactivated,
          changed: true,
          transferredCourses: transferred,
          receiver: receiver
            ? { id: receiver.id, fullName: receiver.fullName }
            : null,
        };
      },
      // Các lời gọi course-service nằm trong transaction: tối đa 4 lời gọi (đếm, liệt kê, chuyển, đếm lại).
      { maxWait: 5000, timeout: this.courseTimeoutMs() * 5 + 5000 },
    );
  }

  /** BR-36: kích hoạt lại không kiểm số chỗ. Course đã chuyển đi không quay về. */
  private reactivateInstructor(
    user: CurrentUser,
    organizationId: string,
    instructorId: string,
    dto: ChangeAccountStatusDto,
  ): Promise<IInstructorStatusResult> {
    const targetId = instructorId.toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const { organization } = await this.assertCanManageAccounts(
        tx,
        organizationId,
        {
          action: 'kích hoạt lại',
          subscriptionStatuses: UPDATE_SUBSCRIPTION_STATUSES,
          lockOrganization: false,
        },
      );

      const locked = await this.lockInstructors(tx, organizationId, [targetId]);
      const target = locked.get(targetId);
      if (!target) throw this.accountNotFound(UserRoleValue.Instructor);
      if (target.status === UserStatus.Active) {
        return this.statusUnchanged(target);
      }
      if (target.status !== UserStatus.Deactivated) {
        throw new ConflictException({
          code: 'ACCOUNT_NOT_DEACTIVATED',
          message: 'Chỉ kích hoạt lại được tài khoản đang bị vô hiệu hóa.',
        });
      }
      if (target.activatedAt === null) {
        throw this.accountNotActivated(
          'Tài khoản chưa từng kích hoạt nên không kích hoạt lại được. Nếu không dùng nữa, hãy xóa tài khoản.',
        );
      }

      const { count } = await tx.user.updateMany({
        where: {
          id: target.id,
          organizationId,
          role: UserRoleValue.Instructor,
          deletedAt: null,
          status: UserStatus.Deactivated,
          activatedAt: { not: null },
        },
        data: { status: UserStatus.Active },
      });
      if (count === 0) throw this.concurrentUpdate();

      await this.enqueueStatusEmail(tx, {
        organizationId,
        userId: target.id,
        to: target.email,
        templateCode: 'INSTRUCTOR_REACTIVATED',
        subject: `LearnUP - Tài khoản Instructor tại ${organization.name} đã được kích hoạt lại`,
        body:
          `Xin chào ${target.fullName},\n` +
          `${organization.name} đã kích hoạt lại tài khoản Instructor của bạn trên LearnUP.\n` +
          `Đăng nhập tại: ${this.loginLink()}`,
      });
      await this.enqueueStatusAudit(tx, user, {
        organizationId,
        actionType: 'INSTRUCTOR_REACTIVATED',
        targetId: target.id,
        reason: dto.reason,
        receiverId: null,
        chainIds: [],
      });

      return {
        id: target.id,
        status: UserStatus.Active,
        changed: true,
        transferredCourses: [],
        receiver: null,
      };
    });
  }

  /**
   * Khóa FOR UPDATE từng dòng users theo id tăng dần (thứ tự byte của uuid = thứ tự chuỗi hex chữ thường),
   * để hai thao tác cùng chạm hai Instructor không deadlock. Sau khi chờ khóa, Postgres đánh giá lại WHERE
   * trên bản mới nhất, nên giá trị trả về là trạng thái đã commit. Chỉ trả Instructor chưa xóa của tổ chức.
   */
  private async lockInstructors(
    tx: Prisma.TransactionClient,
    organizationId: string,
    ids: string[],
  ): Promise<Map<string, LockedInstructor>> {
    const sorted = [...new Set(ids)].sort();
    const result = new Map<string, LockedInstructor>();
    for (const id of sorted) {
      const [row] = await tx.$queryRaw<
        Array<{
          id: string;
          full_name: string;
          email: string;
          status: string;
          activated_at: Date | null;
        }>
      >`SELECT id::text AS id, full_name, email, status, activated_at
          FROM users
         WHERE id = ${id}::uuid
           AND organization_id = ${organizationId}::uuid
           AND role = ${UserRoleValue.Instructor}
           AND deleted_at IS NULL
           FOR UPDATE`;
      if (row) {
        result.set(row.id, {
          id: row.id,
          fullName: row.full_name,
          email: row.email,
          status: row.status,
          activatedAt: row.activated_at,
        });
      }
    }
    return result;
  }

  /** Quyết định 3: cùng Organization, đã kích hoạt, đang Active, chưa xóa, không phải người bị vô hiệu hóa. */
  private findValidReceivers(
    client: Prisma.TransactionClient,
    organizationId: string,
    excludeId: string,
  ): Promise<IStatusChangeReceiver[]> {
    return client.user.findMany({
      where: {
        organizationId,
        role: UserRoleValue.Instructor,
        deletedAt: null,
        status: UserStatus.Active,
        activatedAt: { not: null },
        id: { not: excludeId },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: { id: true, fullName: true, email: true, department: true },
    });
  }

  private async countManagedChainsOrFail(
    user: CurrentUser,
    instructorId: string,
  ): Promise<number> {
    const counts = await this.callCourseService(() =>
      this.courseClient.countCourseChainsByInstructors(user, [instructorId]),
    );
    return counts[instructorId] ?? 0;
  }

  /** Không hỏi / chuyển được ở course-service thì không xác minh được BR-41 -> 503, không vô hiệu hóa. */
  private async callCourseService<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`UC12.5: lỗi khi gọi course-service: ${reason}`);
      throw new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message:
          'Không kiểm tra hoặc chuyển được quyền phụ trách Course lúc này. Hãy thử lại sau.',
      });
    }
  }

  private statusUnchanged(target: LockedInstructor): IInstructorStatusResult {
    return {
      id: target.id,
      status: target.status,
      changed: false,
      transferredCourses: [],
      receiver: null,
    };
  }

  private enqueueStatusEmail(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      userId: string;
      to: string;
      templateCode: string;
      subject: string;
      body: string;
    },
  ): Promise<void> {
    return this.outbox.enqueueEmail(tx, {
      aggregateType: 'User',
      aggregateId: params.userId,
      organizationId: params.organizationId,
      email: {
        to: params.to,
        subject: params.subject,
        templateCode: params.templateCode,
        body: params.body,
      },
    });
  }

  /** BR-270, BR-271: người thực hiện, loại hành động, đối tượng, thời điểm; lý do tùy chọn. */
  private enqueueStatusAudit(
    tx: Prisma.TransactionClient,
    user: CurrentUser,
    params: {
      organizationId: string;
      actionType: string;
      targetId: string;
      reason: string | undefined;
      receiverId: string | null;
      chainIds: string[];
    },
  ): Promise<void> {
    return this.outbox.enqueueAudit(tx, {
      aggregateType: 'User',
      aggregateId: params.targetId,
      record: {
        organizationId: params.organizationId,
        actorUserId: user.userId,
        actorRole: user.role,
        actionType: params.actionType,
        targetResourceType: 'User',
        targetResourceId: params.targetId,
        details: {
          ...(params.reason ? { reason: params.reason } : {}),
          receiverId: params.receiverId,
          chainIds: params.chainIds,
        },
      },
    });
  }

  /** INVALID_RECEIVER: 400 như các lỗi dữ liệu đầu vào khác của tenant (PLAN_NOT_AVAILABLE, INVALID_TIMEZONE). */
  private invalidReceiver(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_RECEIVER',
      message:
        'Instructor tiếp nhận phải cùng tổ chức, đã kích hoạt, đang hoạt động và khác người bị vô hiệu hóa.',
    });
  }

  private accountNotActivated(message: string): ConflictException {
    return new ConflictException({ code: 'ACCOUNT_NOT_ACTIVATED', message });
  }

  private courseTimeoutMs(): number {
    return (
      Number(this.config.get<string>('COURSE_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_COURSE_TIMEOUT_MS
    );
  }

  private loginLink(): string {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `${frontendUrl}/login`;
  }

  /** updateMany = 0 dòng: đọc lại để phân biệt 404 / đã kích hoạt / request khác vừa sửa. */
  private async updateConflict(
    tx: Prisma.TransactionClient,
    scope: Prisma.UserWhereInput,
    role: SeatRole,
  ): Promise<NotFoundException | ConflictException> {
    const current = await tx.user.findFirst({
      where: scope,
      select: { activatedAt: true },
    });
    if (!current) return this.accountNotFound(role);
    if (current.activatedAt !== null) return this.accountAlreadyActivated();
    return this.concurrentUpdate();
  }

  // ===========================================================================
  // UC12.3 - Gợi ý đơn vị công tác (BR-279)
  // ===========================================================================
  /**
   * Đơn vị công tác đã có trong tổ chức (Instructor + Learner chưa xóa).
   * Gom nhóm không phân biệt hoa thường, mỗi nhóm trả một giá trị đại diện; tối đa 10, theo chữ cái.
   */
  async suggestDepartments(
    user: CurrentUser,
    query: ListDepartmentsQueryDto,
  ): Promise<string[]> {
    const organizationId = this.organizationIdOf(user);
    // Escape "\", "%", "_" như findAccountPage để từ khóa không thành wildcard.
    const pattern = query.keyword?.replace(/[\\%_]/g, (char) => `\\${char}`);
    const keywordFilter = pattern
      ? Prisma.sql`AND department ILIKE '%' || ${pattern} || '%'`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ department: string }>>`
      SELECT MIN(department) AS department
      FROM users
      WHERE organization_id = ${organizationId}::uuid
        AND deleted_at IS NULL
        AND role IN (${UserRoleValue.Instructor}, ${UserRoleValue.Learner})
        AND department IS NOT NULL
        ${keywordFilter}
      GROUP BY lower(department)
      ORDER BY lower(department)
      LIMIT 10`;
    return rows.map((row) => row.department);
  }

  /**
   * Điều kiện chung trước khi thao tác tài khoản trong tổ chức (UC12.2, UC12.3, UC13.2, UC13.3).
   * BR-45: tổ chức phải Active. Subscription hiện hành phải thuộc subscriptionStatuses.
   * lockOrganization: khóa dòng tổ chức FOR UPDATE (cần khi kiểm số chỗ lúc tạo tài khoản).
   */
  private async assertCanManageAccounts(
    tx: Prisma.TransactionClient,
    organizationId: string,
    options: {
      action: string;
      subscriptionStatuses: readonly string[];
      lockOrganization: boolean;
    },
  ) {
    const lock = options.lockOrganization
      ? Prisma.sql`FOR UPDATE`
      : Prisma.empty;
    const [organization] = await tx.$queryRaw<
      Array<{ name: string; status: string }>
    >`SELECT name, status FROM organizations WHERE id = ${organizationId}::uuid ${lock}`;

    if (!organization || organization.status !== OrganizationStatus.Active) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message: `Tổ chức đang không hoạt động nên không ${options.action} được tài khoản.`,
      });
    }

    const subscription = await this.findCurrentSubscription(tx, organizationId);
    if (
      !subscription ||
      !options.subscriptionStatuses.includes(subscription.status)
    ) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        message: `Subscription không ở trạng thái hoạt động nên không ${options.action} được tài khoản.`,
      });
    }
    return { organization, subscription };
  }

  /** Thư mời kích hoạt qua outbox (UC12.2, UC12.3, UC13.2, UC13.3). Relay xóa liên kết khỏi payload sau khi gửi. */
  private enqueueInvitationEmail(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      organizationName: string;
      userId: string;
      to: string;
      fullName: string;
      role: SeatRole;
      rawToken: string;
      expiresAt: Date;
    },
  ): Promise<void> {
    return this.outbox.enqueueEmail(tx, {
      aggregateType: 'User',
      aggregateId: params.userId,
      organizationId: params.organizationId,
      email: {
        to: params.to,
        subject: `LearnUP - Lời mời tham gia ${params.organizationName}`,
        templateCode: INVITATION_TEMPLATE[params.role],
        body:
          `Xin chào ${params.fullName},\n` +
          `${params.organizationName} đã tạo cho bạn tài khoản ${params.role} trên LearnUP.\n` +
          `Mở liên kết sau để đặt mật khẩu và kích hoạt tài khoản: ${this.activationLink(params.rawToken)}\n` +
          `Liên kết có hiệu lực tới ${params.expiresAt.toISOString()}.`,
        expiresAt: params.expiresAt.toISOString(),
      },
    });
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

  private accountNotFound(role: SeatRole): NotFoundException {
    return new NotFoundException(ACCOUNT_NOT_FOUND[role]);
  }

  private accountAlreadyActivated(): ConflictException {
    return new ConflictException({
      code: 'ACCOUNT_ALREADY_ACTIVATED',
      message:
        'Tài khoản đã kích hoạt: họ tên và email do người dùng quản lý, không chỉnh sửa được.',
    });
  }

  private concurrentUpdate(): ConflictException {
    return new ConflictException({
      code: 'CONCURRENT_UPDATE',
      message: 'Tài khoản vừa được cập nhật bởi thao tác khác. Hãy tải lại.',
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

  /**
   * UC12.1: lời mời đang mở (chưa dùng, chưa thu hồi) của một tài khoản, có thể đã quá hạn.
   * Partial unique account_tokens_one_open_link_key bảo đảm tối đa một token như vậy.
   * Chỉ trả thời điểm gửi và hạn, không trả token / mã băm.
   */
  private async findOpenInvitation(
    organizationId: string,
    userId: string,
  ): Promise<InstructorInvitation | null> {
    const token = await this.prisma.accountToken.findFirst({
      where: {
        organizationId,
        userId,
        purpose: TokenPurpose.Invitation,
        consumedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, expiresAt: true },
    });
    return token
      ? { sentAt: token.createdAt, expiresAt: token.expiresAt }
      : null;
  }

  /** UC12.1: lỗi khi hỏi course-service không làm hỏng trang chi tiết: trả null, ghi cảnh báo. */
  private async listManagedCourses(
    user: CurrentUser,
    instructorId: string,
  ): Promise<IManagedCourseChain[] | null> {
    try {
      return await this.courseClient.listCourseChainsByInstructor(
        user,
        instructorId,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không lấy được danh sách Course phụ trách từ course-service: ${reason}`,
      );
      return null;
    }
  }

  /** UC12.1: URL ảnh đại diện như ProfileService; lỗi dựng URL không làm hỏng response. */
  private avatarUrl(avatarFileKey: string | null): string | null {
    if (!avatarFileKey) return null;
    try {
      return this.storage.getUrl(avatarFileKey, 'image');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Không dựng được URL ảnh đại diện: ${reason}`);
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

  /** UC13.1: lỗi khi hỏi learning-service không làm hỏng trang chi tiết: trả null, ghi cảnh báo. */
  private async listLearnerEnrollments(
    user: CurrentUser,
    learnerId: string,
  ): Promise<LearnerEnrollment[] | null> {
    try {
      return await this.learningClient.listEnrollmentsByLearner(
        user,
        learnerId,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không lấy được danh sách Course của Learner từ learning-service: ${reason}`,
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

  async findBatch(user: CurrentUser, userIds: string[]) {
    if (user.role !== 'ORGANIZER') {
      throw new ForbiddenException(
        'Only Organizer can retrieve Instructor information.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    return this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
        organizationId: user.organizationId,
        role: 'INSTRUCTOR',
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
      },
    });
  }
}
