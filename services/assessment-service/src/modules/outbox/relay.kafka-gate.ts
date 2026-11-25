import { isKafkaTopicMissing, OUTBOX_TOPIC_MISSING } from '@learnup/ts-common';
import { Inject, Injectable } from '@nestjs/common';
import { CODES, KafkaJS } from '@confluentinc/kafka-javascript';
import {
  RELAY_CONFIG,
  topicOf,
  topicsOf,
  type RelayConfig,
} from './relay.config';
import { GateFailure, OutboxGate, type GateReadiness } from './relay.gate';
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
  if (isKafkaTopicMissing(code)) return new GateFailure(OUTBOX_TOPIC_MISSING);
  if (typeof code === 'number' && Number.isInteger(code))
    return new GateFailure(`KAFKA_${code}`, messageCodes.has(code));
  return new GateFailure('OUTBOX_UNKNOWN');
}

/** Aggregate failures are missing-only only when every cause is missing. */
export function readinessFailure(
  error: unknown,
  topics: string[],
): GateReadiness {
  if (error instanceof AggregateError) {
    if (error.errors.length === 0)
      return { status: 'broker-failure', code: 'OUTBOX_UNKNOWN' };
    for (const cause of error.errors) {
      const result = readinessFailure(cause, topics);
      if (result.status === 'broker-failure') return result;
    }
    return { status: 'missing-topics', topics };
  }
  const failure = classifyError(error);
  return failure.code === OUTBOX_TOPIC_MISSING
    ? { status: 'missing-topics', topics }
    : { status: 'broker-failure', code: failure.code };
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
   * Bound readiness by the delivery timeout or five probe timeouts, whichever is longer.
   * Failed or timed-out probes replace disconnected clients immediately. Connected
   * clients are replaced after three consecutive broker failures; missing topics do not count.
   */
  async ready(): Promise<GateReadiness> {
    const generation = this.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<GateReadiness>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({ status: 'broker-failure', code: 'OUTBOX_PROBE_TIMEOUT' }),
        this.budgetMs,
      );
    });
    const answered = await Promise.race([this.probe(generation), timedOut]);
    clearTimeout(timer);
    if (answered.status !== 'broker-failure') {
      this.failedProbes = 0;
    } else if (this.generation === generation) {
      // Missing topics do not damage clients; only broker failures count here.
      this.failedProbes += 1;
      if (!this.connected || this.failedProbes >= PROBES_BEFORE_NEW_CLIENTS)
        this.replaceClients();
    }
    return answered;
  }

  private replaceClients(): void {
    this.generation += 1;
    this.connected = false;
    this.failedProbes = 0;
    void Promise.allSettled([
      this.producer.disconnect(),
      this.admin.disconnect(),
    ]);
    this.createClients();
  }

  /** A fresh metadata request, so a broker that went away is noticed before the relay locks any row. */
  private async probe(generation: number): Promise<GateReadiness> {
    try {
      if (!this.connected) {
        await this.admin.connect();
        try {
          await this.producer.connect();
        } catch (error) {
          await this.admin.disconnect();
          throw error;
        }
        if (generation !== this.generation)
          return { status: 'broker-failure', code: 'OUTBOX_STALE_PROBE' };
        this.connected = true;
      }
      const existingTopics = await this.admin.listTopics({
        timeout: this.config.probeMs,
      });
      if (generation !== this.generation)
        return { status: 'broker-failure', code: 'OUTBOX_STALE_PROBE' };
      const missingTopics = topicsOf(this.config).filter(
        (topic) => !existingTopics.includes(topic),
      );
      return missingTopics.length
        ? { status: 'missing-topics', topics: missingTopics }
        : { status: 'ready' };
    } catch (error) {
      return readinessFailure(error, topicsOf(this.config));
    }
  }

  async send(rows: RelayRow[]): Promise<void> {
    // One batch, the topic of each event (its order inside a topic is the order of the rows).
    const byTopic = new Map<string, { key: string; value: string }[]>();
    for (const row of rows) {
      const topic = topicOf(row.event_type, this.config);
      byTopic.set(topic, [...(byTopic.get(topic) ?? []), message(row)]);
    }
    const started = Date.now();
    try {
      await this.producer.sendBatch({
        topicMessages: [...byTopic].map(([topic, messages]) => ({
          topic,
          messages,
        })),
      });
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
