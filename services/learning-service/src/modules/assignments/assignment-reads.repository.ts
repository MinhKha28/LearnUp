import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toSafeNumber } from '../../common/utils/to-safe-number';
import { enrollmentDisplayStatusSql } from '../enrollments/enrollment-display-status.sql';

import type { AssignmentStatus } from './assignment-list-query.dto';

export interface AssignmentFilters {
  learnerIds?: string[];
  courseIds?: string[];
  status?: AssignmentStatus;
  dueFrom?: string;
  dueTo?: string;
}

export interface AssignmentRow {
  enrollmentId: string;
  learnerId: string;
  courseId: string;
  assignedAt: Date | null;
  dueAt: Date | null;
  dueTimezone: string | null;
  status: string;
  baseDueAt: Date | null;
  extensionSeconds: bigint;
  firstActivityAt: Date | null;
  completedAt: Date | null;
  completedLate: boolean | null;
  withdrawnAt: Date | null;
  withdrawnReason: string | null;
}

const columns = (
  status: Prisma.Sql,
) => Prisma.sql`e.id AS "enrollmentId", e.learner_id AS "learnerId",
  e.course_id AS "courseId", e.assigned_at AS "assignedAt", e.due_at AS "dueAt", e.due_timezone AS "dueTimezone",
  ${status} AS status, e.base_due_at AS "baseDueAt",
  e.extension_seconds AS "extensionSeconds", e.first_activity_at AS "firstActivityAt",
  e.completed_at AS "completedAt", e.completed_late AS "completedLate",
  e.withdrawn_at AS "withdrawnAt", e.withdrawn_reason AS "withdrawnReason"`;
const scope = (organizationId: string) =>
  Prisma.sql`e.organization_id = ${organizationId}::uuid AND e.enrollment_type = 'Required'`;

export const assignmentDetailSql = (
  organizationId: string,
  id: string,
  status = enrollmentDisplayStatusSql('e'),
) =>
  Prisma.sql`SELECT ${columns(status)} FROM enrollments e WHERE ${scope(organizationId)} AND e.id = ${id}::uuid`;

// Only local midnight crosses a calendar boundary when shifted back by one
// millisecond, the precision of the timestamp sent to the browser.
const displayedDate = Prisma.sql`(
  (e.due_at AT TIME ZONE e.due_timezone) - INTERVAL '1 millisecond'
)::date`;

function assignmentWhere(organizationId: string, filters: AssignmentFilters) {
  const where = [scope(organizationId)];
  if (filters.learnerIds)
    where.push(Prisma.sql`e.learner_id = ANY(${filters.learnerIds}::uuid[])`);
  if (filters.courseIds)
    where.push(Prisma.sql`e.course_id = ANY(${filters.courseIds}::uuid[])`);
  if (filters.status)
    where.push(
      Prisma.sql`${enrollmentDisplayStatusSql('e')} = ${filters.status}`,
    );
  if (filters.dueFrom || filters.dueTo)
    where.push(
      Prisma.sql`${displayedDate} <@ daterange(${filters.dueFrom ?? null}::date, ${filters.dueTo ?? null}::date, '[]')`,
    );
  return Prisma.join(where, ' AND ');
}

export const assignmentCountSql = (
  organizationId: string,
  filters: AssignmentFilters = {},
) =>
  Prisma.sql`SELECT count(*) AS n FROM enrollments e WHERE ${assignmentWhere(organizationId, filters)}`;

export const assignmentPageSql = (
  organizationId: string,
  offset: number,
  filters: AssignmentFilters = {},
) =>
  Prisma.sql`SELECT ${columns(enrollmentDisplayStatusSql('e'))} FROM enrollments e WHERE ${assignmentWhere(organizationId, filters)}
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

  filteredPage(
    organizationId: string,
    offset: number,
    filters: AssignmentFilters,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ n: bigint }[]>(
          assignmentCountSql(organizationId, filters),
        );
        const total = toSafeNumber(row.n);
        const rows =
          offset >= total
            ? []
            : await tx.$queryRaw<AssignmentRow[]>(
                assignmentPageSql(organizationId, offset, filters),
              );
        return { total, rows };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async detail(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ) {
    const [row] = await (tx ?? this.prisma).$queryRaw<AssignmentRow[]>(
      assignmentDetailSql(
        organizationId,
        id,
        tx ? Prisma.sql`e.status` : undefined,
      ),
    );
    return row ?? null;
  }

  intervals(
    organizationId: string,
    enrollmentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).enrollmentStatusInterval.findMany({
      where: { organizationId, enrollmentId },
      select: { kind: true, startedAt: true, endedAt: true, reason: true },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    });
  }
}
