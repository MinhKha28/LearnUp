import { Inject, Injectable } from '@nestjs/common';
import { CODES, KafkaJS } from '@confluentinc/kafka-javascript';

import { RELAY_CONFIG } from './relay.config';

import type { RelayConfig } from './interfaces/relay-config.interface';
import type { OutboxRow } from './interfaces/outbox-row.interface';
import type { RelayErrorClassification } from './interfaces/relay-error.interface';

const errors = CODES.ERRORS;

const individualCodes = new Set([
  errors.ERR_MSG_SIZE_TOO_LARGE,
  errors.ERR__KEY_SERIALIZATION,
  errors.ERR__VALUE_SERIALIZATION,
  errors.ERR_INVALID_MSG,
  errors.ERR_INVALID_MSG_SIZE,
]);

const eventTypes = new Set([
  'CourseDisabled',
  'CourseReactivated',
  'CourseComponentDisabled',
  'CourseComponentReactivated',
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SerializationFailure extends Error {
  readonly code = 'OUTBOX_SERIALIZATION';

  constructor() {
    super('Invalid Course outbox event');
  }
}

export function classifyError(error: unknown): RelayErrorClassification {
  if (error instanceof SerializationFailure) {
    return {
      individual: true,
      code: error.code,
    };
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code: unknown }).code
      : undefined;

  return {
    individual: typeof code === 'number' && individualCodes.has(code),
    code:
      typeof code === 'number' && Number.isInteger(code)
        ? `KAFKA_${code}`
        : 'OUTBOX_UNKNOWN',
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function message(row: OutboxRow) {
  if (
    row.aggregate_type !== 'Course' ||
    !eventTypes.has(row.event_type) ||
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.aggregate_id) ||
    !row.organization_id ||
    !uuidPattern.test(row.organization_id) ||
    !isObject(row.payload) ||
    !(row.occurred_at instanceof Date) ||
    Number.isNaN(row.occurred_at.getTime())
  ) {
    throw new SerializationFailure();
  }

  const data = row.payload;

  if (
    data.organizationId !== row.organization_id ||
    data.courseId !== row.aggregate_id ||
    data.occurredAt !== row.occurred_at.toISOString()
  ) {
    throw new SerializationFailure();
  }

  const isComponent =
    row.event_type === 'CourseComponentDisabled' ||
    row.event_type === 'CourseComponentReactivated';

  if (isComponent) {
    if (
      (data.componentType !== 'Lesson' && data.componentType !== 'Material') ||
      typeof data.componentId !== 'string' ||
      !uuidPattern.test(data.componentId)
    ) {
      throw new SerializationFailure();
    }
  }

  return {
    key: row.aggregate_id,
    value: JSON.stringify({
      eventId: row.id,
      eventType: row.event_type,
      version: 1,
      occurredAt: row.occurred_at.toISOString(),
      organizationId: row.organization_id,
      producer: 'course-service',
      data,
    }),
  };
}

@Injectable()
export class RelayProducer {
  private producer!: KafkaJS.Producer;
  private admin!: KafkaJS.Admin;

  private connected = false;
  private initialized = false;

  constructor(
    @Inject(RELAY_CONFIG)
    private readonly config: RelayConfig,
  ) {
    if (this.config.enabled) {
      this.createClients();
    }
  }

  private createClients(): void {
    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: this.config.brokers,
        clientId: 'course-service',
        connectionTimeout: this.config.probeMs,
        authenticationTimeout: 1,
        retry: { retries: 0 },
        logLevel: KafkaJS.logLevel.NOTHING,
      },
    });

    this.producer = kafka.producer({
      kafkaJS: {
        acks: -1,
        idempotent: true,
        maxInFlightRequests: 1,
        timeout: this.config.deliveryMs,
        retry: { retries: 5 },
      },
      'delivery.timeout.ms': this.config.deliveryMs,
    });

    this.admin = kafka.admin();
  }

  async ready(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      if (!this.connected) {
        await this.admin.connect();

        try {
          await this.producer.connect();
        } catch (error) {
          await this.admin.disconnect();
          throw error;
        }

        this.connected = true;
      }

      if (this.initialized) {
        await this.admin.fetchTopicMetadata({
          topics: [this.config.topic],
          timeout: this.config.probeMs,
        });
      } else {
        await this.admin.listTopics({
          timeout: this.config.probeMs,
        });

        try {
          await this.admin.createTopics({
            timeout: this.config.probeMs,
            topics: [
              {
                topic: this.config.topic,
                numPartitions: 3,
                replicationFactor: this.config.replicationFactor,
                configEntries: [
                  {
                    name: 'retention.ms',
                    value: '2592000000',
                  },
                ],
              },
            ],
          });
        } catch (error) {
          if (
            (error as { code?: number }).code !==
            errors.ERR_TOPIC_ALREADY_EXISTS
          ) {
            throw error;
          }
        }

        this.initialized = true;
      }

      return true;
    } catch {
      if (!this.connected) {
        await Promise.allSettled([
          this.producer.disconnect(),
          this.admin.disconnect(),
        ]);

        this.createClients();
      }

      return false;
    }
  }

  async send(row: OutboxRow): Promise<void> {
    const kafkaMessage = message(row);

    await this.producer.send({
      topic: this.config.topic,
      messages: [kafkaMessage],
    });
  }

  async close(): Promise<void> {
    if (!this.config.enabled) return;

    await Promise.allSettled([
      this.producer.disconnect(),
      this.admin.disconnect(),
    ]);

    this.connected = false;
  }
}
