import type { CurrentUser } from '@learnup/ts-common';
import {
  StorageProviderError,
  StorageValidationError,
  type IStorageProvider,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import {
  fileTooLarge,
  uploadLimitBytes,
} from '../../infrastructure/storage/upload-limit';
import { SUBMISSION_FILE_TYPES } from '../learner-submissions/learner-submissions.constants';
import { AssessmentsRepository } from './assessments.repository';
import {
  PROMPT_FILE_MAX_BYTES,
  promptFileFolder,
} from './assignment-media.constants';
import type { PromptFileDto } from './dto/create-assignment.dto';

/** Prompt file of an Assignment (BR-320): upload, read and removal against the shared storage. */
@Injectable()
export class AssignmentMediaService {
  private readonly logger = new Logger(AssignmentMediaService.name);

  /**
   * Look at the stored file with a HEAD request. A test replaces it; so does PROMPT_FILE_VERIFY=off (dev and
   * integration tests that never reach the storage).
   */
  head: (url: string) => Promise<Response | null> = (url) =>
    fetch(url, { method: 'HEAD' }).catch(() => null);

  private readonly verifyFiles: boolean;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly repository: AssessmentsRepository,
    @Optional() config?: ConfigService,
  ) {
    this.verifyFiles = config?.get<string>('PROMPT_FILE_VERIFY') !== 'off';
  }

  /** UC19.2 / UC19.3 — store the prompt file; the returned object goes into `promptFile` of create/update. */
  async uploadPromptFile(
    user: CurrentUser,
    file?: { buffer: Buffer; originalname: string; size: number },
  ): Promise<PromptFileDto> {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an Instructor can manage Assignments.',
      });
    }
    if (!file) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_REQUIRED',
        message: 'Hãy gửi một tệp PDF, DOCX hoặc ZIP trong trường "file".',
      });
    }
    const limit = uploadLimitBytes(PROMPT_FILE_MAX_BYTES);
    if (file.size > limit) throw fileTooLarge(limit);
    // multer reads the name as latin1; turn it back into UTF-8 so accented names survive.
    const fileName = Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .split(/[\\/]/)
      .pop()!
      .slice(0, 255);
    // The browser-reported type can be anything, so judge the extension and the first bytes (same types as a submission).
    const type =
      SUBMISSION_FILE_TYPES[fileName.split('.').pop()?.toLowerCase() ?? ''];
    if (
      !type ||
      !file.buffer.subarray(0, type.signature.length).equals(type.signature)
    ) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_INVALID',
        message: 'Tệp đề bài phải là PDF, DOCX hoặc ZIP.',
      });
    }

    try {
      const stored = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: fileName,
          mimeType: type.mimeType,
          sizeBytes: file.size,
        },
        {
          folder: promptFileFolder(user.organizationId),
          resourceType: 'raw',
          validation: {
            maxSizeBytes: limit,
            allowedMimeTypes: [type.mimeType],
          },
        },
      );
      return {
        fileKey: stored.storageKey,
        fileName,
        mimeType: type.mimeType,
        sizeBytes: stored.sizeBytes,
      };
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException({
          code: 'PROMPT_FILE_INVALID',
          message: error.message,
        });
      }
      if (error instanceof StorageProviderError && error.code === 'TOO_LARGE') {
        throw fileTooLarge(limit);
      }
      if (error instanceof StorageProviderError) {
        this.logger.error(
          `Prompt file upload failed: ${error.message} ${JSON.stringify(error.cause, Object.getOwnPropertyNames(Object(error.cause)))}`,
        );
        throw new ServiceUnavailableException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'Unable to store the prompt file. Try again later.',
        });
      }
      throw error;
    }
  }

  /** Only keys of this Organization's prompt folder are accepted (they come from uploadPromptFile); the type is one of PDF, DOCX or ZIP. */
  resolvePromptFile(
    organizationId: string,
    file: PromptFileDto,
  ): PromptFileDto {
    if (
      file.fileKey.includes('..') ||
      !file.fileKey.startsWith(`${promptFileFolder(organizationId)}/`)
    ) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file was not uploaded. Upload it first.',
      });
    }
    const limit = uploadLimitBytes(PROMPT_FILE_MAX_BYTES);
    if (file.sizeBytes > limit) throw fileTooLarge(limit);
    // The type in the request is not trusted: it follows the extension of the file name, as at upload.
    const type =
      SUBMISSION_FILE_TYPES[file.fileName.split('.').pop()?.toLowerCase() ?? ''];
    if (!type) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_INVALID',
        message: 'Tệp đề bài phải là PDF, DOCX hoặc ZIP.',
      });
    }
    return { ...file, mimeType: type.mimeType };
  }

  /**
   * UC19.2 / UC19.3 — the Instructor cancelled or replaced a file that was uploaded but not saved: remove it from the
   * storage. Only a file of the own Organization that no Assignment uses is removed, so a saved file is never lost.
   */
  async discardPromptFile(
    user: CurrentUser,
    fileKey: string,
  ): Promise<{ fileKey: string }> {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an Instructor can manage Assignments.',
      });
    }
    if (
      fileKey.includes('..') ||
      !fileKey.startsWith(`${promptFileFolder(user.organizationId)}/`)
    ) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file was not uploaded.',
      });
    }
    if (await this.repository.isPromptFileInUse(fileKey)) {
      throw new ConflictException({
        code: 'PROMPT_FILE_IN_USE',
        message: 'The prompt file belongs to an Assignment, so it was kept.',
      });
    }
    try {
      await this.storage.delete(fileKey, { resourceType: 'raw' });
    } catch (error) {
      this.logger.warn(`Prompt file ${fileKey} was not removed: ${String(error)}`);
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Unable to remove the prompt file. Try again later.',
      });
    }
    return { fileKey };
  }

  /**
   * UC19.2 / UC19.3 — before a file is attached, make sure it really is in the storage and take its size from there:
   * the name, type and size in the request come from the client and are not to be trusted (BR-320).
   */
  async confirmPromptFile(
    organizationId: string,
    file: PromptFileDto,
  ): Promise<PromptFileDto> {
    const resolved = this.resolvePromptFile(organizationId, file);
    if (!this.verifyFiles) return resolved;

    const response = await this.head(this.storage.getUrl(file.fileKey, 'raw'));
    if (!response || response.status >= 500) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Unable to check the prompt file. Try again later.',
      });
    }
    if (!response.ok) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file was not uploaded. Upload it first.',
      });
    }
    const storedSize = Number(response.headers.get('content-length'));
    if (!Number.isFinite(storedSize) || storedSize <= 0) return resolved;
    const limit = uploadLimitBytes(PROMPT_FILE_MAX_BYTES);
    if (storedSize > limit) throw fileTooLarge(limit);
    return { ...resolved, sizeBytes: storedSize };
  }

  /** UC19.1 — the stored file of an Assignment the caller already proved to manage. */
  async readPromptFile(fileKey: string): Promise<Buffer> {
    // The file lives in Cloudinary; fetch it here so the browser keeps talking to this service only.
    const response = await fetch(this.storage.getUrl(fileKey, 'raw')).catch(
      () => null,
    );
    if (!response) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Unable to read the prompt file. Try again later.',
      });
    }
    if (!response.ok) {
      throw new NotFoundException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file is no longer available.',
      });
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Best effort: the row is already gone or changed, so a storage failure is only logged (the file stays as an orphan).
   * A key another Assignment still uses is kept (a new Course version may share the file, BR-100).
   */
  async removeIfUnused(fileKey: string, exceptAssignmentId: string) {
    try {
      const others = await this.repository.countOtherUsersOfFile(
        fileKey,
        exceptAssignmentId,
      );
      if (others === 0) {
        await this.storage.delete(fileKey, { resourceType: 'raw' });
      }
    } catch (error) {
      this.logger.warn(
        `Prompt file ${fileKey} was not removed: ${String(error)}`,
      );
    }
  }
}
