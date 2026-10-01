import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

/** Kết quả trả về sau khi tạo Enrollment. */
export interface CreatedEnrollment {
  id: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  enrolledAt: Date;
}

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

  /** courseId Learner đã đăng ký trong tổ chức, trừ Withdrawn (D20). */
  async findCourseIdsOfLearner(
    learnerId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const rows = await this.db(tx).enrollment.findMany({
      where: { learnerId, organizationId, status: { not: 'Withdrawn' } },
      select: { courseId: true },
      orderBy: { enrolledAt: 'asc' },
    });
    return rows.map((row) => row.courseId);
  }
}
