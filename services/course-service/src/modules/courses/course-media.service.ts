import type { CurrentUser } from '@learnup/ts-common';
import {
  IStoredFile,
  StorageProviderError,
  StorageValidationError,
  type IStorageProvider,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { STORAGE_PROVIDER } from '@infra/storage/storage.constants';
import {
  COURSE_COVER_MAX_SIZE_BYTES,
  COURSE_COVER_MIME_TYPES,
} from './course-media.constants';

@Injectable()
export class CourseMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  async uploadCover(user: CurrentUser, file?: Express.Multer.File) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can upload Course cover.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    if (!file) {
      throw new BadRequestException('Course cover file is required.');
    }

    let storedFile: IStoredFile;

    try {
      storedFile = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        {
          folder: `learnup/${user.organizationId}/courses/covers`,
          resourceType: 'image',
          validation: {
            maxSizeBytes: COURSE_COVER_MAX_SIZE_BYTES,
            allowedMimeTypes: COURSE_COVER_MIME_TYPES,
          },
        },
      );
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof StorageProviderError) {
        throw new ServiceUnavailableException('Unable to upload Course cover.');
      }

      throw error;
    }

    try {
      const mediaFile = await this.prisma.mediaFile.create({
        data: {
          organizationId: user.organizationId,
          purpose: 'CourseCover',
          status: 'Ready',
          storageKey: storedFile.storageKey,
          originalFilename: storedFile.originalFilename,
          mimeType: storedFile.mimeType,
          sizeBytes: BigInt(storedFile.sizeBytes),
          readyAt: new Date(),
        },
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
        },
      });

      return {
        fileId: mediaFile.id,
        url: storedFile.secureUrl,
        originalFilename: mediaFile.originalFilename,
        mimeType: mediaFile.mimeType,
        sizeBytes: Number(mediaFile.sizeBytes),
      };
    } catch (error) {
      await this.storage
        .delete(storedFile.storageKey, {
          resourceType: storedFile.resourceType,
        })
        .catch(() => undefined);

      throw error;
    }
  }
}
