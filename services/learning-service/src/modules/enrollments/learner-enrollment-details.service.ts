import type { CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import type { CourseBatchItem } from '../../infrastructure/clients/course/course-service.interface';
import { CourseServiceError } from '../../infrastructure/clients/course/course-service.errors';
import { serviceUnavailable } from '../../infrastructure/clients/course/service-unavailable';
import {
  TENANT_CLIENT,
  TenantUnavailableError,
  type TenantClient,
} from '../../infrastructure/clients/tenant/tenant.client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { enrollmentDisplayStatusSql } from './enrollment-display-status.sql';
import { EnrollmentsRepository } from './enrollments.repository';

interface EnrollmentDetailsRow {
  enrollmentId: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  enrolledAt: Date;
  assignedAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
}

const REQUIRED_UNFINISHED = Prisma.sql`(e.enrollment_type = 'Required' AND e.status IN ('NotStarted', 'InProgress'))`;

@Injectable()
export class LearnerEnrollmentDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsRepository,
    private readonly courses: CourseServiceClient,
    @Inject(TENANT_CLIENT) private readonly tenant: TenantClient,
  ) {}

  async list(user: CurrentUser, learnerId: string) {
    const organizationId = user.organizationId;
    if (!organizationId || !isUUID(organizationId)) {
      throw new BadRequestException('x-organization-id must be a UUID.');
    }
    try {
      const [learner] = await this.tenant.lookupLearners(user, [learnerId]);
      if (!learner || learner.role !== 'Learner' || learner.deletedAt !== null) {
        throw new NotFoundException({
          code: 'LEARNER_NOT_FOUND',
          message: 'Learner not found.',
        });
      }

      const rows = await this.prisma.$queryRaw<EnrollmentDetailsRow[]>`
        SELECT e.id AS "enrollmentId", e.course_id AS "courseId",
               e.enrollment_type AS "enrollmentType",
               ${enrollmentDisplayStatusSql('e')} AS status,
               e.enrolled_at AS "enrolledAt", e.assigned_at AS "assignedAt",
               e.due_at AS "dueAt", e.completed_at AS "completedAt"
          FROM enrollments e
         WHERE e.learner_id = ${learnerId}::uuid
           AND e.organization_id = ${organizationId}::uuid
           AND e.status <> 'Withdrawn'
         ORDER BY CASE WHEN ${REQUIRED_UNFINISHED} THEN 0 ELSE 1 END,
                  CASE WHEN ${REQUIRED_UNFINISHED} THEN e.due_at END ASC,
                  CASE WHEN NOT ${REQUIRED_UNFINISHED}
                    THEN COALESCE(e.assigned_at, e.enrolled_at) END DESC,
                  e.id DESC
      `;
      if (rows.length === 0) return { enrollments: [] };

      const [courseById, counts] = await Promise.all([
        this.findCourses(user, rows.map((row) => row.courseId)),
        this.enrollments.countRequiredMaterials(
          rows.map((row) => row.enrollmentId),
          organizationId,
        ),
      ]);
      return {
        enrollments: rows.map((row) => {
          const course = courseById.get(row.courseId);
          return {
            ...row,
            course: course
              ? { name: course.name, versionNumber: course.versionNumber }
              : null,
            requiredMaterials: counts.get(row.enrollmentId) ?? {
              completed: 0,
              total: 0,
            },
          };
        }),
      };
    } catch (error) {
      if (
        error instanceof TenantUnavailableError ||
        error instanceof CourseServiceError
      ) {
        throw serviceUnavailable();
      }
      throw error;
    }
  }

  private async findCourses(user: CurrentUser, courseIds: string[]) {
    const result = new Map<string, CourseBatchItem>();
    const batchSize = 100;
    for (let start = 0; start < courseIds.length; start += batchSize) {
      const batch = await this.courses.getCoursesBatch(
        user,
        courseIds.slice(start, start + batchSize),
      );
      for (const course of batch) result.set(course.courseId, course);
    }
    return result;
  }
}
