import {
  CloudinaryStorageProvider,
  resolveStoragePlanLimits,
  StorageProviderError,
  type IStorageDeleteResult,
  type IStoredFile,
  IReadableStorageProvider,
  IStorageSignedUrlOptions,
} from '@learnup/ts-storage';
import { ConfigService } from '@nestjs/config';

class UnconfiguredStorageProvider implements IReadableStorageProvider {
  upload(): Promise<IStoredFile> {
    return Promise.reject(
      new StorageProviderError(
        'Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable file uploads.',
      ),
    );
  }

  delete(): Promise<IStorageDeleteResult> {
    return Promise.reject(
      new StorageProviderError('Cloudinary credentials are not configured.'),
    );
  }

  getUrl(): string {
    throw new StorageProviderError(
      'Cloudinary credentials are not configured.',
    );
  }

  getSignedUrl(
    _storageKey: string,
    _options: IStorageSignedUrlOptions,
  ): string {
    throw new StorageProviderError(
      'Cloudinary credentials are not configured.',
    );
  }

  readBytes(): Promise<Buffer> {
    return Promise.reject(
      new StorageProviderError('Cloudinary credentials are not configured.'),
    );
  }
}

export const createStorageProvider = (
  configService: ConfigService,
): IReadableStorageProvider => {
  const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
  const apiKey = configService.get<string>('CLOUDINARY_API_KEY')?.trim();
  const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET')?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('[Storage] Cloudinary configuration missing', {
      cloudNameConfigured: !!cloudName,
      apiKeyConfigured: !!apiKey,
      apiSecretConfigured: !!apiSecret,
    });

    return new UnconfiguredStorageProvider();
  }

  console.log('[Storage] CloudinaryStorageProvider initialized');

  return new CloudinaryStorageProvider({
    cloudName,
    apiKey,
    apiSecret,
    secure: true,
        planLimits: resolveStoragePlanLimits(process.env),
  });
};
