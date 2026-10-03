import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import type { CourseSnapshotRows } from './course-snapshot-rows';

@Injectable()
export class CourseSnapshotsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async existsForCourse(
    courseId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const snapshot = await this.db(tx).courseVersionSnapshot.findUnique({
      where: { courseId_organizationId: { courseId, organizationId } },
      select: { courseId: true },
    });
    return snapshot !== null;
  }

  /**
   * Ghi bản sao bằng ON CONFLICT DO NOTHING (skipDuplicates): hai Learner đầu tiên
   * đăng ký cùng lúc đều ghi được, bản sao chỉ còn một bộ.
   */
  async insertIgnoringConflicts(
    rows: CourseSnapshotRows,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const db = this.db(tx);
    await db.courseVersionSnapshot.createMany({
      data: [rows.course],
      skipDuplicates: true,
    });
    if (rows.materials.length > 0) {
      await db.materialSnapshot.createMany({
        data: rows.materials,
        skipDuplicates: true,
      });
    }
    if (rows.lessons.length > 0) {
      await db.lessonSnapshot.createMany({
        data: rows.lessons,
        skipDuplicates: true,
      });
    }
  }
}
