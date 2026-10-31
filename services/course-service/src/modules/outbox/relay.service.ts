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

@Injectable()
export class RelayService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(RelayService.name);

  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;

  private stopped = false;
  private brokerUnavailable = false;

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

    if (!ready) {
      if (!this.brokerUnavailable) {
        this.logger.warn('OUTBOX_BROKER_UNAVAILABLE: will retry');
      }

      this.brokerUnavailable = true;
      return;
    }

    this.brokerUnavailable = false;

    await this.repository.transaction(async (tx, rows) => {
      for (const row of rows) {
        try {
          await this.producer.send(row);
          await this.repository.published(tx, row);
        } catch (error) {
          const result = classifyError(error);

          await this.repository.failed(tx, row, result.code);

          if (row.attempts + 1 >= this.config.alertAttempts) {
            this.logger.error(
              `OUTBOX_RETRY_ALERT eventId=${row.id} code=${result.code}`,
            );
          }

          // A broker-wide failure should stop this batch.
          // A malformed individual event should not block
          // other Course versions.
          if (!result.individual) {
            break;
          }
        }
      }
    });
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;

    clearTimeout(this.timer);

    await this.running;
    await this.producer.close();
  }
}
