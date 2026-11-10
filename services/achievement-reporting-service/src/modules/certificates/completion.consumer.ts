import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { CertificatesRepository } from './certificates.repository';
import { decodeCompletion, type Delivery } from './completion-event';
import { ISSUANCE_CONFIG, type IssuanceConfig } from './issuance.config';
import { IssuanceWorker } from './issuance.worker';
@Injectable()
export class CompletionConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CompletionConsumer.name);
  private consumer?: KafkaJS.Consumer;
  private timer?: ReturnType<typeof setInterval>;
  private connecting?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly repository: CertificatesRepository,
    private readonly worker: IssuanceWorker,
    @Inject(ISSUANCE_CONFIG) private readonly config: IssuanceConfig,
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
          clientId: 'achievement-reporting-service',
          connectionTimeout: 3000,
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
      this.logger.warn('CERTIFICATE_KAFKA_UNAVAILABLE');
      await consumer?.disconnect().catch(() => undefined);
    }
  }
  async handle(
    delivery: Delivery,
    commit: (
      offsets: { topic: string; partition: number; offset: string }[],
    ) => Promise<void>,
  ): Promise<void> {
    const decoded = decodeCompletion(delivery);
    if (decoded.reason) {
      await this.repository.quarantineInvalid(
        delivery,
        decoded.payload,
        decoded.reason,
        decoded.eventId,
      );
      this.logger.warn({
        code: decoded.reason,
        topic: delivery.topic,
        partition: delivery.partition,
        offset: delivery.offset,
      });
    } else if (decoded.event) {
      const result = await this.repository.receive(
        decoded.event,
        delivery,
        decoded.payload,
      );
      if (result.conflict)
        this.logger.warn({
          code: result.conflict,
          topic: delivery.topic,
          partition: delivery.partition,
          offset: delivery.offset,
        });
    }
    // Includes durable quarantine. DB failure throws before this line; Kafka re-delivers.
    await commit([
      {
        topic: delivery.topic,
        partition: delivery.partition,
        offset: (BigInt(delivery.offset) + 1n).toString(),
      },
    ]);
    if (decoded.event) this.worker.kick();
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.connecting;
    await this.consumer?.disconnect();
  }
}
