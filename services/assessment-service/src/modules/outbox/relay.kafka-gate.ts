import { OUTBOX_TOPIC_MISSING, OUTBOX_UNKNOWN } from '@learnup/ts-common';
import { Inject, Injectable } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  RELAY_CONFIG,
  topicOf,
  topicsOf,
  type RelayConfig,
} from './relay.config';
import {
  GateFailure,
  OutboxGate,
  toGateFailure,
  type GateReadiness,
} from './relay.gate';
import type { RelayRow } from './relay.repository';

/** How many probes in a row may fail before the clients are thrown away and made again. */
const PROBES_BEFORE_NEW_CLIENTS = 3;

/** Aggregate failures are missing-only only when every cause is missing. */
export function readinessFailure(
  error: unknown,
  topics: string[],
): GateReadiness {
  if (error instanceof AggregateError) {
    if (error.errors.length === 0)
      return { status: 'broker-failure', code: OUTBOX_UNKNOWN };
    for (const cause of error.errors) {
      const result = readinessFailure(cause, topics);
      if (result.status === 'broker-failure') return result;
    }
    return { status: 'missing-topics', topics };
  }
  const failure = toGateFailure(error);
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
  /** Both are undefined only after a failed rebuild; the next ready() builds them again. */
  private producer?: KafkaJS.Producer;
  private admin?: KafkaJS.Admin;
  private connected = false;
  /** Counts the times the clients were replaced, so a probe that was left behind does not touch the new ones. */
  private generation = 0;
  private failedProbes = 0;
  /** The longest a probe may take: the first connection (idempotent producer included) is slower than a probe of a live one. */
  private readonly budgetMs: number;

  constructor(@Inject(RELAY_CONFIG) private readonly config: RelayConfig) {
    super();
    this.budgetMs = Math.max(config.probeMs * 5, config.deliveryMs);
    // Built eagerly: the constructors open no connection, so the service still starts with Kafka down.
    this.createClients();
  }

  /**
   * Builds both clients or neither. A producer built before admin() throws is dropped:
   * librdkafka opens no connection before connect(), so there is nothing to disconnect.
   */
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
    const producer = kafka.producer({
      kafkaJS: {
        acks: -1,
        idempotent: true,
        maxInFlightRequests: 1,
        timeout: config.deliveryMs,
        retry: { retries: 5 },
      },
      'delivery.timeout.ms': config.deliveryMs,
    });
    const admin = kafka.admin();
    this.producer = producer;
    this.admin = admin;
  }

  /**
   * Returns undefined when the clients were built. A throw becomes the same readiness
   * failure a failed probe returns, and the fields stay empty for the next ready().
   */
  private buildClients(): GateReadiness | undefined {
    try {
      this.createClients();
      return undefined;
    } catch (error) {
      return readinessFailure(error, topicsOf(this.config));
    }
  }

  private requireProducer(): KafkaJS.Producer {
    if (!this.producer) throw new Error('Kafka producer is not built');
    return this.producer;
  }

  private requireAdmin(): KafkaJS.Admin {
    if (!this.admin) throw new Error('Kafka admin is not built');
    return this.admin;
  }

  /**
   * Bound readiness by the delivery timeout or five probe timeouts, whichever is longer.
   * Failed or timed-out probes replace disconnected clients immediately. Connected
   * clients are replaced after three consecutive broker failures; missing topics do not count.
   */
  async ready(): Promise<GateReadiness> {
    if (!this.producer || !this.admin) {
      const buildFailure = this.buildClients();
      if (buildFailure) return buildFailure;
    }
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
      if (!this.connected || this.failedProbes >= PROBES_BEFORE_NEW_CLIENTS) {
        const replacementFailure = this.replaceClients();
        if (replacementFailure) return replacementFailure;
      }
    }
    return answered;
  }

  /** Disconnects the current clients, clears the fields and builds new ones; returns a readiness failure if the build throws. */
  private replaceClients(): GateReadiness | undefined {
    this.generation += 1;
    this.connected = false;
    this.failedProbes = 0;
    const producer = this.producer;
    const admin = this.admin;
    this.producer = undefined;
    this.admin = undefined;
    void Promise.allSettled([producer?.disconnect(), admin?.disconnect()]);
    return this.buildClients();
  }

  /** A fresh metadata request, so a broker that went away is noticed before the relay locks any row. */
  private async probe(generation: number): Promise<GateReadiness> {
    try {
      // The clients of this probe's generation; a replacement during the probe does not swap them.
      const admin = this.requireAdmin();
      const producer = this.requireProducer();
      if (!this.connected) {
        await admin.connect();
        try {
          await producer.connect();
        } catch (error) {
          await admin.disconnect();
          throw error;
        }
        if (generation !== this.generation)
          return { status: 'broker-failure', code: 'OUTBOX_STALE_PROBE' };
        this.connected = true;
      }
      const existingTopics = await admin.listTopics({
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
      await this.requireProducer().sendBatch({
        topicMessages: [...byTopic].map(([topic, messages]) => ({
          topic,
          messages,
        })),
      });
    } catch (error) {
      // send() rejects on the first failure: let the other delivery reports of the batch arrive before the relay retries.
      const failure = toGateFailure(error);
      if (failure.individual) {
        await this.requireProducer().flush({
          timeout: Math.max(1, this.config.deliveryMs - (Date.now() - started)),
        });
      }
      throw failure;
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await Promise.allSettled([
        this.producer?.disconnect(),
        this.admin?.disconnect(),
      ]);
      this.connected = false;
    }
  }
}
