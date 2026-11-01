import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { OutboxGate } from './relay.gate';
import { RELAY_CONFIG, type RelayConfig } from './relay.config';
import { RelayRepository, type RelayRow } from './relay.repository';
import type { Prisma } from 'generated/prisma/client';

/**
 * Publishes the outbox events of assessment-service: every second it claims up to a batch of the events not sent yet,
 * hands them to the gate and marks them sent, all in one transaction, so a crash in the middle leaves them unsent and the
 * next run sends them again (at least once; the consumer tolerates a repeated `eventId`). A failure keeps the row for
 * later with a longer wait each time and never blocks the rows of other Learners.
 */
@Injectable()
export class RelayService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(RelayService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  private gateDown = false;

  constructor(
    private readonly repository: RelayRepository,
    private readonly gate: OutboxGate,
    @Inject(RELAY_CONFIG) private readonly config: RelayConfig,
  ) {}

  onModuleInit(): void {
    if (this.config.enabled) this.schedule(0);
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.tick().finally(() => {
        if (!this.stopped) this.schedule(this.config.pollMs);
      });
    }, delay);
  }

  /** One run; a run that is still going answers with itself instead of starting another. */
  tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.run()
      .catch(() => this.logger.error('OUTBOX_RELAY_FAILURE'))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  private async run(): Promise<void> {
    // Ask the gate before taking any lock: with the destination down nothing is claimed and no transaction is kept open.
    if (!(await this.gate.ready())) {
      if (!this.gateDown)
        this.logger.warn('OUTBOX_GATE_UNAVAILABLE: the relay will retry');
      this.gateDown = true;
      return;
    }
    this.gateDown = false;
    await this.repository.transaction(async (tx, rows) => {
      if (rows.length === 0) return;
      try {
        await this.gate.send(rows);
      } catch {
        // The gate refused the batch, and one bad row must not hold back the others: send them one at a time. A row the
        // gate had accepted before it failed may go out a second time, which the consumer tolerates (same eventId).
        for (const row of rows) {
          try {
            await this.gate.send([row]);
            await this.repository.published(tx, row);
          } catch {
            await this.failure(tx, row);
          }
        }
        return;
      }
      for (const row of rows) await this.repository.published(tx, row);
    });
  }

  private async failure(tx: Prisma.TransactionClient, row: RelayRow) {
    await this.repository.failed(tx, row, 'OUTBOX_SEND_FAILED');
    if (row.attempts + 1 >= this.config.alertAttempts)
      this.logger.error(
        `OUTBOX_RETRY_ALERT eventId=${row.id} attempts=${row.attempts + 1}`,
      );
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
    await this.gate.close();
  }
}
