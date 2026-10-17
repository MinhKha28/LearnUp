import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toSafeNumber } from '../../common/utils/to-safe-number';
import { enrollmentDisplayStatusSql } from '../enrollments/enrollment-display-status.sql';

export interface AssignmentRow {
  enrollmentId: string;
  learnerId: string;
  courseId: string;
  assignedAt: Date | null;
  dueAt: Date | null;
  status: string;
  baseDueAt: Date | null;
  extensionSeconds: bigint;
  firstActivityAt: Date | null;
  completedAt: Date | null;
  completedLate: boolean | null;
  withdrawnAt: Date | null;
  withdrawnReason: string | null;
}

const columns = Prisma.sql`e.id AS "enrollmentId", e.learner_id AS "learnerId",
  e.course_id AS "courseId", e.assigned_at AS "assignedAt", e.due_at AS "dueAt",
  ${enrollmentDisplayStatusSql('e')} AS status, e.base_due_at AS "baseDueAt",
  e.extension_seconds AS "extensionSeconds", e.first_activity_at AS "firstActivityAt",
  e.completed_at AS "completedAt", e.completed_late AS "completedLate",
  e.withdrawn_at AS "withdrawnAt", e.withdrawn_reason AS "withdrawnReason"`;
const scope = (organizationId: string) =>
  Prisma.sql`e.organization_id = ${organizationId}::uuid AND e.enrollment_type = 'Required'`;

export const assignmentDetailSql = (organizationId: string, id: string) =>
  Prisma.sql`SELECT ${columns} FROM enrollments e WHERE ${scope(organizationId)} AND e.id = ${id}::uuid`;

export const assignmentCountSql = (organizationId: string) =>
  Prisma.sql`SELECT count(*) AS n FROM enrollments e WHERE ${scope(organizationId)}`;

export const assignmentPageSql = (organizationId: string, offset: number) =>
  Prisma.sql`SELECT ${columns} FROM enrollments e WHERE ${scope(organizationId)}
    ORDER BY CASE WHEN e.status = 'Completed' THEN 1 ELSE 0 END,
      CASE WHEN e.status <> 'Completed' THEN e.due_at END ASC,
      CASE WHEN e.status = 'Completed' THEN e.completed_at END DESC,
      e.id DESC LIMIT 20 OFFSET ${offset}::bigint`;

@Injectable()
export class AssignmentReadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(organizationId: string) {
    const [row] = await this.prisma.$queryRaw<{ n: bigint }[]>(
      assignmentCountSql(organizationId),
    );
    return toSafeNumber(row.n);
  }

  page(organizationId: string, offset: number) {
    return this.prisma.$queryRaw<AssignmentRow[]>(
      assignmentPageSql(organizationId, offset),
    );
  }

  async detail(organizationId: string, id: string) {
    const [row] = await this.prisma.$queryRaw<AssignmentRow[]>(
      assignmentDetailSql(organizationId, id),
    );
    return row ?? null;
  }

  intervals(organizationId: string, enrollmentId: string) {
    return this.prisma.enrollmentStatusInterval.findMany({
      where: { organizationId, enrollmentId },
      select: { kind: true, startedAt: true, endedAt: true, reason: true },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    });
  }
}
