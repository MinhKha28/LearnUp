import {
  StorageProviderError,
  StorageValidationError,
  STORAGE_MIME_TYPES,
  type IStorageProvider,
  type IStoredFile,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import { IProfile } from './interfaces/profile.interface';
import { IUploadedImage } from './interfaces/uploaded-image.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileRepository } from './profile.repository';

export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly profileRepository: ProfileRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  async getMine(userId: string): Promise<IProfile> {
    const user = await this.findUserOrThrow(userId);
    return this.toProfile(user);
  }

  async updateMine(userId: string, dto: UpdateProfileDto): Promise<IProfile> {
    await this.findUserOrThrow(userId);
    await this.profileRepository.updateFullName(userId, dto.fullName);
    return this.getMine(userId);
  }

  async replaceAvatar(
    userId: string,
    file: IUploadedImage | undefined,
  ): Promise<IProfile> {
    if (!file) {
      throw new BadRequestException({
        code: 'AVATAR_REQUIRED',
        message: 'Vui lòng chọn ảnh đại diện.',
      });
    }
    const user = await this.findUserOrThrow(userId);

    let stored: IStoredFile;
    try {
      stored = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        {
          folder: `learnup/${user.organizationId ?? 'platform'}/avatars`,
          resourceType: 'image',
          validation: {
            maxSizeBytes: AVATAR_MAX_SIZE_BYTES,
            allowedMimeTypes: STORAGE_MIME_TYPES.IMAGE,
          },
        },
      );
    } catch (error) {
      throw this.toUploadException(error);
    }

    await this.profileRepository.updateAvatarKey(userId, stored.storageKey);
    await this.deleteStoredAvatar(user.avatarFileKey);
    return this.getMine(userId);
  }

  async removeAvatar(userId: string): Promise<IProfile> {
    const user = await this.findUserOrThrow(userId);
    if (user.avatarFileKey) {
      await this.profileRepository.updateAvatarKey(userId, null);
      await this.deleteStoredAvatar(user.avatarFileKey);
    }
    return this.getMine(userId);
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.profileRepository.findActiveUser(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Không tìm thấy tài khoản.',
      });
    }
    return user;
  }

  private toProfile(
    user: NonNullable<Awaited<ReturnType<ProfileRepository['findActiveUser']>>>,
  ): IProfile {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      department: user.department,
      organizationId: user.organizationId,
      organizationName: user.organization?.name ?? null,
      avatarUrl: this.avatarUrl(user.avatarFileKey),
      activatedAt: user.activatedAt,
    };
  }

  private avatarUrl(avatarFileKey: string | null): string | null {
    if (!avatarFileKey) return null;
    try {
      return this.storage.getUrl(avatarFileKey, 'image');
    } catch {
      return null;
    }
  }

  private async deleteStoredAvatar(avatarFileKey: string | null) {
    if (!avatarFileKey) return;
    try {
      await this.storage.delete(avatarFileKey, { resourceType: 'image' });
    } catch (error) {
      this.logger.warn(
        `Could not delete old avatar ${avatarFileKey}: ${(error as Error).message}`,
      );
    }
  }

  private toUploadException(error: unknown) {
    if (error instanceof StorageValidationError) {
      return new BadRequestException({
        code: 'AVATAR_INVALID',
        message: 'Ảnh đại diện phải là JPG, PNG hoặc WEBP và không quá 2 MB.',
      });
    }
    if (error instanceof StorageProviderError) {
      return new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Không tải được ảnh lúc này. Vui lòng thử lại sau.',
      });
    }
    return error;
  }
}
