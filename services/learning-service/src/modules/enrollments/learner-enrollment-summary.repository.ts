import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { enrollmentDisplayStatusSql } from './enrollment-display-status.sql';

export interface LearnerEnrollmentSummaryRow {
  learnerId: string;
  activeCourseCount: number;
  overdueCourseCount: number;
}

export function learnerEnrollmentSummarySql(
  organizationId: string,
  learnerIds: string[],
): Prisma.Sql {
  return Prisma.sql`SELECT e.learner_id AS "learnerId",
    (COUNT(*) FILTER (WHERE e.enrollment_type IN ('Required', 'Optional')
      AND e.status IN ('NotStarted', 'InProgress')))::integer AS "activeCourseCount",
    (COUNT(*) FILTER (WHERE ${enrollmentDisplayStatusSql('e')} = 'Overdue'))::integer AS "overdueCourseCount"
    FROM enrollments e
    WHERE e.organization_id = ${organizationId}::uuid
      AND e.learner_id = ANY(ARRAY[${Prisma.join(learnerIds)}]::uuid[])
    GROUP BY e.learner_id`;
}

@Injectable()
export class LearnerEnrollmentSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  summarize(
    organizationId: string,
    learnerIds: string[],
  ): Promise<LearnerEnrollmentSummaryRow[]> {
    return this.prisma.$queryRaw(
      learnerEnrollmentSummarySql(organizationId, learnerIds),
    );
  }
}
