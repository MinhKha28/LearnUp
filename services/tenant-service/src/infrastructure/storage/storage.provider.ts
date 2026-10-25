import {
  CloudinaryStorageProvider,
  StorageProviderError,
  type IStorageProvider,
  type IStorageFileInput,
  type IStorageUploadOptions,
  type IStorageDeleteOptions,
  type IStorageDeleteResult,
  type IStoredFile,
  type StoredResourceType,
} from '@learnup/ts-storage';
import { ConfigService } from '@nestjs/config';

class UnconfiguredStorageProvider implements IStorageProvider {
  async upload(
    _file: IStorageFileInput,
    _options: IStorageUploadOptions,
  ): Promise<IStoredFile> {
    throw new StorageProviderError(
      'Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable file uploads.',
    );
  }

  async delete(
    _storageKey: string,
    _options: IStorageDeleteOptions,
  ): Promise<IStorageDeleteResult> {
    throw new StorageProviderError(
      'Cloudinary credentials are not configured.',
    );
  }

  getUrl(_storageKey: string, _resourceType: StoredResourceType): string {
    throw new StorageProviderError(
      'Cloudinary credentials are not configured.',
    );
  }
}

export const createStorageProvider = (
  configService: ConfigService,
): IStorageProvider => {
  const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
  const apiKey = configService.get<string>('CLOUDINARY_API_KEY')?.trim();
  const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET')?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return new UnconfiguredStorageProvider();
  }

  return new CloudinaryStorageProvider({
    cloudName,
    apiKey,
    apiSecret,
    secure: true,
  });
};
