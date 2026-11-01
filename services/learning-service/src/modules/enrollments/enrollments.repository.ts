import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { toSafeNumber } from '../../common/utils/to-safe-number';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { enrollmentDisplayStatusSql } from './enrollment-display-status.sql';

/** Kết quả trả về sau khi tạo Enrollment. */
export interface CreatedEnrollment {
  id: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  enrolledAt: Date;
}

/** Một dòng UC26; status đã gồm Overdue. */
export interface MyEnrollmentRow {
  id: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  dueAt: Date | null;
  dueTimezone: string | null;
}

/** Course Learner đã đăng ký kèm Enrollment, để mở UC27 từ UC25/UC25.1 (D20, D48). */
export interface EnrolledCourseRef {
  status: string;
  courseId: string;
  enrollmentId: string;
}

/** Học liệu bắt buộc x/y của một Enrollment (D25). */
export interface RequiredMaterialCount {
  completed: number;
  total: number;
}

/** Enrollment Learner thấy ở UC26: của chính Learner trong tổ chức, trừ Withdrawn (D3). */
const myEnrollmentsWhere = (learnerId: string, organizationId: string) =>
  Prisma.sql`e.learner_id = ${learnerId}::uuid
    AND e.organization_id = ${organizationId}::uuid
    AND e.status <> 'Withdrawn'`;

/** Nhóm 1 của D22: Required chưa xong (gồm Overdue). */
const REQUIRED_UNFINISHED = Prisma.sql`(e.enrollment_type = 'Required' AND e.status IN ('NotStarted', 'InProgress'))`;

@Injectable()
export class EnrollmentsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** Enrollment của Learner trên phiên bản Course, ở bất kỳ trạng thái nào. */
  async findIdByLearnerAndCourse(
    learnerId: string,
    courseId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const enrollment = await this.db(tx).enrollment.findUnique({
      where: { learnerId_courseId: { learnerId, courseId } },
      select: { id: true },
    });
    return enrollment?.id ?? null;
  }

  /** BR-163: unique Learner/Course version, restricted to the trusted organization. */
  findAssessmentAccess(
    learnerId: string,
    courseId: string,
    organizationId: string,
  ) {
    return this.db().enrollment.findUnique({
      where: { learnerId_courseId: { learnerId, courseId }, organizationId },
      select: { id: true, status: true },
    });
  }

  async create(
    data: Prisma.EnrollmentUncheckedCreateInput,
    tx: Prisma.TransactionClient,
  ): Promise<CreatedEnrollment> {
    return this.db(tx).enrollment.create({
      data,
      select: {
        id: true,
        courseId: true,
        enrollmentType: true,
        status: true,
        enrolledAt: true,
      },
    });
  }

  /**
   * Course Learner đã đăng ký trong tổ chức kèm Enrollment, trừ Withdrawn (D20, D48).
   * UNIQUE (learner_id, course_id) bảo đảm mỗi courseId chỉ có một dòng.
   */
  async findCourseIdsOfLearner(
    learnerId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<EnrolledCourseRef[]> {
    const rows = await this.db(tx).enrollment.findMany({
      where: { learnerId, organizationId, status: { not: 'Withdrawn' } },
      select: { id: true, courseId: true, status: true },
      orderBy: { courseId: 'asc' },
    });
    return rows.map((row) => ({
      courseId: row.courseId,
      enrollmentId: row.id,
      status: row.status,
    }));
  }

  async countMine(
    learnerId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const rows = await this.db(tx).$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM enrollments e
       WHERE ${myEnrollmentsWhere(learnerId, organizationId)}`;
    return toSafeNumber(rows[0].n);
  }

  /**
   * Một trang UC26 theo D22: nhóm 1 (Required NotStarted/InProgress) theo due_at tăng dần,
   * nhóm 2 theo COALESCE(assigned_at, enrolled_at) giảm dần (BR-329); cuối cùng id giảm dần để phân trang ổn định.
   */
  findMinePage(
    learnerId: string,
    organizationId: string,
    limit: number,
    offset: number,
    tx?: Prisma.TransactionClient,
  ): Promise<MyEnrollmentRow[]> {
    return this.db(tx).$queryRaw<MyEnrollmentRow[]>`
      SELECT e.id::text AS "id",
             e.course_id::text AS "courseId",
             e.enrollment_type AS "enrollmentType",
             ${enrollmentDisplayStatusSql('e')} AS "status",
             e.due_at AS "dueAt", e.due_timezone AS "dueTimezone"
        FROM enrollments e
       WHERE ${myEnrollmentsWhere(learnerId, organizationId)}
       ORDER BY CASE WHEN ${REQUIRED_UNFINISHED} THEN 0 ELSE 1 END,
                CASE WHEN ${REQUIRED_UNFINISHED} THEN e.due_at END ASC,
                CASE WHEN NOT ${REQUIRED_UNFINISHED} THEN COALESCE(e.assigned_at, e.enrolled_at) END DESC,
                e.id DESC
       LIMIT ${limit}::bigint OFFSET ${offset}::bigint`;
  }

  /**
   * D25, dùng chung cho UC26 và UC27: y = học liệu bắt buộc còn hoạt động của phiên bản (thiết kế 3.6),
   * x = số trong y đã có completed_at trong material_progress của đúng Enrollment. Một câu truy vấn cho cả trang.
   */
  async countRequiredMaterials(
    enrollmentIds: string[],
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, RequiredMaterialCount>> {
    if (enrollmentIds.length === 0) {
      return new Map();
    }
    const rows = await this.db(tx).$queryRaw<
      { id: string; completed: bigint; total: bigint }[]
    >`
      SELECT e.id::text AS id,
             count(m.material_id) AS total,
             count(p.completed_at) AS completed
        FROM enrollments e
        LEFT JOIN course_version_snapshots c
               ON c.course_id = e.course_id
              AND c.organization_id = e.organization_id
              AND c.disabled_at IS NULL
        LEFT JOIN material_snapshots m
               ON m.course_id = c.course_id
              AND m.organization_id = c.organization_id
              AND m.is_required
              AND m.disabled_at IS NULL
              AND NOT EXISTS (
                    SELECT 1 FROM lesson_snapshots l
                     WHERE l.lesson_id = m.lesson_id
                       AND l.organization_id = m.organization_id
                       AND l.disabled_at IS NOT NULL)
        LEFT JOIN material_progress p
               ON p.enrollment_id = e.id
              AND p.organization_id = e.organization_id
              AND p.material_id = m.material_id
              AND p.completed_at IS NOT NULL
       WHERE e.organization_id = ${organizationId}::uuid
         AND e.id = ANY(${enrollmentIds}::uuid[])
       GROUP BY e.id`;
    return new Map(
      rows.map((row) => [
        row.id,
        {
          completed: toSafeNumber(row.completed),
          total: toSafeNumber(row.total),
        },
      ]),
    );
  }
}
