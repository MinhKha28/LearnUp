import {
  classifyKafkaRelayError,
  OUTBOX_TOPIC_MISSING,
} from '@learnup/ts-common';
import { Inject, Injectable } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';

import { RELAY_CONFIG } from './relay.config';

import type { RelayConfig } from './interfaces/relay-config.interface';
import type { OutboxRow } from './interfaces/outbox-row.interface';
import type {
  RelayErrorClassification,
  RelayReadiness,
} from './interfaces/relay-error.interface';

const eventTypes = new Set([
  'CourseDisabled',
  'CourseReactivated',
  'CourseComponentDisabled',
  'CourseComponentReactivated',
  'CourseSubmitted',
  'CourseOwnershipTransferred',
  'CoursePublished',
  'CourseRejected',
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SerializationFailure extends Error {
  readonly code = 'OUTBOX_SERIALIZATION';

  constructor() {
    super('Invalid Course outbox event');
  }
}

/** A row that cannot become a message is individual; every other error is classified by the shared helper. */
export function classifyError(error: unknown): RelayErrorClassification {
  if (error instanceof SerializationFailure) {
    return {
      individual: true,
      code: error.code,
    };
  }

  return classifyKafkaRelayError(error);
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

  if (row.event_type === 'CourseSubmitted') {
    if (
      typeof data.instructorId !== 'string' ||
      !uuidPattern.test(data.instructorId) ||
      typeof data.courseName !== 'string' ||
      !data.courseName.trim() ||
      typeof data.versionNumber !== 'number' ||
      !Number.isSafeInteger(data.versionNumber) ||
      data.versionNumber < 1 ||
      typeof data.submittedAt !== 'string' ||
      Number.isNaN(Date.parse(data.submittedAt))
    ) {
      throw new SerializationFailure();
    }
  }

  if (row.event_type === 'CourseOwnershipTransferred') {
    const ids = [
      data.chainId,
      data.fromInstructorId,
      data.toInstructorId,
      data.actorUserId,
    ];

    if (
      ids.some(
        (value) => typeof value !== 'string' || !uuidPattern.test(value),
      ) ||
      typeof data.courseName !== 'string' ||
      !data.courseName.trim() ||
      (data.reason !== undefined && typeof data.reason !== 'string')
    ) {
      throw new SerializationFailure();
    }
  }

  if (
    row.event_type === 'CoursePublished' ||
    row.event_type === 'CourseRejected'
  ) {
    if (
      typeof data.instructorId !== 'string' ||
      !uuidPattern.test(data.instructorId) ||
      typeof data.organizerId !== 'string' ||
      !uuidPattern.test(data.organizerId) ||
      typeof data.courseName !== 'string' ||
      !data.courseName.trim() ||
      !Number.isSafeInteger(data.versionNumber) ||
      (data.versionNumber as number) < 1 ||
      typeof data.decidedAt !== 'string' ||
      Number.isNaN(Date.parse(data.decidedAt))
    ) {
      throw new SerializationFailure();
    }

    const decisionTime =
      row.event_type === 'CoursePublished' ? data.publishedAt : data.rejectedAt;

    if (
      typeof decisionTime !== 'string' ||
      decisionTime !== data.decidedAt ||
      decisionTime !== data.occurredAt
    ) {
      throw new SerializationFailure();
    }

    if (row.event_type === 'CourseRejected') {
      if (
        typeof data.rejectionReason !== 'string' ||
        !data.rejectionReason.trim() ||
        data.rejectionReason.length > 1000
      ) {
        throw new SerializationFailure();
      }
    }
  }

  if (
    data.organizationId !== row.organization_id ||
    (row.event_type === 'CourseOwnershipTransferred'
      ? data.chainId !== row.aggregate_id
      : data.courseId !== row.aggregate_id) ||
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
  /** Both are undefined only after a failed rebuild; the next ready() builds them again. */
  private producer?: KafkaJS.Producer;
  private admin?: KafkaJS.Admin;

  private connected = false;

  constructor(
    @Inject(RELAY_CONFIG)
    private readonly config: RelayConfig,
  ) {
    // Built eagerly: the constructors open no connection, so the service still starts with Kafka down.
    if (this.config.enabled) {
      this.createClients();
    }
  }

  /**
   * Builds both clients or neither. A producer built before admin() throws is dropped:
   * librdkafka opens no connection before connect(), so there is nothing to disconnect.
   */
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

    const producer = kafka.producer({
      kafkaJS: {
        acks: -1,
        idempotent: true,
        maxInFlightRequests: 1,
        timeout: this.config.deliveryMs,
        retry: { retries: 5 },
      },
      'delivery.timeout.ms': this.config.deliveryMs,
    });
    const admin = kafka.admin();

    this.producer = producer;
    this.admin = admin;
  }

  async ready(): Promise<RelayReadiness> {
    if (!this.config.enabled)
      return { status: 'broker-failure', code: 'OUTBOX_DISABLED' };

    if (!this.producer || !this.admin) {
      // No probe can run without clients, so the build failure is the only code there is.
      const buildFailureCode = this.buildClients();
      if (buildFailureCode)
        return { status: 'broker-failure', code: buildFailureCode };
    }

    try {
      const admin = this.requireAdmin();
      if (!this.connected) {
        await admin.connect();

        try {
          await this.requireProducer().connect();
        } catch (error) {
          await admin.disconnect();
          throw error;
        }

        this.connected = true;
      }

      const existingTopics = await admin.listTopics({
        timeout: this.config.probeMs,
      });
      if ([this.config.topic].some((topic) => !existingTopics.includes(topic)))
        return { status: 'missing-topics', topics: [this.config.topic] };
      return { status: 'ready' };
    } catch (error) {
      const probeFailure = this.readinessFailure(error);
      if (this.connected) return probeFailure;

      const rebuildCode = await this.replaceClients();
      // The probe's code stays the reason; a failed rebuild is attached, not swapped in.
      if (rebuildCode && probeFailure.status === 'broker-failure') {
        return { ...probeFailure, rebuildCode };
      }
      return probeFailure;
    }
  }

  /**
   * Clients that failed to connect cannot reconnect: disconnect them, clear the fields and
   * build new ones. Returns the classified code if the build throws.
   */
  private async replaceClients(): Promise<string | undefined> {
    await Promise.allSettled([
      this.producer?.disconnect(),
      this.admin?.disconnect(),
    ]);
    this.producer = undefined;
    this.admin = undefined;

    return this.buildClients();
  }

  /**
   * Returns undefined when the clients were built, otherwise the classified code of the throw.
   * After a throw the fields stay empty, so the next ready() builds them again.
   */
  private buildClients(): string | undefined {
    try {
      this.createClients();
      return undefined;
    } catch (error) {
      return classifyError(error).code;
    }
  }

  private readinessFailure(error: unknown): RelayReadiness {
    const { code } = classifyError(error);
    return code === OUTBOX_TOPIC_MISSING
      ? { status: 'missing-topics', topics: [this.config.topic] }
      : { status: 'broker-failure', code };
  }

  private requireProducer(): KafkaJS.Producer {
    if (!this.producer) throw new Error('Kafka producer is not built');
    return this.producer;
  }

  private requireAdmin(): KafkaJS.Admin {
    if (!this.admin) throw new Error('Kafka admin is not built');
    return this.admin;
  }

  async send(rows: OutboxRow[]): Promise<PromiseSettledResult<void>[]> {
    // Enqueue the entire claim before awaiting delivery. A single multi-message
    // send rejects on the first failure and hides the other delivery outcomes.
    // Keeping one promise per event lets us drain every report and retry only
    // failed events; librdkafka still batches the concurrent sends on the wire.
    return Promise.allSettled(
      rows.map(async (row) => {
        await this.requireProducer().send({
          topic: this.config.topic,
          messages: [message(row)],
        });
      }),
    );
  }

  async close(): Promise<void> {
    if (!this.config.enabled) return;

    await Promise.allSettled([
      this.producer?.disconnect(),
      this.admin?.disconnect(),
    ]);

    this.connected = false;
  }
}
