import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { SignerRepository, type CleanupTask } from './signer.repository';
import { SIGNER_CONFIG, type SignerConfig } from './signer.config';
import { ISSUANCE_STORAGE, type IssuanceStorage } from './issuance.storage';
import { retrySeconds } from './issuance.config';
@Injectable()
export class StorageCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageCleanupWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private stopped = false;
  private ticks = 0;
  constructor(
    private readonly repository: SignerRepository,
    @Inject(SIGNER_CONFIG) private readonly config: SignerConfig,
    @Inject(ISSUANCE_STORAGE) private readonly storage: IssuanceStorage,
  ) {}
  onModuleInit() {
    if (!this.config.cleanupEnabled) return;
    this.timer = setInterval(() => this.kick(), this.config.cleanupPollMs);
    this.timer.unref();
    this.kick();
  }
  kick() {
    if (this.active || this.stopped || !this.config.cleanupEnabled) return;
    this.active = this.tick()
      .catch(() => this.logger.warn('CERTIFICATE_CLEANUP_UNAVAILABLE'))
      .finally(() => {
        this.active = undefined;
      });
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  async tick() {
    const tasks = await this.repository.claim(4, this.config.cleanupLeaseMs);
    await Promise.all(tasks.map((t) => this.process(t)));
    if (
      ++this.ticks %
        Math.max(1, Math.ceil(60000 / this.config.cleanupPollMs)) ===
      0
    ) {
      const backlog = await this.repository.backlog();
      if (backlog.oldest > this.config.cleanupWarnSeconds)
        this.logger.warn({
          code: 'CERTIFICATE_CLEANUP_BACKLOG',
          count: backlog.count,
          oldestSeconds: backlog.oldest,
        });
    }
  }
  async process(task: CleanupTask) {
    try {
      if (await this.repository.referenced(task.asset_key)) {
        await this.repository.retry(
          task,
          retrySeconds(task.attempts + 1),
          'ASSET_REFERENCED',
        );
        return;
      }
      await this.storage.delete(task.asset_key);
      await this.repository.done(task);
    } catch {
      await this.repository.retry(
        task,
        retrySeconds(task.attempts + 1),
        'STORAGE_UNAVAILABLE',
      );
    }
  }
}
