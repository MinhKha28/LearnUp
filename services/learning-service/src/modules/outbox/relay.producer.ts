import {
  classifyKafkaRelayError,
  OUTBOX_TOPIC_MISSING,
  type KafkaRelayErrorClassification,
} from '@learnup/ts-common';
import { Inject, Injectable } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { RELAY_CONFIG, type RelayConfig } from './relay.config';
import type { OutboxRow } from './relay.repository';

export class SerializationFailure extends Error {
  readonly code = 'OUTBOX_SERIALIZATION';
}
/** A row that cannot become a message is individual; every other error is classified by the shared helper. */
export function classifyError(error: unknown): KafkaRelayErrorClassification {
  if (error instanceof SerializationFailure)
    return { individual: true, code: 'OUTBOX_SERIALIZATION' };
  return classifyKafkaRelayError(error);
}
export function message(row: OutboxRow) {
  try {
    if (
      !row.organization_id ||
      !row.payload ||
      Array.isArray(row.payload) ||
      typeof row.payload !== 'object'
    )
      throw new SerializationFailure();
    return {
      key: row.aggregate_id,
      value: JSON.stringify({
        eventId: row.id,
        eventType: row.event_type,
        version: 1,
        occurredAt: row.occurred_at.toISOString(),
        organizationId: row.organization_id,
        producer: 'learning-service',
        data: row.payload,
      }),
    };
  } catch {
    throw new SerializationFailure();
  }
}
@Injectable()
export class RelayProducer {
  private producer: KafkaJS.Producer;
  private admin?: KafkaJS.Admin;
  private connecting = false;
  private connected = false;
  constructor(@Inject(RELAY_CONFIG) private readonly config: RelayConfig) {
    this.producer = this.createProducer();
  }
  private createProducer(): KafkaJS.Producer {
    const config = this.config;
    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: config.brokers,
        clientId: 'learning-service',
        connectionTimeout: config.probeMs,
        authenticationTimeout: 1,
        retry: { retries: 0 },
        logLevel: KafkaJS.logLevel.NOTHING,
      },
    });
    return kafka.producer({
      kafkaJS: {
        acks: -1,
        idempotent: true,
        maxInFlightRequests: 1,
        timeout: config.deliveryMs,
        retry: { retries: 5 },
      },
      'delivery.timeout.ms': config.deliveryMs,
    });
  }
  /** A fresh metadata request checks broker reachability before acquiring database locks. */
  async ready(): Promise<true | string> {
    try {
      if (!this.connected) {
        this.connecting = true;
        try {
          await this.producer.connect();
        } catch (error) {
          // KafkaJS producers cannot reconnect after a terminal connect failure.
          this.producer = this.createProducer();
          throw error;
        } finally {
          this.connecting = false;
        }
        this.connected = true;
      }
      if (!this.admin) {
        const admin = this.producer.dependentAdmin();
        await admin.connect();
        this.admin = admin;
      }
      const existingTopics = await this.admin.listTopics({
        timeout: this.config.probeMs,
      });
      if (!existingTopics.includes(this.config.topic))
        return OUTBOX_TOPIC_MISSING;
      return true;
    } catch (error) {
      return classifyError(error).code;
    }
  }
  async cancelConnect(): Promise<void> {
    if (this.connecting) await this.producer.disconnect();
  }
  async send(rows: OutboxRow[]): Promise<void> {
    const messages = rows.map(message);
    const started = Date.now();
    try {
      await this.producer.send({ topic: this.config.topic, messages });
    } catch (e) {
      // send() rejects on the first failure; drain other delivery reports before retrying.
      if (classifyError(e).individual) {
        await this.producer.flush({
          timeout: Math.max(1, this.config.deliveryMs - (Date.now() - started)),
        });
      }
      throw e;
    }
  }
  async close(): Promise<void> {
    if (this.connected) {
      this.admin = undefined;
      await Promise.allSettled([this.producer.disconnect()]);
      this.connected = false;
    }
  }
}
