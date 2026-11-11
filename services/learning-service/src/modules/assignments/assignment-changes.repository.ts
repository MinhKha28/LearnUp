import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { effectiveDeadlineCtes } from '../enrollments/effective-deadline.sql';
import { enrollmentRestoredStatusSql } from '../enrollments/enrollment-restored-status.sql';

export interface LockedAssignment {
  id: string;
  learnerId: string;
  courseId: string;
  status: string;
  dueAt: Date;
  dueAtHasSubMillisecond: boolean;
}

@Injectable()
export class AssignmentChangesRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(organizationId: string, id: string) {
    return this.prisma.enrollment.findFirst({
      where: { id, organizationId, enrollmentType: 'Required' },
      select: { courseId: true, status: true },
    });
  }

  async lock(tx: Prisma.TransactionClient, organizationId: string, id: string) {
    const [row] = await tx.$queryRaw<LockedAssignment[]>`
      SELECT id, learner_id AS "learnerId", course_id AS "courseId", status, due_at AS "dueAt",
        due_at <> date_trunc('milliseconds',due_at) AS "dueAtHasSubMillisecond"
      FROM enrollments WHERE id = ${id}::uuid AND organization_id = ${organizationId}::uuid
        AND enrollment_type = 'Required' FOR UPDATE`;
    return row;
  }

  async clock(tx: Prisma.TransactionClient, timezone: string) {
    const [row] = await tx.$queryRaw<{ now: Date; today: string }[]>`
      SELECT now() AS now, to_char(now() AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS today`;
    return row;
  }

  extend(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    dueAt: Date,
    seconds: bigint,
    dueTimezone: string,
  ) {
    return tx.$executeRaw`UPDATE enrollments SET due_at = ${dueAt}, due_timezone = ${dueTimezone},
      extension_seconds = extension_seconds + ${seconds}::bigint, updated_at = now()
      WHERE id = ${id}::uuid AND organization_id = ${organizationId}::uuid AND enrollment_type = 'Required'`;
  }

  async exempt(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    reason: string,
    now: Date,
  ) {
    await tx.enrollment.update({
      where: { id, organizationId },
      data: { status: 'Exempted' },
    });
    await tx.enrollmentStatusInterval.create({
      data: {
        organizationId,
        enrollmentId: id,
        kind: 'Exempted',
        startedAt: now,
        reason,
      },
    });
  }

  async removeExemption(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    disabled: boolean,
  ) {
    const [closed] = await tx.$queryRaw<{ id: string }[]>`
      WITH removal_time AS MATERIALIZED (SELECT clock_timestamp() AS at)
      UPDATE enrollment_status_intervals
      SET ended_at=GREATEST(started_at,removal_time.at), updated_at=removal_time.at
      FROM removal_time
      WHERE enrollment_id=${id}::uuid AND organization_id=${organizationId}::uuid
        AND kind='Exempted' AND ended_at IS NULL
      RETURNING id`;
    if (!closed) throw new Error('EXEMPTION_INTERVAL_NOT_FOUND');

    if (disabled) {
      // Carry the database timestamp forward without truncating its microseconds.
      await tx.$executeRaw`
        INSERT INTO enrollment_status_intervals
          (id,organization_id,enrollment_id,kind,started_at)
        SELECT gen_random_uuid(),organization_id,enrollment_id,'Halted',ended_at
        FROM enrollment_status_intervals WHERE id=${closed.id}::uuid`;
    }

    await tx.$executeRaw`
      WITH ${effectiveDeadlineCtes(id, organizationId)}, activity AS (
        SELECT min(completed_at) AS first_completed_at FROM material_progress
        WHERE enrollment_id=${id}::uuid AND organization_id=${organizationId}::uuid
      ), restored AS (
        SELECT LEAST(e.first_activity_at,activity.first_completed_at) AS first_activity_at
        FROM enrollments e CROSS JOIN activity
        WHERE e.id=${id}::uuid AND e.organization_id=${organizationId}::uuid
      )
      UPDATE enrollments e SET
        status=CASE WHEN ${disabled} THEN 'Halted'
          ELSE ${enrollmentRestoredStatusSql(Prisma.sql`restored.first_activity_at`)} END,
        first_activity_at=restored.first_activity_at,
        due_at=effective.due_at, updated_at=clock_timestamp()
      FROM effective CROSS JOIN restored
      WHERE e.id=${id}::uuid AND e.organization_id=${organizationId}::uuid`;
  }

  event(
    tx: Prisma.TransactionClient,
    organizationId: string,
    row: LockedAssignment,
    eventType: string,
    now: Date,
    payload: Prisma.InputJsonObject,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: 'Enrollment',
        aggregateId: row.id,
        organizationId,
        eventType,
        occurredAt: now,
        payload: {
          enrollmentId: row.id,
          organizationId,
          learnerId: row.learnerId,
          courseId: row.courseId,
          ...payload,
        },
      },
    });
  }
}
