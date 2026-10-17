import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { enrollmentRestoredStatusSql } from './enrollment-restored-status.sql';
import type { CreatedEnrollment } from './enrollments.repository';

export interface OptionalEnrollmentRow {
  id: string;
  courseId: string;
  learnerId: string;
  organizationId: string;
  enrollmentType: string;
  status: string;
  withdrawnReason: string | null;
}
export const withdrawalLockSql = (
  id: string,
  learnerId: string,
  organizationId: string,
) => Prisma.sql`
  SELECT id, course_id AS "courseId", learner_id AS "learnerId", organization_id AS "organizationId",
    enrollment_type AS "enrollmentType", status, withdrawn_reason AS "withdrawnReason"
  FROM enrollments WHERE id = ${id}::uuid AND learner_id = ${learnerId}::uuid
    AND organization_id = ${organizationId}::uuid FOR UPDATE`;
export const deleteOptionalEnrollmentSql = (
  row: OptionalEnrollmentRow,
) => Prisma.sql`
  DELETE FROM enrollments WHERE id = ${row.id}::uuid AND organization_id = ${row.organizationId}::uuid`;
export const withdrawOptionalEnrollmentSql = (
  row: OptionalEnrollmentRow,
) => Prisma.sql`
  UPDATE enrollments SET status = 'Withdrawn', withdrawn_at = now(), withdrawn_reason = 'LearnerWithdrew', updated_at = now()
  WHERE id = ${row.id}::uuid AND organization_id = ${row.organizationId}::uuid RETURNING withdrawn_at AS "withdrawnAt"`;
export const restoreOptionalEnrollmentSql = (
  row: OptionalEnrollmentRow,
) => Prisma.sql`
  UPDATE enrollments SET enrollment_type = 'Optional', status = ${enrollmentRestoredStatusSql(Prisma.sql`first_activity_at`)},
    withdrawn_at = NULL, withdrawn_reason = NULL, assigned_at = NULL, expected_completion_days = NULL,
    base_due_at = NULL, due_at = NULL, extension_seconds = 0, updated_at = now()
  WHERE id = ${row.id}::uuid AND organization_id = ${row.organizationId}::uuid
  RETURNING id, course_id AS "courseId", enrollment_type AS "enrollmentType", status, enrolled_at AS "enrolledAt"`;

@Injectable()
export class OptionalEnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRegistration(
    learnerId: string,
    courseId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).enrollment.findFirst({
      where: { learnerId, courseId, organizationId },
      select: {
        id: true,
        courseId: true,
        learnerId: true,
        organizationId: true,
        enrollmentType: true,
        status: true,
        withdrawnReason: true,
      },
    });
  }

  findOwned(id: string, learnerId: string, organizationId: string) {
    return this.prisma.enrollment.findFirst({
      where: { id, learnerId, organizationId },
    });
  }

  async lock(
    tx: Prisma.TransactionClient,
    id: string,
    learnerId: string,
    organizationId: string,
  ) {
    const [row] = await tx.$queryRaw<OptionalEnrollmentRow[]>(
      withdrawalLockSql(id, learnerId, organizationId),
    );
    return row ?? null;
  }

  async remove(tx: Prisma.TransactionClient, row: OptionalEnrollmentRow) {
    await tx.$executeRaw(deleteOptionalEnrollmentSql(row));
  }

  async withdraw(tx: Prisma.TransactionClient, row: OptionalEnrollmentRow) {
    const [{ withdrawnAt }] = await tx.$queryRaw<{ withdrawnAt: Date }[]>(
      withdrawOptionalEnrollmentSql(row),
    );
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'Enrollment',
        aggregateId: row.id,
        eventType: 'LearnerWithdrew',
        organizationId: row.organizationId,
        occurredAt: withdrawnAt,
        payload: {
          enrollmentId: row.id,
          learnerId: row.learnerId,
          organizationId: row.organizationId,
          courseId: row.courseId,
          withdrawnAt: withdrawnAt.toISOString(),
        },
      },
    });
  }

  async restore(
    tx: Prisma.TransactionClient,
    row: OptionalEnrollmentRow,
  ): Promise<CreatedEnrollment> {
    const [restored] = await tx.$queryRaw<CreatedEnrollment[]>(
      restoreOptionalEnrollmentSql(row),
    );
    return restored;
  }
}
