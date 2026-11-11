import type { CurrentUser, PageResponse } from '@learnup/ts-common';
import { createPageResponse } from '@learnup/ts-common';
import {
  StorageProviderError,
  StorageValidationError,
  type IStorageProvider,
  type IStoredFile,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import {
  DAY_MS,
  OrganizationStatus,
  RegistrationStatus,
  SubscriptionStatus,
  UserRoleValue,
} from '../../common/constants/tenant.constants';
import { isIanaTimezone } from '../../common/utils/timezone.util';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import type { IOrganizationCourseUsage } from '../../infrastructure/clients/course/interfaces/organization-course-usage.interface';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import type { IUsageItem } from '../subscriptions/interfaces/subscription-overview.interface';
import { IAdminOrganizationDetail } from './interfaces/admin-organization-detail.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import {
  fileTooLarge,
  imageUploadLimitBytes,
} from '../../infrastructure/storage/upload-limit';
import type { IUploadedImage } from '../profile/interfaces/uploaded-image.interface';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import { IAdminOrganizationListItem } from './interfaces/admin-organization-list-item.interface';
import { IOrganizationProfile } from './interfaces/organization-profile.interface';
import {
  AdminOrganizationRow,
  OrganizationsRepository,
} from './organizations.repository';

export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
const WRITABLE_SUBSCRIPTION_STATUSES: readonly string[] = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Grace,
];
const PROFILE_FIELDS = [
  'name',
  'taxCode',
  'address',
  'contactPhone',
  'contactEmail',
  'timezone',
] as const;

// UC44.1 - BR-54: số Organization trùng mã số thuế liệt kê tối đa.
const DUPLICATE_TAX_CODE_LIMIT = 10;

/** Cùng cách tính với UC15 (subscriptions.service.ts): used = null khi không đếm được. */
function usageItem(
  used: number | null,
  limit: number,
  threshold: number,
): IUsageItem {
  if (used === null) {
    return { used: null, limit, percent: null, warning: false };
  }
  const percent =
    limit > 0 ? Math.round((used / limit) * 100) : used > 0 ? 100 : 0;
  return { used, limit, percent, warning: percent >= threshold };
}

type ProfileRow = NonNullable<
  Awaited<ReturnType<OrganizationsRepository['findProfile']>>
>;

/** PNG và JPEG nhận theo chữ ký đầu tệp, không tin MIME do trình duyệt gửi (#148: PDF Certificate chỉ vẽ được hai loại này). */
export function detectLogoType(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  return null;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: OrganizationsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly settingsService: PlatformSettingsService,
    private readonly courseService: CourseServiceClient,
  ) {}

  // ===========================================================================
  // UC44 - Xem danh sách Organization (Admin; BR-8, BR-12, BR-60)
  // ===========================================================================
  async findAllForAdmin(
    query: ListOrganizationsQueryDto,
  ): Promise<PageResponse<IAdminOrganizationListItem>> {
    const { page, pageSize, includeCancelled } = query;
    const now = new Date();
    const { rows, total } = await this.repository.findAdminPage({
      includeCancelled,
      now,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const items = rows.map((row) => this.toAdminListItem(row, now));
    return createPageResponse(items, page, pageSize, total);
  }

  /**
   * Trạng thái Organization và Subscription là hai trường riêng (BR-60).
   * PendingPayment mà đăng ký mới nhất không còn chờ thanh toán trong hạn thì tính là Cancelled (BR-8).
   */
  private toAdminListItem(
    row: AdminOrganizationRow,
    now: Date,
  ): IAdminOrganizationListItem {
    const subscription = row.subscriptions[0] ?? null;
    const registration = row.registrations[0] ?? null;
    const status = this.effectiveStatus(row.status, registration, now);
    const neverActivated =
      status === OrganizationStatus.PendingPayment ||
      status === OrganizationStatus.Cancelled;

    return {
      id: row.id,
      name: row.name,
      contactEmail: row.contactEmail,
      status,
      plan:
        subscription?.plan ??
        (neverActivated ? (registration?.plan ?? null) : null),
      subscription: subscription
        ? {
            status: subscription.status,
            startsAt: subscription.startsAt,
            expiresAt: subscription.expiresAt,
            graceEndsAt: subscription.graceEndsAt,
          }
        : null,
      paymentDueAt:
        status === OrganizationStatus.PendingPayment && registration
          ? registration.expiresAt
          : null,
      createdAt: row.createdAt,
    };
  }

  /** BR-8: PendingPayment mà đăng ký mới nhất không còn chờ thanh toán trong hạn thì tính là Cancelled. */
  private effectiveStatus(
    status: string,
    registration: { status: string; expiresAt: Date } | null,
    now: Date,
  ): string {
    if (status !== OrganizationStatus.PendingPayment) return status;
    const awaitingPayment =
      registration?.status === RegistrationStatus.PendingPayment &&
      registration.expiresAt.getTime() > now.getTime();
    return awaitingPayment ? status : OrganizationStatus.Cancelled;
  }

  // ===========================================================================
  // UC44.1 - Xem chi tiết Organization (Admin; BR-1, BR-50, BR-52, BR-56, BR-54, BR-188)
  // ===========================================================================
  /**
   * Chỉ đọc: không ghi DB, không phát event, không ghi audit.
   * Số Course và dung lượng do course-service đếm (BR-1, BR-188); hỏi không được thì vẫn trả các phần
   * khác, đánh dấu courseUsageAvailable = false.
   */
  async findOneForAdmin(
    organizationId: string,
  ): Promise<IAdminOrganizationDetail> {
    const row = await this.repository.findAdminDetail(organizationId);
    if (!row) throw this.notFound();

    const now = new Date();
    const current = row.subscriptions[0] ?? null;
    const registration = row.registrations[0] ?? null;
    const status = this.effectiveStatus(row.status, registration, now);
    const neverActivated =
      status === OrganizationStatus.PendingPayment ||
      status === OrganizationStatus.Cancelled;

    const [duplicates, settings, usage] = await Promise.all([
      this.repository.findDuplicateTaxCodes(
        row.id,
        row.taxCode,
        DUPLICATE_TAX_CODE_LIMIT,
      ),
      this.settingsService.get(),
      // D5: chưa có Subscription hiện hành thì không có giới hạn để so -> không đếm.
      current ? this.loadUsage(row.id) : Promise.resolve(null),
    ]);
    const threshold = settings.usageWarningThresholdPercent;
    const organizer = row.users[0] ?? null;
    const invitation = organizer?.accountTokens[0] ?? null;

    return {
      id: row.id,
      name: row.name,
      taxCode: row.taxCode,
      address: row.address,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      logoUrl: this.logoUrl(row.logoFileKey),
      timezone: row.timezone,
      status,
      createdAt: row.createdAt,
      organizer: organizer
        ? {
            id: organizer.id,
            fullName: organizer.fullName,
            email: organizer.email,
            status: organizer.status,
            activatedAt: organizer.activatedAt,
            invitation: invitation
              ? {
                  sentAt: invitation.createdAt,
                  expiresAt: invitation.expiresAt,
                  expired: invitation.expiresAt.getTime() <= now.getTime(),
                }
              : null,
          }
        : null,
      plan:
        current?.plan ?? (neverActivated ? (registration?.plan ?? null) : null),
      subscription: current
        ? {
            plan: current.plan,
            status: current.status,
            startsAt: current.startsAt,
            expiresAt: current.expiresAt,
            graceEndsAt: current.graceEndsAt,
            readOnlyEndsAt: current.readOnlyEndsAt,
            daysRemaining: Math.max(
              0,
              Math.ceil((current.expiresAt.getTime() - now.getTime()) / DAY_MS),
            ),
          }
        : null,
      paymentDueAt:
        status === OrganizationStatus.PendingPayment && registration
          ? registration.expiresAt
          : null,
      usageWarningThresholdPercent: threshold,
      usage:
        current && usage
          ? {
              courseUsageAvailable: usage.course !== null,
              learners: usageItem(
                usage.learners,
                current.maxLearners,
                threshold,
              ),
              instructors: usageItem(
                usage.instructors,
                current.maxInstructors,
                threshold,
              ),
              courses: usageItem(
                usage.course?.courseChains ?? null,
                current.maxCourseChains,
                threshold,
              ),
              storageBytes: usageItem(
                usage.course?.storageBytes ?? null,
                Number(current.maxStorageBytes),
                threshold,
              ),
            }
          : null,
      suspensions: row.suspensions,
      duplicateTaxCode: {
        count: duplicates.total,
        organizations: duplicates.rows.map((dup) => ({
          id: dup.id,
          name: dup.name,
          status: this.effectiveStatus(
            dup.status,
            dup.registrations[0] ?? null,
            now,
          ),
        })),
      },
    };
  }

  /** Learner / Instructor do tenant đếm; Course và dung lượng hỏi course-service (lỗi -> null). */
  private async loadUsage(organizationId: string): Promise<{
    learners: number;
    instructors: number;
    course: IOrganizationCourseUsage | null;
  }> {
    const [learners, instructors, course] = await Promise.all([
      this.repository.countSeats(organizationId, UserRoleValue.Learner),
      this.repository.countSeats(organizationId, UserRoleValue.Instructor),
      this.courseService
        .getOrganizationUsageById(organizationId)
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Không lấy được mức dùng Course/dung lượng của ${organizationId}: ${reason}`,
          );
          return null;
        }),
    ]);
    return { learners, instructors, course };
  }

  // ===========================================================================
  // UC11 - Xem thông tin Organization (BR-52)
  // ===========================================================================
  async getMine(user: CurrentUser): Promise<IOrganizationProfile> {
    const organization = await this.repository.findProfile(
      this.organizationIdOf(user),
    );
    if (!organization) throw this.notFound();
    return this.toProfile(organization);
  }

  // ===========================================================================
  // UC11.1 - Cập nhật thông tin Organization (BR-52, BR-55)
  // ===========================================================================
  /**
   * Đổi múi giờ chỉ áp dụng cho mốc xác định sau thời điểm đổi (BR-55): learning lưu múi giờ trên từng hạn,
   * achievement lưu trên từng Certificate, nên ở đây chỉ cần ghi giá trị mới.
   */
  async updateMine(
    user: CurrentUser,
    dto: UpdateOrganizationProfileDto,
  ): Promise<IOrganizationProfile> {
    const organizationId = this.organizationIdOf(user);
    const data: Prisma.OrganizationUpdateInput = {};
    for (const field of PROFILE_FIELDS) {
      if (dto[field] !== undefined)
        Object.assign(data, { [field]: dto[field] });
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'NO_FIELDS_TO_UPDATE',
        message: 'Cần gửi ít nhất một trường để cập nhật.',
      });
    }
    if (dto.timezone !== undefined) {
      const timezone = isIanaTimezone(dto.timezone)
        ? await this.repository.findCanonicalTimezone(dto.timezone)
        : null;
      if (!timezone) {
        throw new BadRequestException({
          code: 'INVALID_TIMEZONE',
          message: 'Múi giờ phải là tên IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.',
        });
      }
      data.timezone = timezone;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertWritable(organizationId, tx);
      return this.repository.updateProfile(organizationId, data, tx);
    });
    return this.toProfile(updated);
  }

  /** UC11.1: logo PNG/JPEG tối đa 2 MB; không tính vào dung lượng Subscription (BR-188). Tệp cũ bị xóa sau khi lưu. */
  async replaceLogo(
    user: CurrentUser,
    file: IUploadedImage | undefined,
  ): Promise<IOrganizationProfile> {
    const organizationId = this.organizationIdOf(user);
    if (!file) {
      throw new BadRequestException({
        code: 'LOGO_REQUIRED',
        message: 'Vui lòng chọn tệp logo.',
      });
    }
    const limit = imageUploadLimitBytes(LOGO_MAX_SIZE_BYTES);
    if (file.size > limit) throw fileTooLarge(limit);
    const mimeType = detectLogoType(file.buffer);
    if (!mimeType) throw this.invalidLogo();
    await this.prisma.$transaction((tx) =>
      this.assertWritable(organizationId, tx),
    );

    let stored: IStoredFile;
    try {
      stored = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType,
          sizeBytes: file.size,
        },
        {
          folder: `learnup/${organizationId}/logos`,
          resourceType: 'image',
          validation: {
            maxSizeBytes: limit,
            allowedMimeTypes: [...LOGO_MIME_TYPES],
          },
        },
      );
    } catch (error) {
      throw this.toUploadException(error, limit);
    }

    let previousKey: string | null = null;
    let updated: ProfileRow;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await this.assertWritable(organizationId, tx);
        previousKey =
          (await this.repository.findProfile(organizationId, tx))
            ?.logoFileKey ?? null;
        return this.repository.updateProfile(
          organizationId,
          { logoFileKey: stored.storageKey },
          tx,
        );
      });
    } catch (error) {
      await this.deleteStoredLogo(stored.storageKey);
      throw error;
    }
    await this.deleteStoredLogo(previousKey);
    return this.toProfile(updated);
  }

  async removeLogo(user: CurrentUser): Promise<IOrganizationProfile> {
    const organizationId = this.organizationIdOf(user);
    let previousKey: string | null = null;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertWritable(organizationId, tx);
      previousKey =
        (await this.repository.findProfile(organizationId, tx))?.logoFileKey ??
        null;
      return this.repository.updateProfile(
        organizationId,
        { logoFileKey: null },
        tx,
      );
    });
    await this.deleteStoredLogo(previousKey);
    return this.toProfile(updated);
  }

  /** Khóa dòng tổ chức; chỉ sửa khi tổ chức Active và Subscription Active hoặc Grace (BR-24: Suspended chỉ xem). */
  private async assertWritable(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const organization = await this.repository.lockOrganization(
      organizationId,
      tx,
    );
    if (!organization) throw this.notFound();
    if (organization.status !== OrganizationStatus.Active) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message:
          'Tổ chức đang không hoạt động nên không cập nhật được thông tin.',
      });
    }
    const subscription = await this.repository.findCurrentSubscriptionStatus(
      organizationId,
      tx,
    );
    if (
      !subscription ||
      !WRITABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)
    ) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        message:
          'Subscription đang tạm ngưng nên thông tin tổ chức chỉ xem được.',
      });
    }
  }

  private toProfile(organization: ProfileRow): IOrganizationProfile {
    const { logoFileKey, ...profile } = organization;
    return { ...profile, logoUrl: this.logoUrl(logoFileKey) };
  }

  private logoUrl(logoFileKey: string | null): string | null {
    if (!logoFileKey) return null;
    try {
      return this.storage.getUrl(logoFileKey, 'image');
    } catch {
      return null;
    }
  }

  private async deleteStoredLogo(logoFileKey: string | null) {
    if (!logoFileKey) return;
    try {
      await this.storage.delete(logoFileKey, { resourceType: 'image' });
    } catch (error) {
      this.logger.warn(
        `Could not delete logo ${logoFileKey}: ${(error as Error).message}`,
      );
    }
  }

  private invalidLogo(): BadRequestException {
    return new BadRequestException({
      code: 'LOGO_INVALID',
      message: 'Logo phải là ảnh PNG hoặc JPEG.',
    });
  }

  private toUploadException(error: unknown, limit: number) {
    if (error instanceof StorageValidationError) return this.invalidLogo();
    if (error instanceof StorageProviderError && error.code === 'TOO_LARGE') {
      return fileTooLarge(limit);
    }
    if (error instanceof StorageProviderError) {
      return new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Không tải được logo lúc này. Vui lòng thử lại sau.',
      });
    }
    return error;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'ORGANIZATION_NOT_FOUND',
      message: 'Không tìm thấy tổ chức.',
    });
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) throw this.notFound();
    return user.organizationId;
  }
}
