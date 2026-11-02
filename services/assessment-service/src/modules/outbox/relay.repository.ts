import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LEARNER_STATUS_CHANGED_EVENT } from '../learner-submissions/learner-submissions.constants';
import { RELAY_CONFIG, retryDelay, type RelayConfig } from './relay.config';

/**
 * The events the relay publishes. `AssignmentMinutesChanged` is not among them: it goes to course-service by REST right
 * after its commit and is marked sent by that call (see AssessmentsService), so the relay must leave it alone.
 */
export const RELAYED_EVENT_TYPES: readonly string[] = [
  LEARNER_STATUS_CHANGED_EVENT,
];

export interface RelayRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  organization_id: string | null;
  payload: Prisma.InputJsonObject;
  occurred_at: Date;
  attempts: number;
}

/**
 * The rows of one batch: not sent yet, due, and the oldest of their Learner (a row waits while an older one of the same
 * Learner is not sent, whatever Assessment it is about, so the events of a Learner go out in the order they were written,
 * even when a relay fails or holds the older row). The Learner is the Kafka key, and Kafka keeps order only within a key,
 * so this is the order the consumers can count on. `SKIP LOCKED` lets two relays, or two instances, take different rows.
 */
export const claimSql = (limit: number, types: readonly string[]) => Prisma.sql`
  SELECT o.id, o.aggregate_id, o.event_type, o.organization_id, o.payload, o.occurred_at, o.attempts
  FROM outbox_events o
  WHERE o.published_at IS NULL
    AND o.event_type IN (${Prisma.join(types)})
    AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= now())
    AND NOT EXISTS (
      SELECT 1 FROM outbox_events p
      WHERE p.payload ->> 'learnerId' = o.payload ->> 'learnerId' AND p.published_at IS NULL
        AND p.event_type IN (${Prisma.join(types)}) AND p.id < o.id)
  ORDER BY o.id
  LIMIT ${limit}
  FOR UPDATE SKIP LOCKED`;

/** Rows sent more than a week ago, a batch at a time; rows not sent are never touched. SKIP LOCKED leaves what another instance is cleaning. */
export const cleanupSql = (types: readonly string[]) => Prisma.sql`
  DELETE FROM outbox_events WHERE id IN (
    SELECT id FROM outbox_events
    WHERE published_at < now() - interval '7 days' AND event_type IN (${Prisma.join(types)})
    ORDER BY id LIMIT 1000 FOR UPDATE SKIP LOCKED)`;

@Injectable()
export class RelayRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELAY_CONFIG) private readonly config: RelayConfig,
  ) {}

  /** Claims a batch and runs the work on it; the locks of the claim last until the work ends. */
  transaction(
    work: (tx: Prisma.TransactionClient, rows: RelayRow[]) => Promise<void>,
  ): Promise<void> {
    return this.prisma.$transaction(
      async (tx) =>
        work(
          tx,
          await tx.$queryRaw<RelayRow[]>(
            claimSql(this.config.batchSize, RELAYED_EVENT_TYPES),
          ),
        ),
      { timeout: this.config.transactionMs, maxWait: 1000 },
    );
  }

  async published(tx: Prisma.TransactionClient, row: RelayRow): Promise<void> {
    await tx.$executeRaw`UPDATE outbox_events
      SET published_at = clock_timestamp(), last_error = NULL, next_attempt_at = NULL, updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid`;
  }

  async cleanup(): Promise<void> {
    await this.prisma.$executeRaw(cleanupSql(RELAYED_EVENT_TYPES));
  }

  /** One more failed attempt: the code of the failure is kept (never its message) and the next try waits longer. */
  async failed(
    tx: Prisma.TransactionClient,
    row: RelayRow,
    code: string,
  ): Promise<void> {
    await tx.$executeRaw`UPDATE outbox_events
      SET attempts = attempts + 1, last_error = ${code},
          next_attempt_at = clock_timestamp() + ${retryDelay(row.attempts + 1, this.config)} * interval '1 millisecond',
          updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid`;
  }
}
