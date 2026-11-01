import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { RELAY_CONFIG, retryDelay } from './relay.config';

import type { RelayConfig } from './interfaces/relay-config.interface';
import type { OutboxRow } from './interfaces/outbox-row.interface';

export const claimSql = (limit: number) => Prisma.sql`
  SELECT
    o.id,
    o.aggregate_type,
    o.aggregate_id,
    o.event_type,
    o.organization_id,
    o.payload,
    o.occurred_at,
    o.attempts
  FROM outbox_events o
  WHERE o.published_at IS NULL
    AND o.aggregate_type = 'Course'
    AND o.event_type IN (
      'CourseDisabled',
      'CourseReactivated',
      'CourseComponentDisabled',
      'CourseComponentReactivated'
    )
    AND (
      o.next_attempt_at IS NULL
      OR o.next_attempt_at <= now()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM outbox_events p
      WHERE p.aggregate_type = 'Course'
        AND p.aggregate_id = o.aggregate_id
        AND p.published_at IS NULL
        AND p.event_type IN (
          'CourseDisabled',
          'CourseReactivated',
          'CourseComponentDisabled',
          'CourseComponentReactivated'
        )
        AND p.id < o.id
    )
  ORDER BY o.id
  LIMIT ${limit}
  FOR UPDATE OF o SKIP LOCKED
`;

@Injectable()
export class RelayRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELAY_CONFIG)
    private readonly config: RelayConfig,
  ) {}

  transaction(
    work: (tx: Prisma.TransactionClient, rows: OutboxRow[]) => Promise<void>,
  ): Promise<void> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<OutboxRow[]>(
          claimSql(this.config.batchSize),
        );

        await work(tx, rows);
      },
      {
        timeout: this.config.transactionMs,
        maxWait: 1000,
      },
    );
  }

  async published(tx: Prisma.TransactionClient, row: OutboxRow): Promise<void> {
    await tx.$executeRaw`
      UPDATE outbox_events
      SET
        published_at = clock_timestamp(),
        last_error = NULL,
        next_attempt_at = NULL,
        updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid
        AND published_at IS NULL
    `;
  }

  async failed(
    tx: Prisma.TransactionClient,
    row: OutboxRow,
    code: string,
  ): Promise<void> {
    const delay = retryDelay(row.attempts + 1, this.config);

    await tx.$executeRaw`
      UPDATE outbox_events
      SET
        attempts = attempts + 1,
        last_error = ${code},
        next_attempt_at =
          clock_timestamp() +
          ${delay} * interval '1 millisecond',
        updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid
        AND published_at IS NULL
    `;
  }
}
