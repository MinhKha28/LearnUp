import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RELAY_CONFIG, type RelayConfig, retryDelay } from './relay.config';

export interface OutboxRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  organization_id: string | null;
  payload: Prisma.InputJsonObject;
  occurred_at: Date;
  attempts: number;
}
export const claimSql = (limit: number) => Prisma.sql`
  SELECT o.* FROM outbox_events o
  WHERE o.published_at IS NULL
    AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= now())
    AND NOT EXISTS (SELECT 1 FROM outbox_events p
      WHERE p.aggregate_id = o.aggregate_id AND p.published_at IS NULL AND p.id < o.id)
  ORDER BY o.id LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
export const cleanupSql = Prisma.sql`
  DELETE FROM outbox_events WHERE id IN (
    SELECT id FROM outbox_events WHERE published_at < now() - interval '7 days'
    ORDER BY id LIMIT 1000 FOR UPDATE SKIP LOCKED)`;

/** Field names to erase from persisted payloads after Kafka acknowledges delivery. */
export const secretFields: Readonly<Record<string, readonly string[]>> = {
  EnrollmentAssigned: [],
  EnrollmentDueDateExtended: [],
  EnrollmentExempted: [],
  LearnerWithdrew: [],
};
export function redactPayload(
  type: string,
  payload: Prisma.InputJsonObject,
  fields = secretFields,
): Prisma.InputJsonObject {
  const copy = { ...payload };
  for (const key of fields[type] ?? []) delete copy[key];
  return copy;
}
@Injectable()
export class RelayRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELAY_CONFIG) private readonly config: RelayConfig,
  ) {}
  transaction(
    work: (tx: Prisma.TransactionClient, rows: OutboxRow[]) => Promise<void>,
  ): Promise<void> {
    return this.prisma.$transaction(
      async (tx) =>
        work(
          tx,
          await tx.$queryRaw<OutboxRow[]>(claimSql(this.config.batchSize)),
        ),
      {
        timeout: this.config.transactionMs,
        maxWait: 1000,
      },
    );
  }
  async published(tx: Prisma.TransactionClient, row: OutboxRow): Promise<void> {
    await tx.$executeRaw`UPDATE outbox_events SET published_at=clock_timestamp(),
      payload=${JSON.stringify(redactPayload(row.event_type, row.payload))}::jsonb,
      last_error=NULL, next_attempt_at=NULL, updated_at=clock_timestamp() WHERE id=${row.id}::uuid`;
  }
  async failed(
    tx: Prisma.TransactionClient,
    row: OutboxRow,
    code: string,
  ): Promise<void> {
    await tx.$executeRaw`UPDATE outbox_events SET attempts=attempts+1, last_error=${code},
      next_attempt_at=clock_timestamp() + ${retryDelay(row.attempts + 1, this.config)} * interval '1 millisecond',
      updated_at=clock_timestamp() WHERE id=${row.id}::uuid`;
  }
  async cleanup(): Promise<void> {
    await this.prisma.$executeRaw(cleanupSql);
  }
}
