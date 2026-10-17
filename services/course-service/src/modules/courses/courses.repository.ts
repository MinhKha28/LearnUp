import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { Prisma } from '@generated/prisma/browser';

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInstructorCourses(
    where: Prisma.CourseWhereInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.$transaction([
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
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);
  }

  async findAuthoringContext(courseId: string, organizationId?: string) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        chain: {
          select: { instructorId: true },
        },
      },
    });
  }

  async createCourse(data: {
    organizationId: string;
    instructorId: string;
    name: string;
    shortDescription: string | null;
    trainingObjectives: string | null;
    learningOutcomes: string[];
    coverFileId: string | null;
    expectedCompletionDays: number;
    courseType: string;
    status: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const chain = await tx.courseChain.create({
        data: {
          organizationId: data.organizationId,
          instructorId: data.instructorId,
        },
      });

      return tx.course.create({
        data: {
          organizationId: data.organizationId,
          chainId: chain.id,
          versionNumber: 1,
          name: data.name,
          shortDescription: data.shortDescription,
          trainingObjectives: data.trainingObjectives,
          learningOutcomes: data.learningOutcomes,
          coverFileId: data.coverFileId,
          expectedCompletionDays: data.expectedCompletionDays,
          courseType: data.courseType,
          status: data.status,
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
    });
  }

  async findStructure(
    courseId: string,
    organizationId: string,
    instructorId: string,
  ) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        chain: { instructorId },
      },
      select: {
        id: true,
        name: true,
        versionNumber: true,
        status: true,
        lockedAt: true,
        modules: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            lessons: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                position: true,
                materials: {
                  select: { isRequired: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOwnedCourseForEditing(
    courseId: string,
    organizationId: string,
    instructorId: string,
  ) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        chain: { instructorId },
      },
      select: {
        id: true,
        status: true,
        lockedAt: true,
      },
    });
  }

  async createModule(organizationId: string, courseId: string, title: string) {
    return this.prisma.$transaction(async (tx) => {
      const lastModule = await tx.courseModule.findFirst({
        where: { courseId, organizationId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return tx.courseModule.create({
        data: {
          organizationId,
          courseId,
          title,
          position: (lastModule?.position ?? 0) + 1,
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

  async findModule(moduleId: string, courseId: string, organizationId: string) {
    return this.prisma.courseModule.findFirst({
      where: {
        id: moduleId,
        courseId,
        organizationId,
      },
      select: { id: true },
    });
  }

  async createLesson(
    organizationId: string,
    moduleId: string,
    title: string,
    content: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lastLesson = await tx.lesson.findFirst({
        where: { moduleId, organizationId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return tx.lesson.create({
        data: {
          organizationId,
          moduleId,
          title,
          content,
          position: (lastLesson?.position ?? 0) + 1,
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
    where: Prisma.CourseWhereInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.$transaction([
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
            select: { instructorId: true },
          },
        },
        skip,
        take,
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.prisma.course.count({ where }),
    ]);
  }

  async findOrganizationInstructorIds(organizationId: string) {
    const chains = await this.prisma.courseChain.findMany({
      where: { organizationId },
      select: { instructorId: true },
      distinct: ['instructorId'],
    });

    return chains.map((chain) => chain.instructorId);
  }

  async findDetail(
    courseId: string,
    organizationId: string,
    instructorId: string,
  ) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        chain: { instructorId },
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
        submittedAt: true,
        publishedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        coverFile: {
          select: {
            storageKey: true,
            status: true,
            releasedAt: true,
          },
        },
      },
    });
  }

  async getReadingSpeedWordsPerMinute() {
    const setting = await this.prisma.platformSetting.findFirst({
      orderBy: { sourceAsOf: 'desc' },
      select: { readingSpeedWordsPerMinute: true },
    });

    return setting?.readingSpeedWordsPerMinute ?? null;
  }

  async calculateEstimatedDurationMinutes(
    organizationId: string,
    courseId: string,
    readingSpeedWordsPerMinute: number,
  ): Promise<number | null> {
    const [result] = await this.prisma.$queryRaw<
      { estimatedDurationMinutes: number }[]
    >`
      SELECT (
        c.assignment_minutes +
        COALESCE(
          SUM(
            CASE
              WHEN m.material_type = 'Video'
                THEN CEIL(f.duration_seconds / 60.0)
              WHEN m.material_type = 'Reading'
                THEN CEIL(
                  f.word_count /
                  ${readingSpeedWordsPerMinute}::numeric
                )
              ELSE 0
            END
          ),
          0
        )
      )::int AS "estimatedDurationMinutes"
      FROM courses c
      LEFT JOIN modules cm
        ON cm.course_id = c.id
      LEFT JOIN lessons l
        ON l.module_id = cm.id
        AND l.disabled_at IS NULL
      LEFT JOIN materials m
        ON m.lesson_id = l.id
        AND m.is_required = true
        AND m.disabled_at IS NULL
      LEFT JOIN media_files f
        ON f.id = m.file_id
      WHERE c.id = ${courseId}::uuid
        AND c.organization_id = ${organizationId}::uuid
      GROUP BY c.id, c.assignment_minutes
    `;

    return result?.estimatedDurationMinutes ?? null;
  }

  async createCourseCoverMediaFile(
    organizationId: string,
    storedFile: {
      storageKey: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) {
    return this.prisma.mediaFile.create({
      data: {
        organizationId,
        purpose: 'CourseCover',
        status: 'Ready',
        storageKey: storedFile.storageKey,
        originalFilename: storedFile.originalFilename,
        mimeType: storedFile.mimeType,
        sizeBytes: BigInt(storedFile.sizeBytes),
        readyAt: new Date(),
      },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
      },
    });
  }
}
