import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { RELAY_CONFIG, type RelayConfig } from './relay.config';
import { GateFailure, OutboxGate } from './relay.gate';
import { RelayRepository, type RelayRow } from './relay.repository';

const CLEANUP_EVERY_MS = 60 * 60 * 1000;

/**
 * Publishes the outbox events of assessment-service: every second it claims up to a batch of the events not sent yet,
 * hands them to the gate and marks them sent, all in one transaction, so a crash in the middle leaves them unsent and the
 * next run sends them again (at least once; the consumer tolerates a repeated `eventId`). A failure keeps the row for
 * later with a longer wait each time. When the failure belongs to some rows (a message that cannot be built), the others
 * of the batch still go out; when it belongs to the destination, nothing is tried row by row, because each try would wait
 * for the destination again and the transaction would run out of time.
 */
@Injectable()
export class RelayService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(RelayService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private cleaning?: Promise<void>;
  private stopped = false;
  private gateDown = false;

  constructor(
    private readonly repository: RelayRepository,
    private readonly gate: OutboxGate,
    @Inject(RELAY_CONFIG) private readonly config: RelayConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.enabled) return;
    this.schedule(0);
    this.scheduleCleanup();
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.tick().finally(() => {
        if (!this.stopped) this.schedule(this.config.pollMs);
      });
    }, delay);
  }

  /** The rows sent a week ago are no use any more; the topic keeps the events for 30 days. */
  private scheduleCleanup(): void {
    this.cleanupTimer = setTimeout(() => {
      this.cleaning = this.repository
        .cleanup()
        .catch(() => this.logger.error('OUTBOX_CLEANUP_FAILURE'))
        .finally(() => {
          this.cleaning = undefined;
          if (!this.stopped) this.scheduleCleanup();
        });
    }, CLEANUP_EVERY_MS);
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
      } catch (error) {
        const failure =
          error instanceof GateFailure
            ? error
            : new GateFailure('OUTBOX_UNKNOWN');
        if (!failure.individual || rows.length === 1) {
          for (const row of rows) await this.failure(tx, row, failure.code);
          return;
        }
        // The failure belongs to some rows: the others must not wait for them. A row the gate had accepted before it failed
        // may go out a second time, which the consumer tolerates (same eventId).
        const outcomes = await Promise.allSettled(
          rows.map((row) => this.gate.send([row])),
        );
        for (const [index, row] of rows.entries()) {
          const outcome = outcomes[index];
          if (outcome.status === 'fulfilled')
            await this.repository.published(tx, row);
          else
            await this.failure(
              tx,
              row,
              outcome.reason instanceof GateFailure
                ? outcome.reason.code
                : 'OUTBOX_UNKNOWN',
            );
        }
        return;
      }
      for (const row of rows) await this.repository.published(tx, row);
    });
  }

  private async failure(
    tx: Prisma.TransactionClient,
    row: RelayRow,
    code: string,
  ) {
    await this.repository.failed(tx, row, code);
    if (row.attempts + 1 >= this.config.alertAttempts)
      this.logger.error(
        `OUTBOX_RETRY_ALERT eventId=${row.id} code=${code} attempts=${row.attempts + 1}`,
      );
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.cleanupTimer);
    await Promise.all([this.running, this.cleaning]);
    await this.gate.close();
  }
}
