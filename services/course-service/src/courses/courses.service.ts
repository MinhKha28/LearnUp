import { CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { TenantClient } from 'src/common/clients/tenant/tenant.client';
import { OrganizationCourseListQueryDto } from './dto/organization-course-list-query.dto';
import { LearningClient } from 'src/common/clients/learning/learning.client';
import { PrismaService } from 'src/prisma/prisma.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantClient: TenantClient,
    private readonly learningClient: LearningClient,
  ) {}

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
  async createLesson(
    user: CurrentUser,
    courseId: string,
    moduleId: string,
    dto: CreateCourseLessonDto,
  ) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can add Lesson.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const title = dto.title.trim();
    const content = dto.content.trim();

    if (!title) {
      throw new BadRequestException('Lesson title is required.');
    }

    if (!content) {
      throw new BadRequestException('Lesson content is required.');
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
        'Submitted Course cannot be edited. Withdraw the Course before adding a Lesson.',
      );
    }

    if (course.lockedAt) {
      throw new BadRequestException(
        'Cannot add Lesson because Course is Locked.',
      );
    }

    const module = await this.prisma.courseModule.findFirst({
      where: {
        id: moduleId,
        courseId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const lastLesson = await tx.lesson.findFirst({
        where: {
          moduleId,
          organizationId: user.organizationId!,
        },
        orderBy: {
          position: 'desc',
        },
        select: {
          position: true,
        },
      });

      const nextPosition = (lastLesson?.position ?? 0) + 1;

      return tx.lesson.create({
        data: {
          organizationId: user.organizationId!,
          moduleId,
          title,
          content,
          position: nextPosition,
        },
        select: {
          id: true,
          moduleId: true,
          title: true,
          content: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  async findOrganizationCourses(
    user: CurrentUser,
    query: OrganizationCourseListQueryDto,
  ) {
    if (user.role !== 'ORGANIZER') {
      throw new ForbiddenException(
        'Only Organizer can view Organization Courses.',
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
          submittedAt: true,
          createdAt: true,
          updatedAt: true,
          chain: {
            select: {
              instructorId: true,
            },
          },
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

    if (courses.length === 0) {
      return {
        meta: {
          current,
          pageSize,
          pages: 0,
          total: 0,
        },
        result: [],
      };
    }

    const instructorIds = [
      ...new Set(courses.map((course) => course.chain.instructorId)),
    ];

    const courseIds = courses.map((course) => course.id);

    const [instructors, learnerCounts] = await Promise.all([
      this.tenantClient.getInstructors(user, instructorIds),
      this.learningClient.getCourseLearnerCounts(user, courseIds),
    ]);

    const instructorMap = new Map(
      instructors.map((instructor) => [instructor.id, instructor]),
    );

    const learnerCountMap = new Map(
      learnerCounts.map((item) => [item.courseId, item.learnerCount]),
    );

    const result = courses.map(({ chain, ...course }) => {
      const instructor = instructorMap.get(chain.instructorId);

      return {
        ...course,

        instructor: {
          id: chain.instructorId,
          fullName: instructor?.fullName ?? 'Unknown Instructor',
        },

        learnerCount: learnerCountMap.get(course.id) ?? 0,
      };
    });

    return {
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
      result,
    };
  }
}
