import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AssignmentEnrollment, AssignmentPlan } from './classify-learners';
import { OptionalInsertConflict, concurrentChange } from './assignment-retry';

export interface AssignmentBatch {
  organizationId: string;
  courseId: string;
  assignedBy: string;
  assignedAt: Date;
  dueAt: Date;
  expectedCompletionDays: number;
  videoCompletionPercent: number;
}

export function existingEnrollmentsSql(
  organizationId: string,
  courseId: string,
  learnerIds: string[],
  lock = false,
): Prisma.Sql {
  return Prisma.sql`SELECT id, learner_id AS "learnerId", enrollment_type AS "enrollmentType",
    status, first_activity_at AS "firstActivityAt" FROM enrollments
    WHERE organization_id = ${organizationId}::uuid AND course_id = ${courseId}::uuid
      AND learner_id = ANY(${learnerIds}::uuid[])
    ORDER BY learner_id ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`;
}

export function insertAssignmentsSql(
  plans: AssignmentPlan[],
  batch: AssignmentBatch,
  ids: string[],
): Prisma.Sql {
  return Prisma.sql`INSERT INTO enrollments
    (id, organization_id, learner_id, course_id, enrollment_type, status, assigned_at,
     expected_completion_days, base_due_at, due_at, video_completion_percent)
    SELECT r.id, ${batch.organizationId}::uuid, r.learner_id, ${batch.courseId}::uuid, 'Required',
      'NotStarted', ${batch.assignedAt}, ${batch.expectedCompletionDays}, ${batch.dueAt}, ${batch.dueAt}, ${batch.videoCompletionPercent}
    FROM unnest(${ids}::uuid[], ${plans.map((plan) => plan.learnerId)}::uuid[]) AS r(id, learner_id)
    ON CONFLICT (learner_id, course_id) DO NOTHING RETURNING id`;
}

export function updateAssignmentsSql(
  plans: AssignmentPlan[],
  batch: AssignmentBatch,
): Prisma.Sql {
  return Prisma.sql`UPDATE enrollments e SET
    enrollment_type = 'Required', assigned_at = ${batch.assignedAt},
    expected_completion_days = ${batch.expectedCompletionDays}, base_due_at = ${batch.dueAt},
    due_at = ${batch.dueAt}::timestamptz + e.extension_seconds * interval '1 second',
    status = CASE WHEN p.kind = 'RESTORE' THEN CASE WHEN e.first_activity_at IS NULL THEN 'NotStarted' ELSE 'InProgress' END ELSE e.status END,
    withdrawn_at = CASE WHEN p.kind = 'RESTORE' THEN NULL ELSE e.withdrawn_at END,
    withdrawn_reason = CASE WHEN p.kind = 'RESTORE' THEN NULL ELSE e.withdrawn_reason END,
    completed_late = CASE WHEN p.kind = 'CONVERT_COMPLETED' THEN false ELSE e.completed_late END,
    updated_at = ${batch.assignedAt}
    FROM unnest(${plans.map((plan) => plan.existing!.id)}::uuid[], ${plans.map((plan) => plan.kind)}::text[]) AS p(id, kind)
    WHERE e.id = p.id AND e.organization_id = ${batch.organizationId}::uuid
      AND e.course_id = ${batch.courseId}::uuid
    RETURNING e.id, e.learner_id AS "learnerId", e.due_at AS "dueAt"`;
}

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transactionStartedAt(tx: Prisma.TransactionClient): Promise<Date> {
    const [row] = await tx.$queryRaw<
      { assignedAt: Date }[]
    >`SELECT transaction_timestamp() AS "assignedAt"`;
    return row.assignedAt;
  }

  findExisting(
    organizationId: string,
    courseId: string,
    learnerIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).$queryRaw<AssignmentEnrollment[]>(
      existingEnrollmentsSql(organizationId, courseId, learnerIds, !!tx),
    );
  }

  async write(
    plans: AssignmentPlan[],
    batch: AssignmentBatch,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const creates = plans.filter((plan) => plan.kind === 'CREATE');
    const updates = plans.filter((plan) => plan.kind !== 'CREATE');
    const ids = creates.map(() => randomUUID());
    const rows: { id: string; learnerId: string; dueAt: Date }[] = [];
    if (creates.length) {
      const inserted = await tx.$queryRaw<{ id: string }[]>(
        insertAssignmentsSql(creates, batch, ids),
      );
      if (inserted.length !== creates.length) {
        const insertedIds = new Set(inserted.map((row) => row.id));
        const conflicts = await this.findExisting(
          batch.organizationId,
          batch.courseId,
          creates.map((plan) => plan.learnerId),
          tx,
        );
        if (
          conflicts.some(
            (row) =>
              !insertedIds.has(row.id) && row.enrollmentType === 'Required',
          )
        )
          throw concurrentChange();
        throw new OptionalInsertConflict();
      }
      rows.push(
        ...creates.map((plan, index) => ({
          id: ids[index],
          learnerId: plan.learnerId,
          dueAt: batch.dueAt,
        })),
      );
    }
    if (updates.length)
      rows.push(
        ...(await tx.$queryRaw<
          { id: string; learnerId: string; dueAt: Date }[]
        >(updateAssignmentsSql(updates, batch))),
      );
    const kinds = new Map(plans.map((plan) => [plan.learnerId, plan.kind]));
    await tx.outboxEvent.createMany({
      data: rows.map((row) => ({
        aggregateType: 'Enrollment',
        aggregateId: row.id,
        eventType: 'EnrollmentAssigned',
        organizationId: batch.organizationId,
        occurredAt: batch.assignedAt,
        payload: {
          enrollmentId: row.id,
          organizationId: batch.organizationId,
          learnerId: row.learnerId,
          courseId: batch.courseId,
          assignedBy: batch.assignedBy,
          assignedAt: batch.assignedAt.toISOString(),
          dueAt: row.dueAt.toISOString(),
          kind: kinds.get(row.learnerId)!,
        },
      })),
    });
  }
}
