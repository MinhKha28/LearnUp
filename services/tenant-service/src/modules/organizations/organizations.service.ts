import type { CurrentUser } from '@learnup/ts-common';
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
  OrganizationStatus,
  SubscriptionStatus,
} from '../../common/constants/tenant.constants';
import { isIanaTimezone } from '../../common/utils/timezone.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import type { IUploadedImage } from '../profile/interfaces/uploaded-image.interface';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import { IOrganizationProfile } from './interfaces/organization-profile.interface';
import { OrganizationsRepository } from './organizations.repository';

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
  ) {}

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
    if (dto.timezone !== undefined && !isIanaTimezone(dto.timezone)) {
      throw new BadRequestException({
        code: 'INVALID_TIMEZONE',
        message: 'Múi giờ phải là tên IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.',
      });
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
    const mimeType = detectLogoType(file.buffer);
    if (!mimeType || file.size > LOGO_MAX_SIZE_BYTES) throw this.invalidLogo();
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
            maxSizeBytes: LOGO_MAX_SIZE_BYTES,
            allowedMimeTypes: [...LOGO_MIME_TYPES],
          },
        },
      );
    } catch (error) {
      throw this.toUploadException(error);
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
      message: 'Logo phải là ảnh PNG hoặc JPEG và không quá 2 MB.',
    });
  }

  private toUploadException(error: unknown) {
    if (error instanceof StorageValidationError) return this.invalidLogo();
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
