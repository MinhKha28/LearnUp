import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

export interface LockedAssignment {
  id: string;
  learnerId: string;
  courseId: string;
  status: string;
  dueAt: Date;
}

@Injectable()
export class AssignmentChangesRepository {
  async lock(tx: Prisma.TransactionClient, organizationId: string, id: string) {
    const [row] = await tx.$queryRaw<LockedAssignment[]>`
      SELECT id, learner_id AS "learnerId", course_id AS "courseId", status, due_at AS "dueAt"
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
  ) {
    return tx.$executeRaw`UPDATE enrollments SET due_at = ${dueAt},
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
