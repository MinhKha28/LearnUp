import { createHash } from 'node:crypto';
import { v7 } from 'uuid';
import { SignerRepository } from './signer.repository';
import { SIGNATURE_MAX_BYTES, signatureImage } from './signer.validation';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  CertificatesRepository,
  type PendingCertificate,
} from './certificates.repository';
import {
  ISSUANCE_CONFIG,
  IssuanceError,
  retrySeconds,
  type IssuanceConfig,
} from './issuance.config';
import {
  downloadLogo,
  ISSUANCE_DIRECTORY,
  type IssuanceDirectory,
} from './issuance.clients';
import {
  ISSUANCE_STORAGE,
  logoKey,
  type IssuanceStorage,
} from './issuance.storage';
@Injectable()
export class IssuanceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IssuanceWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private ticks = 0;
  private stopped = false;
  constructor(
    private readonly repository: CertificatesRepository,
    @Inject(ISSUANCE_CONFIG) private readonly config: IssuanceConfig,
    @Inject(ISSUANCE_DIRECTORY) private readonly directory: IssuanceDirectory,
    @Inject(ISSUANCE_STORAGE) private readonly storage: IssuanceStorage,
    private readonly signers: SignerRepository,
  ) {}
  onModuleInit(): void {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => this.kick(), this.config.pollMs);
    this.timer.unref();
    this.kick();
  }
  kick(): void {
    if (this.active || !this.config.enabled || this.stopped) return;
    this.active = this.tick()
      .catch(() => this.logger.warn('CERTIFICATE_WORKER_UNAVAILABLE'))
      .finally(() => {
        this.active = undefined;
      });
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  async tick(): Promise<void> {
    const rows = await this.repository.claimDueAcrossOrganizations(
      this.config.concurrency,
      this.config.leaseMs,
    );
    await Promise.all(rows.map((row) => this.process(row)));
    if (
      ++this.ticks % Math.max(1, Math.ceil(60000 / this.config.pollMs)) ===
      0
    ) {
      const metrics = await this.repository.metricsAcrossOrganizations();
      if (metrics.oldestPendingSeconds > 3600)
        this.logger.warn({
          code: 'CERTIFICATE_PENDING_OVER_ONE_HOUR',
          backlog: metrics.backlog,
          oldestPendingSeconds: metrics.oldestPendingSeconds,
        });
    }
  }
  async process(row: PendingCertificate): Promise<void> {
    const keys: string[] = [];
    try {
      const [learnerName, course, initialProfile] = await Promise.all([
        this.directory.learnerName(row.organization_id, row.learner_id),
        this.directory.course(row.organization_id, row.course_id),
        this.directory.profile(row.organization_id),
      ]);
      let profile = initialProfile,
        image;
      if (profile.logo) {
        try {
          image = await downloadLogo(profile.logo.url, this.config);
        } catch (error) {
          if (
            !(error instanceof IssuanceError) ||
            error.code !== 'LOGO_NOT_FOUND'
          )
            throw error;
          profile = await this.directory.profile(row.organization_id);
          if (profile.logo)
            image = await downloadLogo(profile.logo.url, this.config);
        }
      }
      let setting = await this.signers.get(row.organization_id);
      let signature = null;
      for (
        let attempt = 0;
        setting?.signature_asset_key && attempt < 2;
        attempt++
      ) {
        let bytes: Buffer;
        try {
          bytes = await this.storage.read(
            setting.signature_asset_key,
            setting.signature_mime!,
            this.config.timeoutMs,
            SIGNATURE_MAX_BYTES,
          );
        } catch (error) {
          if (
            attempt === 0 &&
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'NOT_FOUND'
          ) {
            setting = await this.signers.get(row.organization_id);
            continue;
          }
          throw error;
        }
        if (
          createHash('sha256').update(bytes).digest('hex') !==
          setting.signature_hash
        )
          throw new IssuanceError('SIGNATURE_HASH_MISMATCH');
        const image = signatureImage(bytes);
        if (
          image.mime !== setting.signature_mime ||
          bytes.length !== setting.signature_size_bytes
        )
          throw new IssuanceError('SIGNATURE_METADATA_MISMATCH');
        const key = `achievement/${row.organization_id}/certificates/${row.id}/signature/${v7()}`;
        keys.push(key);
        signature = await this.storage.upload(row, image, key);
        break;
      }
      let logo = null;
      if (image) {
        const key = logoKey(row);
        keys.push(key);
        logo = await this.storage.upload(row, image, key);
      }
      const won = await this.repository.issue(row, {
        learnerName,
        organizationName: profile.name,
        courseName: course.name,
        chainId: course.chainId,
        versionNumber: course.versionNumber,
        logo,
        signer: {
          version: setting?.version ?? 0,
          name: setting?.signer_name ?? null,
          title: setting?.signer_title ?? null,
          asset: signature,
        },
      });
      if (won === true) keys.length = 0;
      else if (won === 'version_changed')
        await this.repository.retryVersionChange(row);
    } catch (error) {
      const code =
        error instanceof IssuanceError
          ? error.code
          : 'CERTIFICATE_ISSUANCE_UNAVAILABLE';
      this.logger.warn({ code, certificateId: row.id });
      await this.repository
        .retry(row, code, retrySeconds(row.issue_attempts + 1))
        .catch(() => this.logger.warn('CERTIFICATE_RETRY_PERSIST_FAILED'));
    } finally {
      for (const key of keys) {
        try {
          // Enqueue before best-effort deletion: process failure or an ambiguous commit remains recoverable.
          await this.signers.enqueue(
            key,
            'ISSUANCE_ATTEMPT_UNUSED',
            this.config.leaseMs + this.config.timeoutMs + 1000,
          );
        } catch {
          this.logger.warn({
            code: 'CERTIFICATE_ORPHAN_CLEANUP_REQUIRED',
            assetKey: key,
          });
        }
        try {
          if (!(await this.repository.assetIsReferenced(row, key)))
            await this.storage.delete(key);
        } catch {
          this.logger.warn({
            code: 'CERTIFICATE_ORPHAN_CLEANUP_REQUIRED',
            assetKey: key,
          });
        }
      }
    }
  }
}
