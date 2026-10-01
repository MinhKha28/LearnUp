import { CurrentUser } from '@learnup/ts-common';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';

export interface CourseAuthoringContext {
  courseId: string;
  organizationId: string;
  instructorId: string;
  status: string;
  locked: boolean;
  disabled: boolean;
}

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
      ...(query.search
        ? {
            name: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.courseType
        ? {
            courseType: query.courseType,
          }
        : {}),
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),

      ...(query.locked === true
        ? {
            lockedAt: {
              not: null,
            },
          }
        : {}),
      ...(query.locked === false
        ? {
            lockedAt: null,
          }
        : {}),
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
        learnerCount: 0,
      })),
    };
  }

  /**
   * Facts other services need to decide whether authoring is allowed on a Course
   * (owner via the version chain per BR-287, lifecycle status, Locked per BR-80).
   */
  async getAuthoringContext(
    courseId: string,
    organizationId?: string,
  ): Promise<CourseAuthoringContext> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        chain: {
          select: {
            instructorId: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    return {
      courseId: course.id,
      organizationId: course.organizationId,
      instructorId: course.chain.instructorId,
      status: course.status,
      locked: course.lockedAt !== null,
      disabled: course.disabledAt !== null,
    };
  }

  async create(user: CurrentUser, dto: CreateCourseDto) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can create Course.');
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const learningOutcomes =
      dto.learningOutcomes?.map((item) => item.trim()).filter(Boolean) ?? [];
    const result = await this.prisma.$transaction(async (tx) => {
      const chain = await tx.courseChain.create({
        data: {
          organizationId: user.organizationId!,
          instructorId: user.userId,
        },
      });

      const course = await tx.course.create({
        data: {
          organizationId: user.organizationId!,
          chainId: chain.id,
          versionNumber: 1,
          name: dto.name.trim(),
          shortDescription: dto.shortDescription?.trim() || null,
          trainingObjectives: dto.trainingObjectives?.trim() || null,
          learningOutcomes,
          coverFileId: dto.coverFileId ?? null,
          expectedCompletionDays: dto.expectedCompletionDays,
          courseType: dto.courseType,
          status: 'DRAFT',
          lockedAt: null,
        },

        select: {
          id: true,
          chainId: true,
          versionNumber: true,
          name: true,
          shortDescription: true,
          trainingObjectives: true,
          learningOutcomes: true,
          coverFileId: true,
          expectedCompletionDays: true,
          courseType: true,
          status: true,
          lockedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return course;
    });

    const { lockedAt, ...course } = result;
    return {
      ...course,
      locked: lockedAt !== null,
      learnerCount: 0,
    };
  }
}
