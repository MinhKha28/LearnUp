import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { RELAY_CONFIG, type RelayConfig } from './relay.config';
import { classifyError, RelayProducer } from './relay.producer';
import { RelayRepository, type OutboxRow } from './relay.repository';
import type { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class RelayService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(RelayService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  private resumeDrain?: () => void;
  private brokerUnavailable = false;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private cleaning?: Promise<void>;
  constructor(
    private readonly repository: RelayRepository,
    private readonly producer: RelayProducer,
    @Inject(RELAY_CONFIG) private readonly config: RelayConfig,
  ) {}
  onModuleInit(): void {
    if (this.config.enabled) {
      this.schedule(0);
      this.scheduleCleanup();
    }
  }
  private scheduleCleanup(): void {
    this.cleanupTimer = setTimeout(() => {
      this.cleaning = this.repository
        .cleanup()
        .catch((error: unknown) =>
          this.logFailure('OUTBOX_CLEANUP_FAILURE', error),
        )
        .finally(() => {
          this.cleaning = undefined;
          if (!this.stopped) this.scheduleCleanup();
        });
    }, 3600000);
  }
  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.tick().finally(() => {
        if (!this.stopped) this.schedule(this.config.pollMs);
      });
    }, delay);
  }
  tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.run()
      .catch((error: unknown) => this.logFailure('OUTBOX_RELAY_FAILURE', error))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private async failure(
    tx: Prisma.TransactionClient,
    row: OutboxRow,
    error: unknown,
  ): Promise<void> {
    const { code } = classifyError(error);
    await this.repository.failed(tx, row, code);
    if (row.attempts + 1 >= this.config.alertAttempts)
      this.logger.error(`OUTBOX_RETRY_ALERT eventId=${row.id} code=${code}`);
  }
  private logFailure(message: string, error: unknown): void {
    const original =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
    // Only retain bounded diagnostic codes, never arbitrary error text or payloads.
    const code =
      typeof original === 'number' && Number.isSafeInteger(original)
        ? original
        : typeof original === 'string' && /^P\d{4}$/.test(original)
          ? original
          : classifyError(error).code;
    this.logger.error({ message, code });
  }
  private async run(): Promise<void> {
    do {
      const full = await this.batch();
      if (this.stopped || !full) return;
      await this.waitForDrainGap();
    } while (!this.stopped);
  }
  private waitForDrainGap(): Promise<void> {
    if (this.config.drainGapMs === 0)
      return new Promise<void>((resolve) => setImmediate(resolve));
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => resume(), this.config.drainGapMs);
      const resume = () => {
        clearTimeout(timer);
        this.resumeDrain = undefined;
        resolve();
      };
      this.resumeDrain = resume;
    });
  }
  private async batch(): Promise<boolean> {
    if (!(await this.producer.ready())) {
      if (!this.brokerUnavailable)
        this.logger.warn('OUTBOX_BROKER_UNAVAILABLE: relay will retry');
      this.brokerUnavailable = true;
      return false;
    }
    this.brokerUnavailable = false;
    let full = false;
    await this.repository.transaction(async (tx, rows) => {
      if (!rows.length) return;
      try {
        await this.producer.send(rows);
      } catch (e) {
        this.logFailure('OUTBOX_RELAY_FAILURE', e);
        if (!classifyError(e).individual) {
          for (const row of rows) await this.failure(tx, row, e);
          return;
        }
        // BR-143: each claimed row belongs to a different Enrollment.
        const outcomes = await Promise.allSettled(
          rows.map((row) => this.producer.send([row])),
        );
        for (let i = 0; i < rows.length; i++) {
          const result = outcomes[i];
          if (result.status === 'fulfilled')
            await this.repository.published(tx, rows[i]);
          else {
            this.logFailure('OUTBOX_RELAY_FAILURE', result.reason);
            await this.failure(tx, rows[i], result.reason);
          }
        }
        return;
      }
      for (const row of rows) await this.repository.published(tx, row);
      full = rows.length === this.config.batchSize;
    });
    return full;
  }
  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    this.resumeDrain?.();
    clearTimeout(this.timer);
    clearTimeout(this.cleanupTimer);
    await Promise.all([this.running, this.cleaning]);
    await this.producer.close();
  }
}
