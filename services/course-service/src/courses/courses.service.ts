import { CurrentUser } from '@learnup/ts-common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourseListQueryDto } from './dto/course-list-query.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUser, query: CourseListQueryDto) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException(
        'Only Instructor can view assigned courses.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const current = query.current;
    const pageSize = query.pageSize;
    const skip = (current - 1) * pageSize;

    const where = {
      organizationId: user.organizationId,
      chain: {
        instructorId: user.userId,
      },
    };

    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        select: {
          id: true,
          chainId: true,
          versionNumber: true,
          name: true,
          courseType: true,
          status: true,
          lockedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: pageSize,
        orderBy: {
          updatedAt: 'desc',
        },
      }),

      this.prisma.course.count({
        where,
      }),
    ]);

    return {
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
      result: courses.map(({ lockedAt, ...course }) => ({
        ...course,
        locked: lockedAt !== null,
      })),
    };
  }
}
