import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../common/repository/base.repository';
import { enrollmentDisplayStatusSql } from '../enrollments/enrollment-display-status.sql';
import { PrismaService } from '../prisma/prisma.service';
import type { CurriculumSnapshot } from './build-curriculum';

/** Enrollment cần cho kiểm quyền D28 và phần đầu UC27. */
export interface AccessibleEnrollment {
  id: string;
  courseId: string;
  enrollmentType: string;
  /** status đã lưu, dùng để kiểm Withdrawn, Halted. */
  storedStatus: string;
  /** status hiển thị, đã gồm Overdue (D23). */
  status: string;
  dueAt: Date | null;
  /** disabled_at của bản sao phiên bản. */
  versionDisabledAt: Date | null;
}

@Injectable()
export class CurriculumRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /** D28: Enrollment theo id, đúng Learner và tổ chức của header; null khi không có. */
  async findAccessibleEnrollment(
    enrollmentId: string,
    learnerId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccessibleEnrollment | null> {
    const rows = await this.db(tx).$queryRaw<AccessibleEnrollment[]>`
      SELECT e.id::text AS "id",
             e.course_id::text AS "courseId",
             e.enrollment_type AS "enrollmentType",
             e.status AS "storedStatus",
             ${enrollmentDisplayStatusSql('e')} AS "status",
             e.due_at AS "dueAt",
             c.disabled_at AS "versionDisabledAt"
        FROM enrollments e
        LEFT JOIN course_version_snapshots c
               ON c.course_id = e.course_id
              AND c.organization_id = e.organization_id
       WHERE e.id = ${enrollmentId}::uuid
         AND e.learner_id = ${learnerId}::uuid
         AND e.organization_id = ${organizationId}::uuid`;
    return rows[0] ?? null;
  }

  /** Bản sao học liệu của phiên bản và các Lesson đang bị vô hiệu hóa (thiết kế 3.5, 3.6). */
  async findSnapshot(
    courseId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CurriculumSnapshot> {
    const db = this.db(tx);
    const [materials, lessons] = await Promise.all([
      db.materialSnapshot.findMany({
        where: { courseId, organizationId },
        select: {
          materialId: true,
          lessonId: true,
          materialType: true,
          isRequired: true,
          disabledAt: true,
        },
      }),
      db.lessonSnapshot.findMany({
        where: { courseId, organizationId, disabledAt: { not: null } },
        select: { lessonId: true },
      }),
    ]);
    return {
      materials,
      disabledLessonIds: new Set(lessons.map((lesson) => lesson.lessonId)),
    };
  }

  /** material_id đã hoàn thành của Enrollment (material_progress.completed_at khác NULL). */
  async findCompletedMaterialIds(
    enrollmentId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Set<string>> {
    const rows = await this.db(tx).materialProgress.findMany({
      where: { enrollmentId, organizationId, completedAt: { not: null } },
      select: { materialId: true },
    });
    return new Set(rows.map((row) => row.materialId));
  }
}
