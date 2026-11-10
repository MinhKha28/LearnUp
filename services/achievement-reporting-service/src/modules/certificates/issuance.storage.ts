import { createHash } from 'node:crypto';
import { v7 } from 'uuid';
import { CloudinaryStorageProvider, resolveStoragePlanLimits } from '@learnup/ts-storage';
import type {
  AssetSnapshot,
  PendingCertificate,
} from './certificates.repository';
import type { LogoBytes } from './issuance.clients';
import { IssuanceError } from './issuance.config';
export interface IssuanceStorage {
  isConfigured(): boolean;
  upload(
    row: Pick<PendingCertificate, 'organization_id'>,
    image: LogoBytes,
    key: string,
  ): Promise<AssetSnapshot>;
  delete(key: string): Promise<void>;
  read(
    key: string,
    mime: string,
    timeoutMs: number,
    maxSizeBytes: number,
  ): Promise<Buffer>;
}
export const ISSUANCE_STORAGE = Symbol('ISSUANCE_STORAGE');
export const logoKey = (row: PendingCertificate) =>
  `achievement/${row.organization_id}/certificates/${row.id}/logo/${v7()}`;
export class CloudinaryIssuanceStorage implements IssuanceStorage {
  private readonly provider?: CloudinaryStorageProvider;
  constructor(get: (key: string) => string | undefined) {
    const cloudName = get('CLOUDINARY_CLOUD_NAME')?.trim(),
      apiKey = get('CLOUDINARY_API_KEY')?.trim(),
      apiSecret = get('CLOUDINARY_API_SECRET')?.trim();
    if (cloudName && apiKey && apiSecret)
      this.provider = new CloudinaryStorageProvider({
        cloudName,
        apiKey,
        apiSecret,
        secure: true,
        planLimits: resolveStoragePlanLimits(process.env),
      });
  }
  isConfigured(): boolean {
    return this.provider !== undefined;
  }
  async upload(
    _row: Pick<PendingCertificate, 'organization_id'>,
    image: LogoBytes,
    key: string,
  ): Promise<AssetSnapshot> {
    if (!this.provider) throw new IssuanceError('CLOUDINARY_UNCONFIGURED');
    try {
      const slash = key.lastIndexOf('/');
      const result = await this.provider.upload(
        {
          buffer: image.bytes,
          originalFilename: 'certificate-image',
          mimeType: image.mime,
          sizeBytes: image.bytes.length,
        },
        {
          folder: key.slice(0, slash),
          publicId: key.slice(slash + 1),
          resourceType: 'image',
          deliveryType: 'authenticated',
          overwrite: false,
        },
      );
      if (result.storageKey !== key) {
        // The returned key belongs to this upload; remove it before reporting a folder-mode mismatch.
        // Both deleted and not_found complete cleanup for this authenticated asset.
        await this.provider.delete(result.storageKey, {
          resourceType: 'image',
          deliveryType: 'authenticated',
        });
        throw new IssuanceError('CLOUDINARY_KEY_MISMATCH');
      }
      return {
        key,
        hash: createHash('sha256').update(image.bytes).digest('hex'),
        mime: image.mime,
        size: image.bytes.length,
      };
    } catch (error) {
      if (error instanceof IssuanceError) throw error;
      throw new IssuanceError('CLOUDINARY_UNAVAILABLE');
    }
  }
  async read(
    key: string,
    mime: string,
    timeoutMs: number,
    maxSizeBytes: number,
  ): Promise<Buffer> {
    if (!this.provider) throw new IssuanceError('CLOUDINARY_UNCONFIGURED');
    if (mime !== 'image/png' && mime !== 'image/jpeg')
      throw new IssuanceError('UNSUPPORTED_IMAGE_TYPE');
    return this.provider.readBytes(key, {
      deliveryType: 'authenticated',
      resourceType: 'image',
      format: mime === 'image/png' ? 'png' : 'jpg',
      expiresAt:
        Math.floor(Date.now() / 1000) + Math.ceil(timeoutMs / 1000) + 60,
      timeoutMs,
      maxSizeBytes,
    });
  }
  async delete(key: string): Promise<void> {
    if (!this.provider) throw new IssuanceError('CLOUDINARY_UNCONFIGURED');
    try {
      // Both deleted and not_found mean this exact authenticated asset is absent.
      await this.provider.delete(key, {
        resourceType: 'image',
        deliveryType: 'authenticated',
      });
    } catch {
      throw new IssuanceError('CLOUDINARY_CLEANUP_FAILED');
    }
  }
}
