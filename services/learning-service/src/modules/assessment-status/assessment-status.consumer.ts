import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { AssessmentStatusRepository } from './assessment-status.repository';
import type { AssessmentDelivery } from './assessment-status.event';
import {
  ASSESSMENT_STATUS_CONFIG,
  type AssessmentStatusConfig,
} from './assessment-status.config';

@Injectable()
export class AssessmentStatusConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssessmentStatusConsumer.name);
  private consumer?: KafkaJS.Consumer;
  private timer?: ReturnType<typeof setInterval>;
  private connecting?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly repository: AssessmentStatusRepository,
    @Inject(ASSESSMENT_STATUS_CONFIG)
    private readonly config: AssessmentStatusConfig,
  ) {}
  onModuleInit(): void {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => this.connect(), 5000);
    this.timer.unref();
    this.connect();
  }
  private connect(): void {
    if (this.consumer || this.connecting || this.stopped) return;
    this.connecting = this.start().finally(() => {
      this.connecting = undefined;
    });
  }
  protected loadKafka(): Promise<
    typeof import('@confluentinc/kafka-javascript')
  > {
    return import('@confluentinc/kafka-javascript');
  }
  private async start(): Promise<void> {
    let consumer: KafkaJS.Consumer | undefined;
    try {
      const { KafkaJS } = await this.loadKafka();
      const kafka = new KafkaJS.Kafka({
        kafkaJS: {
          brokers: this.config.brokers,
          clientId: 'learning-service',
          connectionTimeout: 3000,
          authenticationTimeout: 1,
          retry: { retries: 0 },
          logLevel: KafkaJS.logLevel.NOTHING,
        },
      });
      consumer = kafka.consumer({
        kafkaJS: {
          groupId: this.config.groupId,
          fromBeginning: true,
          autoCommit: false,
          allowAutoTopicCreation: false,
          retry: { retries: 0 },
          // A topic provisioned after startup must be discovered promptly.
          metadataMaxAge: 5000,
        },
      });
      await consumer.connect();
      if (this.stopped) {
        await consumer.disconnect();
        return;
      }
      await consumer.subscribe({ topic: this.config.topic });
      const connected = consumer;
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handle(
            {
              topic,
              partition,
              offset: message.offset,
              value: message.value,
              key: message.key,
            },
            (offsets) => connected.commitOffsets(offsets),
          );
        },
      });
      this.consumer = consumer;
    } catch {
      this.logger.warn('ASSESSMENT_KAFKA_UNAVAILABLE');
      await consumer?.disconnect().catch(() => undefined);
    }
  }
  async handle(
    delivery: AssessmentDelivery,
    commit: (
      offsets: { topic: string; partition: number; offset: string }[],
    ) => Promise<void>,
  ): Promise<void> {
    const reason = await this.repository.receive(delivery);
    if (reason)
      this.logger.warn(
        JSON.stringify({
          code: reason,
          topic: delivery.topic,
          partition: delivery.partition,
          offset: delivery.offset,
        }),
      );
    // Includes durable quarantine. DB failure throws before this line; Kafka re-delivers.
    await commit([
      {
        topic: delivery.topic,
        partition: delivery.partition,
        offset: (BigInt(delivery.offset) + 1n).toString(),
      },
    ]);
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.connecting;
    await this.consumer?.disconnect();
  }
}
