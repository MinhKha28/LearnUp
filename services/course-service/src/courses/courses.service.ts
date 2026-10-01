import { CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';

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

  async getStructure(user: CurrentUser, courseId: string) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException(
        'Only Instructor can view Course structure.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId: user.organizationId,
        chain: {
          instructorId: user.userId,
        },
      },

      select: {
        id: true,
        name: true,
        versionNumber: true,
        status: true,
        lockedAt: true,
        modules: {
          orderBy: {
            position: 'asc',
          },
          select: {
            id: true,
            title: true,
            position: true,
            lessons: {
              orderBy: {
                position: 'asc',
              },
              select: {
                id: true,
                title: true,
                position: true,
                materials: {
                  select: {
                    isRequired: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }
    const locked = course.lockedAt !== null;
    const submitted = course.status === 'SUBMITTED';
    const structureLocked = locked || submitted;
    let lockReason: string | null = null;

    if (submitted) {
      lockReason =
        'Course is Submitted and cannot be edited until it is withdrawn.';
    } else if (locked) {
      lockReason = 'Course structure is locked after the first Enrollment.';
    }

    const modules = course.modules.map((module) => {
      const lessons = module.lessons.map((lesson) => {
        const required = lesson.materials.some(
          (material) => material.isRequired,
        );
        return {
          id: lesson.id,
          title: lesson.title,
          position: lesson.position,
          required,
        };
      });

      const required = lessons.some((lesson) => lesson.required);
      return {
        id: module.id,
        title: module.title,
        position: module.position,
        required,
        lessons,
      };
    });

    return {
      course: {
        id: course.id,
        name: course.name,
        versionNumber: course.versionNumber,
        status: course.status,
        locked,
      },
      structureLocked,
      lockReason,
      modules,
    };
  }

  async createModule(
    user: CurrentUser,
    courseId: string,
    dto: CreateCourseModuleDto,
  ) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can add Module.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Module title is required.');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId: user.organizationId,
        chain: {
          instructorId: user.userId,
        },
      },
      select: {
        id: true,
        status: true,
        lockedAt: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    if (course.status === 'SUBMITTED') {
      throw new BadRequestException(
        'Submitted Course cannot be edited. Withdraw the Course before adding a Module.',
      );
    }

    if (course.lockedAt) {
      throw new BadRequestException(
        'Cannot add Module because Course is Locked.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const lastModule = await tx.courseModule.findFirst({
        where: {
          courseId,
          organizationId: user.organizationId!,
        },
        orderBy: {
          position: 'desc',
        },
        select: {
          position: true,
        },
      });

      const nextPosition = (lastModule?.position ?? 0) + 1;

      return tx.courseModule.create({
        data: {
          organizationId: user.organizationId!,
          courseId,
          title,
          position: nextPosition,
        },
        select: {
          id: true,
          courseId: true,
          title: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }
}
