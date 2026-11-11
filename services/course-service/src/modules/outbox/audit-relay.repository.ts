import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface CourseAuditRow {
  id: string;
  organization_id: string;
  aggregate_id: string;
  payload: Prisma.JsonValue;
  occurred_at: Date;
  attempts: number;
  lease_until: Date;
}

/**
 * Course Audit uses its own claim cursor. The Kafka relay only selects
 * aggregate_type='Course', so a failed Audit cannot block notifications.
 * Claiming is atomic and short: no HTTP request occurs inside a DB transaction.
 */
@Injectable()
export class CourseAuditRelayRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(): Promise<CourseAuditRow | null> {
    const rows = await this.prisma.$queryRaw<CourseAuditRow[]>(Prisma.sql`
      WITH next_event AS (
        SELECT id
        FROM outbox_events
        WHERE aggregate_type = 'CourseAudit'
          AND event_type = 'AuditRecorded'
          AND published_at IS NULL
          AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp())
        ORDER BY id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events o
      SET next_attempt_at = date_trunc('milliseconds', clock_timestamp()) + interval '30 seconds',
          updated_at = clock_timestamp()
      FROM next_event
      WHERE o.id = next_event.id
      RETURNING o.id, o.organization_id, o.aggregate_id, o.payload,
                o.occurred_at, o.attempts,
                o.next_attempt_at AS lease_until
    `);
    return rows[0] ?? null;
  }

  async complete(row: CourseAuditRow): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET published_at = clock_timestamp(),
          next_attempt_at = NULL,
          last_error = NULL,
          updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid
        AND published_at IS NULL
        AND next_attempt_at = ${row.lease_until}
    `;
  }

  async retry(row: CourseAuditRow, code: string): Promise<void> {
    const backoffMs = Math.min(
      300000,
      1000 * 2 ** Math.min(row.attempts, 8),
    );
    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET attempts = attempts + 1,
          last_error = ${code},
          next_attempt_at =
            clock_timestamp() + ${backoffMs} * interval '1 millisecond',
          updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid
        AND published_at IS NULL
        AND next_attempt_at = ${row.lease_until}
    `;
  }
}
