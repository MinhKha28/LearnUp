import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { v7 } from 'uuid';
import { isUUID } from 'class-validator';
import type { CurrentUser } from '@learnup/ts-common';
import { SignerRepository, type SignerSetting } from './signer.repository';
import { SignerAccess } from './signer.access';
import { SIGNER_CONFIG, type SignerConfig } from './signer.config';
import { ISSUANCE_CONFIG, type IssuanceConfig } from './issuance.config';
import { ISSUANCE_STORAGE, type IssuanceStorage } from './issuance.storage';
import type { AssetSnapshot } from './certificates.repository';
import {
  expectedVersion,
  fail,
  validateSigner,
  SIGNATURE_MAX_BYTES,
  type UploadedSignature,
} from './signer.validation';
export function signerResponse(s: SignerSetting | null) {
  return {
    configured: Boolean(s),
    signerName: s?.signer_name ?? null,
    signerTitle: s?.signer_title ?? null,
    signature: s?.signature_asset_key
      ? { mimeType: s.signature_mime, sizeBytes: s.signature_size_bytes }
      : null,
    version: s?.version ?? 0,
    updatedAt: s?.updated_at.toISOString() ?? null,
  };
}
@Injectable()
export class SignerService {
  private readonly logger = new Logger(SignerService.name);
  constructor(
    private readonly repository: SignerRepository,
    private readonly access: SignerAccess,
    @Inject(SIGNER_CONFIG) private readonly config: SignerConfig,
    @Inject(ISSUANCE_CONFIG) private readonly issuance: IssuanceConfig,
    @Inject(ISSUANCE_STORAGE) private readonly storage: IssuanceStorage,
  ) {}
  authorize(user: CurrentUser): string {
    if (!user || user.role !== 'ORGANIZER') fail(403, 'FORBIDDEN_ROLE');
    if (
      typeof user.organizationId !== 'string' ||
      !isUUID(user.organizationId, 'all') ||
      !isUUID(user.userId, 'all')
    )
      fail(400, 'INVALID_USER_CONTEXT');
    return user.organizationId.toLowerCase();
  }
  async get(user: CurrentUser) {
    return signerResponse(await this.repository.get(this.authorize(user)));
  }
  async put(
    user: CurrentUser,
    match: unknown,
    body: unknown,
    file?: UploadedSignature,
  ) {
    const org = this.authorize(user),
      version = expectedVersion(match),
      input = validateSigner(body, file);
    await this.access.assertWritable(org);
    let key: string | undefined,
      asset: AssetSnapshot | null = null;
    try {
      if (input.image) {
        key = `achievement/${org}/certificate-signer/signature/${v7()}`;
        try {
          asset = await this.storage.upload(
            { organization_id: org },
            input.image,
            key,
          );
        } catch {
          fail(503, 'STORAGE_UNAVAILABLE');
        }
      }
      return signerResponse(
        await this.repository.put(
          org,
          user.userId,
          version,
          input,
          asset,
          this.config.cleanupDelayMs,
        ),
      );
    } catch (error) {
      if (key) {
        try {
          await this.repository.enqueue(
            key,
            'SIGNER_PUT_FAILED',
            this.config.cleanupDelayMs,
          );
        } catch {
          this.logger.warn({
            code: 'CERTIFICATE_SIGNER_ORPHAN_CLEANUP_REQUIRED',
            assetKey: key,
          });
        }
      }
      throw error;
    }
  }
  async signature(user: CurrentUser): Promise<{ bytes: Buffer; mime: string }> {
    const org = this.authorize(user);
    // Retry once if settings were replaced while reading the old key.
    for (let attempt = 0; attempt < 2; attempt++) {
      const setting = await this.repository.get(org);
      if (!setting?.signature_asset_key || !setting.signature_mime)
        fail(404, 'SIGNATURE_NOT_FOUND');
      try {
        const bytes = await this.storage.read(
          setting.signature_asset_key,
          setting.signature_mime,
          this.issuance.timeoutMs,
          SIGNATURE_MAX_BYTES,
        );
        if (
          createHash('sha256').update(bytes).digest('hex') !==
          setting.signature_hash
        )
          fail(503, 'STORAGE_UNAVAILABLE');
        return { bytes, mime: setting.signature_mime };
      } catch (error) {
        if (
          attempt === 0 &&
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'NOT_FOUND'
        )
          continue;
        fail(503, 'STORAGE_UNAVAILABLE');
      }
    }
    return fail(503, 'STORAGE_UNAVAILABLE');
  }
}
