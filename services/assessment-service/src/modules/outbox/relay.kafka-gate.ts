import { Inject, Injectable } from '@nestjs/common';
import { CODES, KafkaJS } from '@confluentinc/kafka-javascript';
import { RELAY_CONFIG, type RelayConfig } from './relay.config';
import { GateFailure, OutboxGate } from './relay.gate';
import type { RelayRow } from './relay.repository';

const errors = CODES.ERRORS;

/** How many probes in a row may fail before the clients are thrown away and made again. */
const PROBES_BEFORE_NEW_CLIENTS = 3;

/** Codes that say the message itself is the problem, not the broker. */
const messageCodes = new Set<number>([
  errors.ERR_MSG_SIZE_TOO_LARGE,
  errors.ERR__KEY_SERIALIZATION,
  errors.ERR__VALUE_SERIALIZATION,
  errors.ERR_INVALID_MSG,
  errors.ERR_INVALID_MSG_SIZE,
]);

/** What the failure is called in `last_error`: a fixed identifier, never the text of the error. */
export function classifyError(error: unknown): GateFailure {
  if (error instanceof GateFailure) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  if (typeof code === 'number' && Number.isInteger(code))
    return new GateFailure(`KAFKA_${code}`, messageCodes.has(code));
  return new GateFailure('OUTBOX_UNKNOWN');
}

/**
 * The message of one event: the key is the Learner (learning reads the events of one Learner in order), and the value is
 * the envelope every LearnUP event has. A row without an organization or with a payload that is not an object cannot be
 * a message, and says so as a failure of that row only.
 */
export function message(row: RelayRow): { key: string; value: string } {
  const payload = row.payload as Record<string, unknown> | null;
  if (
    !row.organization_id ||
    !payload ||
    Array.isArray(payload) ||
    typeof payload !== 'object' ||
    typeof payload.learnerId !== 'string'
  )
    throw new GateFailure('OUTBOX_SERIALIZATION', true);
  return {
    key: payload.learnerId,
    value: JSON.stringify({
      eventId: row.id,
      eventType: row.event_type,
      version: 1,
      occurredAt: row.occurred_at.toISOString(),
      organizationId: row.organization_id,
      producer: 'assessment-service',
      data: row.payload,
    }),
  };
}

/** Kafka behind the relay: idempotent producer, every replica must acknowledge, and the broker is probed before any lock. */
@Injectable()
export class KafkaOutboxGate extends OutboxGate {
  private producer!: KafkaJS.Producer;
  private admin!: KafkaJS.Admin;
  private connected = false;
  private initialized = false;
  /** Counts the times the clients were replaced, so a probe that was left behind does not touch the new ones. */
  private generation = 0;
  private failedProbes = 0;
  /** The longest a probe may take: the first connection (idempotent producer included) is slower than a probe of a live one. */
  private readonly budgetMs: number;

  constructor(@Inject(RELAY_CONFIG) private readonly config: RelayConfig) {
    super();
    this.budgetMs = Math.max(config.probeMs * 5, config.deliveryMs);
    this.createClients();
  }

  private createClients(): void {
    const config = this.config;
    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: config.brokers,
        clientId: 'assessment-service',
        connectionTimeout: config.probeMs,
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
        timeout: config.deliveryMs,
        retry: { retries: 5 },
      },
      'delivery.timeout.ms': config.deliveryMs,
    });
    this.admin = kafka.admin();
  }

  /**
   * Whether Kafka answers now, bounded: a broker that does not answer at all (no refusal, no reply) must not keep the relay
   * waiting longer than the delivery timeout (or five times the probe timeout, if that is more). A probe that runs out of time is abandoned and the clients are replaced.
   */
  async ready(): Promise<boolean> {
    const generation = this.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), this.budgetMs);
    });
    const answered = await Promise.race([this.probe(generation), timedOut]);
    clearTimeout(timer);
    if (answered) {
      this.failedProbes = 0;
    } else if (this.generation === generation) {
      // A probe that ran out of time, or the third in a row that failed: do not depend on what state the old clients are in.
      this.failedProbes += 1;
      if (!this.connected || this.failedProbes >= PROBES_BEFORE_NEW_CLIENTS)
        this.replaceClients();
    }
    return answered;
  }

  private replaceClients(): void {
    this.generation += 1;
    this.connected = false;
    this.initialized = false;
    this.failedProbes = 0;
    void Promise.allSettled([
      this.producer.disconnect(),
      this.admin.disconnect(),
    ]);
    this.createClients();
  }

  /** A fresh metadata request, so a broker that went away is noticed before the relay locks any row. */
  private async probe(generation: number): Promise<boolean> {
    try {
      if (!this.connected) {
        await this.admin.connect();
        try {
          await this.producer.connect();
        } catch (error) {
          await this.admin.disconnect();
          throw error;
        }
        if (generation !== this.generation) return false;
        this.connected = true;
      }
      if (this.initialized) {
        await this.admin.fetchTopicMetadata({
          topics: [this.config.topic],
          timeout: this.config.probeMs,
        });
      } else {
        await this.admin.listTopics({ timeout: this.config.probeMs });
        try {
          await this.admin.createTopics({
            timeout: this.config.probeMs,
            topics: [
              {
                topic: this.config.topic,
                numPartitions: 3,
                replicationFactor: this.config.replicationFactor,
                configEntries: [{ name: 'retention.ms', value: '2592000000' }],
              },
            ],
          });
        } catch (error) {
          if (
            (error as { code?: number }).code !==
            errors.ERR_TOPIC_ALREADY_EXISTS
          )
            throw error;
        }
        if (generation !== this.generation) return false;
        this.initialized = true;
      }
      return true;
    } catch {
      // The caller decides whether to make the clients again (a Confluent client cannot reconnect after its first connection failed).
      return false;
    }
  }

  async send(rows: RelayRow[]): Promise<void> {
    const messages = rows.map(message);
    const started = Date.now();
    try {
      await this.producer.send({ topic: this.config.topic, messages });
    } catch (error) {
      // send() rejects on the first failure: let the other delivery reports of the batch arrive before the relay retries.
      if (classifyError(error).individual) {
        await this.producer.flush({
          timeout: Math.max(1, this.config.deliveryMs - (Date.now() - started)),
        });
      }
      throw classifyError(error);
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await Promise.allSettled([
        this.producer.disconnect(),
        this.admin.disconnect(),
      ]);
      this.connected = false;
    }
  }
}
