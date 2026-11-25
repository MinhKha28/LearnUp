import { OUTBOX_TOPIC_MISSING } from '@learnup/ts-common';
import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { RELAY_CONFIG } from './relay.config';
import { RelayProducer, classifyError } from './relay.producer';
import { RelayRepository } from './relay.repository';

import type { RelayConfig } from './interfaces/relay-config.interface';
import type { OutboxRow } from './interfaces/outbox-row.interface';
import type { Prisma } from '../../../generated/prisma/client';

const BROKER_UNAVAILABLE_KEY = 'broker-unavailable';

@Injectable()
export class RelayService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(RelayService.name);

  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;

  private stopped = false;
  private lastReadinessFailure?: string;

  constructor(
    private readonly repository: RelayRepository,
    private readonly producer: RelayProducer,
    @Inject(RELAY_CONFIG)
    private readonly config: RelayConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.enabled) {
      this.logger.log('Course Outbox Relay is disabled');
      return;
    }

    this.logger.log('Course Outbox Relay started');
    this.schedule(0);
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.tick().finally(() => {
        if (!this.stopped) {
          this.schedule(this.config.pollMs);
        }
      });
    }, delay);
  }

  tick(): Promise<void> {
    if (this.stopped || !this.config.enabled) {
      return Promise.resolve();
    }

    if (this.running) {
      return this.running;
    }

    this.running = this.run()
      .catch((error: unknown) => {
        this.logger.error(
          `OUTBOX_RELAY_FAILURE ${
            error instanceof Error ? error.name : 'Unknown'
          }`,
        );
      })
      .finally(() => {
        this.running = undefined;
      });

    return this.running;
  }

  private async run(): Promise<void> {
    const ready = await this.producer.ready();

    if (ready.status !== 'ready') {
      const reason =
        ready.status === 'missing-topics'
          ? JSON.stringify([...ready.topics].sort())
          : BROKER_UNAVAILABLE_KEY;
      if (reason !== this.lastReadinessFailure) {
        if (ready.status === 'missing-topics') {
          for (const topic of ready.topics)
            this.logger.warn(
              `${OUTBOX_TOPIC_MISSING} topic=${topic} hint="run kafka-init"`,
            );
        } else {
          this.logger.warn('OUTBOX_BROKER_UNAVAILABLE: will retry');
        }
      }
      this.lastReadinessFailure = reason;
      return;
    }
    this.lastReadinessFailure = undefined;

    await this.repository.transaction(async (tx, rows) => {
      if (!rows.length) return;
      const outcomes = await this.producer.send(rows);
      const brokerFailure = outcomes.find(
        (result) =>
          result.status === 'rejected' &&
          !classifyError(result.reason).individual,
      );
      if (brokerFailure?.status === 'rejected') {
        // Delivery may be ambiguous: back off the entire claim and commit.
        for (const row of rows) {
          await this.failure(tx, row, brokerFailure.reason);
        }
        return;
      }

      // claimSql selects one head per Course version, so fallback cannot
      // overtake another event for that same Course, even across workers.
      const retryIndexes = outcomes.flatMap((result, index) =>
        result.status === 'rejected' ? [index] : [],
      );
      if (retryIndexes.length) {
        const retries = await this.producer.send(
          retryIndexes.map((index) => rows[index]),
        );
        retryIndexes.forEach((index, offset) => {
          outcomes[index] = retries[offset];
        });
      }

      for (let index = 0; index < rows.length; index++) {
        const result = outcomes[index];
        if (result.status === 'fulfilled') {
          await this.repository.published(tx, rows[index]);
        } else {
          await this.failure(tx, rows[index], result.reason);
        }
      }
    });
  }

  private async failure(
    tx: Prisma.TransactionClient,
    row: OutboxRow,
    error: unknown,
  ): Promise<void> {
    const { code } = classifyError(error);
    await this.repository.failed(tx, row, code);
    if (row.attempts + 1 >= this.config.alertAttempts) {
      this.logger.error(`OUTBOX_RETRY_ALERT eventId=${row.id} code=${code}`);
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;

    clearTimeout(this.timer);

    await this.running;
    await this.producer.close();
  }
}
