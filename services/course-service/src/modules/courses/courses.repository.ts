import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { Prisma } from '@generated/prisma/browser';
import { UpdateCourseDto } from './dto/update-course.dto';
import { COURSE_STATUS } from './course-values';
import { UpdateCourseStructureDto } from './dto/update-course-structure.dto';

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

  async updateCourse(
    courseId: string,
    organizationId: string,
    instructorId: string,
    data: UpdateCourseDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tìm Course thuộc Instructor.
      const current = await tx.course.findFirst({
        where: {
          id: courseId,
          organizationId,
          chain: { instructorId },
        },
        select: {
          status: true,
          courseType: true,
          coverFileId: true,
          updatedAt: true,
        },
      });

      if (!current) {
        return { status: 'NOT_FOUND' as const };
      }

      // 2. Chỉ Draft / Rejected mới được cập nhật.
      if (
        current.status !== COURSE_STATUS.DRAFT &&
        current.status !== COURSE_STATUS.REJECTED
      ) {
        return { status: 'NOT_EDITABLE' as const };
      }

      // 3. Kiểm tra ảnh bìa mới.
      // Nếu giữ ảnh cũ hoặc xóa ảnh, không cần truy vấn MediaFile.
      if (
        data.coverFileId !== null &&
        data.coverFileId !== current.coverFileId
      ) {
        const cover = await tx.mediaFile.findFirst({
          where: {
            id: data.coverFileId,
            organizationId,
            purpose: 'CourseCover',
            status: 'Ready',
            releasedAt: null,
          },
          select: { id: true },
        });

        if (!cover) {
          return { status: 'INVALID_COVER' as const };
        }
      }

      // 4. Xác định Course Type thay đổi.
      const courseTypeChanged = current.courseType !== data.courseType;

      // 5. PUT thay thế đầy đủ 7 trường editable.
      const updateData: Prisma.CourseUncheckedUpdateManyInput = {
        name: data.name,
        shortDescription: data.shortDescription,
        trainingObjectives: data.trainingObjectives,
        learningOutcomes: {
          set: data.learningOutcomes,
        },
        coverFileId: data.coverFileId,
        expectedCompletionDays: data.expectedCompletionDays,
        courseType: data.courseType,
      };

      // 6. Cập nhật có điều kiện ownership + status.
      const updated = await tx.course.updateMany({
        where: {
          id: courseId,
          organizationId,
          chain: { instructorId },
          status: {
            in: [COURSE_STATUS.DRAFT, COURSE_STATUS.REJECTED],
          },
          updatedAt: current.updatedAt,
        },
        data: updateData,
      });

      if (updated.count !== 1) {
        return { status: 'CONFLICT' as const };
      }

      // 7. Lưu Outbox nếu thay đổi Public / Private.
      if (courseTypeChanged) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Course',
            aggregateId: courseId,
            organizationId,
            eventType: 'CourseTypeChanged',
            occurredAt: new Date(),
            payload: {
              courseId,
              organizationId,
              instructorId,
              previousCourseType: current.courseType,
              newCourseType: data.courseType,
            },
          },
        });
      }

      return {
        status: 'UPDATED' as const,
        courseTypeChanged,
      };
    });
  }

  async updateStructure(
    courseId: string,
    organizationId: string,
    instructorId: string,
    data: UpdateCourseStructureDto,
  ) {
    // Kiểm tra cùng tập ID, không trùng hoặc thiếu ID.
    const sameMembers = (actual: string[], incoming: string[]) =>
      actual.length === incoming.length &&
      new Set(incoming).size === incoming.length &&
      actual.every((id) => incoming.includes(id));

    // Kiểm tra thứ tự ID có giống nhau không.
    const sameOrder = (actual: string[], incoming: string[]) =>
      actual.length === incoming.length &&
      actual.every((id, index) => id === incoming[index]);

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Khóa hàng Course trong transaction để
        // tuần tự hóa các request cập nhật cấu trúc.
        await tx.$queryRaw`
        SELECT id
        FROM courses
        WHERE id = ${courseId}::uuid
          AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;

        // 2. Đọc cây thuộc Instructor.
        const course = await tx.course.findFirst({
          where: {
            id: courseId,
            organizationId,
            chain: { instructorId },
          },
          select: {
            status: true,
            lockedAt: true,
            modules: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                lessons: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        });

        if (!course) {
          return { status: 'NOT_FOUND' as const };
        }

        // 3. Course Submitted không được chỉnh sửa.
        if (course.status === COURSE_STATUS.SUBMITTED) {
          return { status: 'SUBMITTED' as const };
        }

        // 4. Kiểm tra danh sách Module:
        // Không được thêm, xóa hay thay ID bằng API này.
        const currentModuleIds = course.modules.map((module) => module.id);

        const requestedModuleIds = data.modules.map((module) => module.id);

        if (!sameMembers(currentModuleIds, requestedModuleIds)) {
          return { status: 'INVALID_STRUCTURE' as const };
        }

        const requestedById = new Map(
          data.modules.map((module) => [module.id, module]),
        );

        // 5. Kiểm tra Lesson luôn thuộc đúng Module cũ.
        for (const module of course.modules) {
          const requested = requestedById.get(module.id)!;

          const currentLessonIds = module.lessons.map((lesson) => lesson.id);

          const requestedLessonIds = requested.lessons.map(
            (lesson) => lesson.id,
          );

          if (!sameMembers(currentLessonIds, requestedLessonIds)) {
            return { status: 'INVALID_STRUCTURE' as const };
          }
        }

        // 6. Kiểm tra Module có đổi thứ tự không.
        const moduleOrderChanged = !sameOrder(
          currentModuleIds,
          requestedModuleIds,
        );

        // 7. Tìm những Module có Lesson bị đổi thứ tự.
        const reorderedLessonModules = course.modules.filter((module) => {
          const requested = requestedById.get(module.id)!;

          return !sameOrder(
            module.lessons.map((lesson) => lesson.id),
            requested.lessons.map((lesson) => lesson.id),
          );
        });

        const orderChanged =
          moduleOrderChanged || reorderedLessonModules.length > 0;

        // 8. Locked chỉ cấm đổi thứ tự.
        // Nếu thứ tự giữ nguyên thì vẫn cho sửa title.
        if (course.lockedAt !== null && orderChanged) {
          return { status: 'LOCKED' as const };
        }

        // 9. Cập nhật tiêu đề nếu thực sự thay đổi.
        let titleChanged = false;

        for (const module of course.modules) {
          const requested = requestedById.get(module.id)!;

          if (module.title !== requested.title) {
            await tx.courseModule.update({
              where: { id: module.id },
              data: { title: requested.title },
            });

            titleChanged = true;
          }

          const requestedLessons = new Map(
            requested.lessons.map((lesson) => [lesson.id, lesson]),
          );

          for (const lesson of module.lessons) {
            const newLesson = requestedLessons.get(lesson.id)!;

            if (lesson.title !== newLesson.title) {
              await tx.lesson.update({
                where: { id: lesson.id },
                data: { title: newLesson.title },
              });

              titleChanged = true;
            }
          }
        }

        // 10. Sắp xếp lại Module nếu có thay đổi.
        if (moduleOrderChanged) {
          // Gán vị trí âm tạm để tránh unique conflict.
          for (let i = 0; i < course.modules.length; i++) {
            await tx.courseModule.update({
              where: { id: course.modules[i].id },
              data: { position: -(i + 1) },
            });
          }

          // Gán thứ tự mới 1, 2, 3...
          for (let i = 0; i < data.modules.length; i++) {
            await tx.courseModule.update({
              where: { id: data.modules[i].id },
              data: { position: i + 1 },
            });
          }
        }

        // 11. Sắp xếp Lesson trong từng Module đã đổi.
        for (const module of reorderedLessonModules) {
          const requested = requestedById.get(module.id)!;

          // Vị trí âm tạm thời.
          for (let i = 0; i < module.lessons.length; i++) {
            await tx.lesson.update({
              where: { id: module.lessons[i].id },
              data: { position: -(i + 1) },
            });
          }

          // Vị trí mới.
          for (let i = 0; i < requested.lessons.length; i++) {
            await tx.lesson.update({
              where: { id: requested.lessons[i].id },
              data: { position: i + 1 },
            });
          }
        }

        return {
          status: 'UPDATED' as const,
          titleChanged,
          orderChanged,
        };
      },
      { timeout: 20000 },
    );
  }

  async findLessonDetail(
    courseId: string,
    lessonId: string,
    organizationId: string,
    instructorId: string,
  ) {
    return this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        organizationId,
        module: {
          courseId,
          organizationId,
          course: {
            organizationId,
            chain: {
              instructorId,
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        content: true,
        position: true,
        disabledAt: true,

        module: {
          select: {
            id: true,
            title: true,
            position: true,
            course: {
              select: {
                id: true,
                name: true,
                status: true,
                lockedAt: true,
              },
            },
          },
        },

        materials: {
          orderBy: {
            position: 'asc',
          },
          select: {
            id: true,
            title: true,
            materialType: true,
            isRequired: true,
            position: true,
            disabledAt: true,

            file: {
              select: {
                originalFilename: true,
                mimeType: true,
                sizeBytes: true,
                durationSeconds: true,
                wordCount: true,
                status: true,
                releasedAt: true,
              },
            },
          },
        },
      },
    });
  }
}
