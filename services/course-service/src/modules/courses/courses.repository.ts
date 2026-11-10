import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { Prisma } from '@generated/prisma/browser';
import { UpdateCourseDto } from './dto/update-course.dto';
import { COURSE_STATUS } from './course-values';
import { UpdateCourseStructureDto } from './dto/update-course-structure.dto';
import {
  assertCourseNotInTrash,
  COURSE_TRASH_MS,
  getPurgeAt,
  isTrashExpired,
} from './course-trash.constants';

type PermanentDeleteInput = {
  organizationId: string;
  courseId: string;
  instructorId?: string;
  requireExpired: boolean;
};

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async lockOwnedCourseForWrite(
    tx: Prisma.TransactionClient,
    courseId: string,
    organizationId: string,
    instructorId: string,
  ): Promise<boolean> {
    const [course] = await tx.$queryRaw<Array<{ deletedAt: Date | null }>>`
      SELECT c.deleted_at AS "deletedAt"
      FROM courses c
      JOIN course_chains cc ON cc.id = c.chain_id
      WHERE c.id = ${courseId}::uuid
        AND c.organization_id = ${organizationId}::uuid
        AND cc.instructor_id = ${instructorId}::uuid
      FOR UPDATE OF c
    `;
    if (!course) return false;
    assertCourseNotInTrash(course.deletedAt);
    return true;
  }

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
        // id là khóa phụ để thứ tự ổn định giữa các trang khi trùng updatedAt.
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.course.count({ where }),
    ]);
  }

  async findAuthoringContext(courseId: string, organizationId?: string) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        deletedAt: null,
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
        deletedAt: null,
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
        deletedAt: true,
      },
    });
  }

  async createModule(
    organizationId: string,
    courseId: string,
    instructorId: string,
    title: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ownsCourse = await this.lockOwnedCourseForWrite(
        tx,
        courseId,
        organizationId,
        instructorId,
      );
      if (!ownsCourse) {
        throw new NotFoundException('Course not found.');
      }

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
    courseId: string,
    instructorId: string,
    moduleId: string,
    title: string,
    content: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ownsCourse = await this.lockOwnedCourseForWrite(
        tx,
        courseId,
        organizationId,
        instructorId,
      );
      if (!ownsCourse) {
        throw new NotFoundException('Course not found.');
      }

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
        deletedAt: true,
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
      const ownsCourse = await this.lockOwnedCourseForWrite(
        tx,
        courseId,
        organizationId,
        instructorId,
      );
      if (!ownsCourse) {
        return { status: 'NOT_FOUND' as const };
      }

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
        const ownsCourse = await this.lockOwnedCourseForWrite(
          tx,
          courseId,
          organizationId,
          instructorId,
        );
        if (!ownsCourse) {
          return { status: 'NOT_FOUND' as const };
        }

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
            fileId: true,
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

  async findLessonForContentUpdate(
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
        content: true,
        updatedAt: true,
        module: {
          select: {
            course: {
              select: {
                status: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async updateLessonContent(
    courseId: string,
    lessonId: string,
    organizationId: string,
    instructorId: string,
    content: string,
    expectedUpdatedAt: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const ownsCourse = await this.lockOwnedCourseForWrite(
        tx,
        courseId,
        organizationId,
        instructorId,
      );
      if (!ownsCourse) {
        return false;
      }

      const result = await tx.lesson.updateMany({
        where: {
          id: lessonId,
          organizationId,
          updatedAt: expectedUpdatedAt,

          module: {
            courseId,
            organizationId,
            course: {
              organizationId,
              chain: {
                instructorId,
              },
              status: {
                not: COURSE_STATUS.SUBMITTED,
              },
            },
          },
        },
        data: {
          content,
        },
      });

      return result.count === 1;
    });
  }

  async getVideoSettings() {
    return this.prisma.platformSetting.findFirst({
      orderBy: { sourceAsOf: 'desc' },
      select: {
        maxVideoSizeBytes: true,
        maxVideoDurationMinutes: true,
        allowedVideoMimeTypes: true,
      },
    });
  }

  async findLessonForMaterialUpload(
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
            chain: { instructorId },
          },
        },
      },
      select: {
        id: true,
        title: true,
        disabledAt: true,
        module: {
          select: {
            course: {
              select: {
                id: true,
                name: true,
                status: true,
                lockedAt: true,
                disabledAt: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async getOrganizationStoredBytes(organizationId: string): Promise<bigint> {
    const result = await this.prisma.mediaFile.aggregate({
      where: {
        organizationId,
        status: 'Ready',
        releasedAt: null,
      },
      _sum: {
        sizeBytes: true,
      },
    });

    return result._sum.sizeBytes ?? 0n;
  }

  async createVideoMaterialWithQuota(data: {
    organizationId: string;
    instructorId: string;
    courseId: string;
    lessonId: string;
    title: string;
    isRequired: boolean;
    maxStorageBytes: bigint;
    file: {
      storageKey: string;
      deliveryType: string;
      storageFormat: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      durationSeconds: number;
    };
  }) {
    return this.prisma.$transaction(
      async (tx) => {
        // Bước 1: bảo đảm Organization có hàng quota lock.
        await tx.$executeRaw`
        INSERT INTO organization_quota_locks
          (organization_id, created_at, updated_at)
        VALUES (
          ${data.organizationId}::uuid,
          NOW(),
          NOW()
        )
        ON CONFLICT (organization_id) DO NOTHING
      `;

        // Bước 2: khóa quota của tổ chức.
        // Upload đồng thời phải chờ nhau khi ghi DB.
        await tx.$queryRaw`
        SELECT organization_id
        FROM organization_quota_locks
        WHERE organization_id = ${data.organizationId}::uuid
        FOR UPDATE
      `;

        const ownsCourse = await this.lockOwnedCourseForWrite(
          tx,
          data.courseId,
          data.organizationId,
          data.instructorId,
        );
        if (!ownsCourse) {
          return { status: 'NOT_FOUND' as const };
        }

        // Bước 4: kiểm tra lại quyền và trạng thái.
        const lesson = await tx.lesson.findFirst({
          where: {
            id: data.lessonId,
            organizationId: data.organizationId,
            module: {
              courseId: data.courseId,
              organizationId: data.organizationId,
              course: {
                organizationId: data.organizationId,
                chain: {
                  instructorId: data.instructorId,
                },
              },
            },
          },
          select: {
            disabledAt: true,
            module: {
              select: {
                course: {
                  select: {
                    status: true,
                    lockedAt: true,
                    disabledAt: true,
                  },
                },
              },
            },
          },
        });

        if (!lesson) {
          return { status: 'NOT_FOUND' as const };
        }

        const course = lesson.module.course;

        if (course.status === COURSE_STATUS.SUBMITTED) {
          return { status: 'SUBMITTED' as const };
        }

        if (course.disabledAt !== null || lesson.disabledAt !== null) {
          return { status: 'DISABLED' as const };
        }

        // BR-286: Course Locked chỉ thêm Optional.
        if (course.lockedAt !== null && data.isRequired) {
          return { status: 'LOCKED_REQUIRED' as const };
        }

        // Bước 5: tính lại quota ngay dưới khóa.
        const usage = await tx.mediaFile.aggregate({
          where: {
            organizationId: data.organizationId,
            status: 'Ready',
            releasedAt: null,
          },
          _sum: {
            sizeBytes: true,
          },
        });

        const usedBytes = usage._sum.sizeBytes ?? 0n;
        const incomingBytes = BigInt(data.file.sizeBytes);

        if (usedBytes + incomingBytes > data.maxStorageBytes) {
          return { status: 'QUOTA_EXCEEDED' as const };
        }

        // Bước 6: tìm position tiếp theo.
        const lastMaterial = await tx.material.findFirst({
          where: {
            organizationId: data.organizationId,
            lessonId: data.lessonId,
          },
          orderBy: { position: 'desc' },
          select: { position: true },
        });

        // Bước 7: tạo file metadata.
        const mediaFile = await tx.mediaFile.create({
          data: {
            organizationId: data.organizationId,
            purpose: 'LessonVideo',
            status: 'Ready',
            storageKey: data.file.storageKey,
            deliveryType: data.file.deliveryType,
            storageFormat: data.file.storageFormat,
            originalFilename: data.file.originalFilename,
            mimeType: data.file.mimeType,
            sizeBytes: incomingBytes,
            durationSeconds: data.file.durationSeconds,
            readyAt: new Date(),
          },
          select: { id: true },
        });

        // Bước 8: tạo học liệu.
        const material = await tx.material.create({
          data: {
            organizationId: data.organizationId,
            lessonId: data.lessonId,
            fileId: mediaFile.id,
            materialType: 'Video',
            title: data.title,
            isRequired: data.isRequired,
            position: (lastMaterial?.position ?? 0) + 1,
          },
          select: {
            id: true,
            title: true,
            materialType: true,
            isRequired: true,
            fileId: true,
            position: true,
          },
        });

        return {
          status: 'CREATED' as const,
          material,
        };
      },
      {
        timeout: 20000,
      },
    );
  }

  async getReadingSettings() {
    return this.prisma.platformSetting.findFirst({
      orderBy: {
        sourceAsOf: 'desc',
      },
      select: {
        maxReadingSizeBytes: true,
        allowedReadingMimeTypes: true,
        readingSpeedWordsPerMinute: true,
      },
    });
  }

  async createReadingMaterialWithQuota(data: {
    organizationId: string;
    instructorId: string;
    courseId: string;
    lessonId: string;
    title: string;
    isRequired: boolean;
    maxStorageBytes: bigint;
    file: {
      storageKey: string;
      deliveryType: string;
      storageFormat: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      wordCount: number;
    };
  }) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Khóa quota theo Organization.
        await tx.$executeRaw`
        INSERT INTO organization_quota_locks
          (organization_id, created_at, updated_at)
        VALUES (
          ${data.organizationId}::uuid,
          NOW(),
          NOW()
        )
        ON CONFLICT (organization_id) DO NOTHING
      `;

        await tx.$queryRaw`
        SELECT organization_id
        FROM organization_quota_locks
        WHERE organization_id =
          ${data.organizationId}::uuid
        FOR UPDATE
      `;

        const ownsCourse = await this.lockOwnedCourseForWrite(
          tx,
          data.courseId,
          data.organizationId,
          data.instructorId,
        );
        if (!ownsCourse) {
          return { status: 'NOT_FOUND' as const };
        }

        // 3. Kiểm tra lại quyền sở hữu và trạng thái.
        const lesson = await tx.lesson.findFirst({
          where: {
            id: data.lessonId,
            organizationId: data.organizationId,
            module: {
              courseId: data.courseId,
              organizationId: data.organizationId,
              course: {
                organizationId: data.organizationId,
                chain: {
                  instructorId: data.instructorId,
                },
              },
            },
          },
          select: {
            disabledAt: true,
            module: {
              select: {
                course: {
                  select: {
                    status: true,
                    lockedAt: true,
                    disabledAt: true,
                  },
                },
              },
            },
          },
        });

        if (!lesson) {
          return { status: 'NOT_FOUND' as const };
        }

        const course = lesson.module.course;

        if (course.status === 'Submitted') {
          return { status: 'SUBMITTED' as const };
        }

        if (
          course.status === 'Archived' ||
          course.status === 'Disabled' ||
          course.disabledAt !== null ||
          lesson.disabledAt !== null
        ) {
          return { status: 'NOT_EDITABLE' as const };
        }

        if (course.lockedAt !== null && data.isRequired) {
          return { status: 'LOCKED_REQUIRED' as const };
        }

        // 4. Kiểm tra quota dưới khóa.
        const usage = await tx.mediaFile.aggregate({
          where: {
            organizationId: data.organizationId,
            status: 'Ready',
            releasedAt: null,
          },
          _sum: {
            sizeBytes: true,
          },
        });

        const usedBytes = usage._sum.sizeBytes ?? 0n;
        const incomingBytes = BigInt(data.file.sizeBytes);

        if (usedBytes + incomingBytes > data.maxStorageBytes) {
          return { status: 'QUOTA_EXCEEDED' as const };
        }

        // 5. Tìm vị trí cuối Lesson.
        const lastMaterial = await tx.material.findFirst({
          where: {
            organizationId: data.organizationId,
            lessonId: data.lessonId,
          },
          orderBy: {
            position: 'desc',
          },
          select: {
            position: true,
          },
        });

        // 6. Lưu thông tin file.
        const mediaFile = await tx.mediaFile.create({
          data: {
            organizationId: data.organizationId,
            purpose: 'LessonReading',
            status: 'Ready',
            storageKey: data.file.storageKey,
            deliveryType: data.file.deliveryType,
            storageFormat: data.file.storageFormat,
            originalFilename: data.file.originalFilename,
            mimeType: data.file.mimeType,
            sizeBytes: incomingBytes,
            wordCount: data.file.wordCount,
            readyAt: new Date(),
          },
          select: {
            id: true,
          },
        });

        // 7. Tạo Material.
        const material = await tx.material.create({
          data: {
            organizationId: data.organizationId,
            lessonId: data.lessonId,
            fileId: mediaFile.id,
            materialType: 'Reading',
            title: data.title,
            isRequired: data.isRequired,
            position: (lastMaterial?.position ?? 0) + 1,
          },
          select: {
            id: true,
            title: true,
            materialType: true,
            isRequired: true,
            position: true,
            fileId: true,
          },
        });

        return {
          status: 'CREATED' as const,
          material,
        };
      },
      {
        timeout: 20000,
      },
    );
  }

  async submitCourseForApproval(data: {
    courseId: string;
    organizationId: string;
    instructorId: string;
    expectedUpdatedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const submittedAt = new Date();
      const expectedMs = data.expectedUpdatedAt.getTime();
      // Chỉ cập nhật khi Course vẫn thuộc đúng Instructor,
      // đúng Organization, đúng trạng thái và chưa bị sửa.
      const updated = await tx.course.updateMany({
        where: {
          id: data.courseId,
          organizationId: data.organizationId,
          deletedAt: null,
          chain: {
            instructorId: data.instructorId,
          },
          status: {
            in: [COURSE_STATUS.DRAFT, COURSE_STATUS.REJECTED],
          },
          // So sánh trong cùng một millisecond.
          updatedAt: {
            gte: new Date(expectedMs),
            lt: new Date(expectedMs + 1),
          },
        },
        data: {
          status: COURSE_STATUS.SUBMITTED,
          submittedAt,
        },
      });

      // Không có dòng được sửa: dữ liệu đã thay đổi.
      if (updated.count !== 1) {
        return {
          status: 'CONFLICT' as const,
        };
      }

      const course = await tx.course.findUniqueOrThrow({
        where: {
          id: data.courseId,
        },
        select: {
          id: true,
          name: true,
          versionNumber: true,
          status: true,
          submittedAt: true,
        },
      });

      // Ghi Outbox trong chính transaction này.

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Course',
          aggregateId: course.id,
          organizationId: data.organizationId,
          eventType: 'CourseSubmitted',
          occurredAt: submittedAt,
          payload: {
            organizationId: data.organizationId,
            courseId: course.id,
            occurredAt: submittedAt.toISOString(),

            instructorId: data.instructorId,
            courseName: course.name,
            versionNumber: course.versionNumber,
            submittedAt: submittedAt.toISOString(),
          },
        },
      });

      return {
        status: 'SUBMITTED' as const,
        course,
      };
    });
  }

  async softDeleteCourse(input: {
    organizationId: string;
    instructorId: string;
    courseId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Khóa dòng Course để ngăn hai request
      // cùng thay đổi trạng thái.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT c.id
      FROM courses c
      JOIN course_chains cc
        ON cc.id = c.chain_id
      WHERE c.id = ${input.courseId}::uuid
        AND c.organization_id = ${input.organizationId}::uuid
        AND cc.instructor_id = ${input.instructorId}::uuid
      FOR UPDATE OF c
    `;

      if (locked.length === 0) {
        return { status: 'NOT_FOUND' as const };
      }

      const course = await tx.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          status: true,
          lockedAt: true,
          deletedAt: true,
        },
      });

      if (!course || course.deletedAt !== null) {
        return { status: 'NOT_FOUND' as const };
      }

      if (
        course.status !== COURSE_STATUS.DRAFT &&
        course.status !== COURSE_STATUS.REJECTED
      ) {
        return { status: 'INVALID_STATUS' as const };
      }

      if (course.lockedAt !== null) {
        return { status: 'LOCKED' as const };
      }

      const deletedAt = new Date();

      await tx.course.update({
        where: { id: course.id },
        data: {
          deletedAt,
          deletedBy: input.instructorId,
        },
      });

      return {
        status: 'DELETED' as const,
        courseId: course.id,
        deletedAt,
        purgeAt: getPurgeAt(deletedAt),
      };
    });
  }

  findCourseTrash(organizationId: string, instructorId: string) {
    return this.prisma.course.findMany({
      where: {
        organizationId,
        chain: {
          instructorId,
        },
        deletedAt: {
          not: null,
        },
      },
      select: {
        id: true,
        chainId: true,
        name: true,
        versionNumber: true,
        status: true,
        deletedAt: true,
        deletedBy: true,
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  async restoreCourse(input: {
    organizationId: string;
    instructorId: string;
    courseId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Tìm chain của Course.
      const target = await tx.course.findFirst({
        where: {
          id: input.courseId,
          organizationId: input.organizationId,
          chain: {
            instructorId: input.instructorId,
          },
          deletedAt: {
            not: null,
          },
        },
        select: {
          id: true,
          chainId: true,
        },
      });

      if (!target) {
        return { status: 'NOT_FOUND' as const };
      }

      // Khóa chain để các thao tác trên cùng chuỗi
      // có thể phối hợp đồng thời.
      await tx.$queryRaw`
      SELECT id
      FROM course_chains
      WHERE id = ${target.chainId}::uuid
      FOR UPDATE
    `;

      // Khóa bản cần Restore.
      await tx.$queryRaw`
      SELECT id
      FROM courses
      WHERE id = ${input.courseId}::uuid
      FOR UPDATE
    `;

      // Đọc lại điều kiện sau khi khóa.
      const course = await tx.course.findFirst({
        where: {
          id: input.courseId,
          organizationId: input.organizationId,
          chain: {
            instructorId: input.instructorId,
          },
          deletedAt: {
            not: null,
          },
        },
      });

      if (!course || !course.deletedAt) {
        return { status: 'NOT_FOUND' as const };
      }

      if (isTrashExpired(course.deletedAt)) {
        return { status: 'EXPIRED' as const };
      }

      // Tìm phiên bản khác đang soạn.
      const conflict = await tx.course.findFirst({
        where: {
          chainId: course.chainId,
          id: { not: course.id },
          deletedAt: null,
          status: {
            in: ['Draft', 'Submitted', 'Rejected'],
          },
        },
        select: {
          id: true,
        },
      });

      if (conflict) {
        return { status: 'VERSION_CONFLICT' as const };
      }

      // Khôi phục.
      await tx.course.update({
        where: { id: course.id },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });

      return {
        status: 'RESTORED' as const,
        courseId: course.id,
      };
    });
  }

  async permanentDeleteCourse(input: PermanentDeleteInput) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Khóa quota của Organization.
      await tx.$executeRaw`
      INSERT INTO organization_quota_locks
        (organization_id, created_at, updated_at)
      VALUES (
        ${input.organizationId}::uuid,
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id) DO NOTHING
    `;

      await tx.$queryRaw`
      SELECT organization_id
      FROM organization_quota_locks
      WHERE organization_id = ${input.organizationId}::uuid
      FOR UPDATE
    `;

      // 2. Đọc Course để xác định chain.
      const initial = await tx.course.findFirst({
        where: {
          id: input.courseId,
          organizationId: input.organizationId,
        },
        select: {
          chainId: true,
        },
      });

      if (!initial) {
        return { status: 'NOT_FOUND' as const };
      }

      // 3. Khóa chain.
      await tx.$queryRaw`
      SELECT id
      FROM course_chains
      WHERE id = ${initial.chainId}::uuid
      FOR UPDATE
    `;

      // 4. Khóa Course.
      await tx.$queryRaw`
      SELECT id
      FROM courses
      WHERE id = ${input.courseId}::uuid
      FOR UPDATE
    `;

      // 5. Đọc lại dữ liệu và các Media references.
      const course = await tx.course.findFirst({
        where: {
          id: input.courseId,
          organizationId: input.organizationId,
          ...(input.instructorId
            ? {
                chain: {
                  instructorId: input.instructorId,
                },
              }
            : {}),
        },
        include: {
          chain: {
            select: {
              instructorId: true,
            },
          },
          modules: {
            include: {
              lessons: {
                include: {
                  materials: {
                    select: {
                      fileId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!course) {
        return { status: 'NOT_FOUND' as const };
      }

      if (!course.deletedAt) {
        return { status: 'NOT_IN_TRASH' as const };
      }

      if (input.requireExpired && !isTrashExpired(course.deletedAt)) {
        return { status: 'NOT_EXPIRED' as const };
      }

      // 6. Thu thập toàn bộ MediaFile ID.
      const fileIds = new Set<string>();

      if (course.coverFileId) {
        fileIds.add(course.coverFileId);
      }

      for (const module of course.modules) {
        for (const lesson of module.lessons) {
          for (const material of lesson.materials) {
            fileIds.add(material.fileId);
          }
        }
      }

      // 7. Xóa Course và dữ liệu phụ thuộc.
      await tx.course.delete({
        where: { id: course.id },
      });

      // 8. Kiểm tra xem chain còn phiên bản không.
      const remainingVersions = await tx.course.count({
        where: {
          chainId: course.chainId,
        },
      });

      if (remainingVersions === 0) {
        await tx.courseChain.delete({
          where: { id: course.chainId },
        });
      }

      // 9. Release chỉ những MediaFile
      // không còn tham chiếu.
      const releasedFileIds: string[] = [];
      const releasedFiles: Array<{
        storageKey: string;
        resourceType: 'image' | 'video' | 'raw';
        deliveryType: string;
      }> = [];
      for (const fileId of fileIds) {
        const coverRefs = await tx.course.count({
          where: { coverFileId: fileId },
        });

        const materialRefs = await tx.material.count({
          where: { fileId },
        });

        if (coverRefs > 0 || materialRefs > 0) {
          continue;
        }

        const released = await tx.mediaFile.updateMany({
          where: {
            id: fileId,
            organizationId: input.organizationId,
            status: 'Ready',
            releasedAt: null,
          },
          data: {
            releasedAt: new Date(),
          },
        });

        if (released.count === 1) {
          releasedFileIds.push(fileId);
          const file = await tx.mediaFile.findUniqueOrThrow({
            where: { id: fileId },
            select: {
              storageKey: true,
              mimeType: true,
              deliveryType: true,
            },
          });

          const resourceType: 'image' | 'video' | 'raw' =
            file.mimeType.startsWith('image/')
              ? 'image'
              : file.mimeType.startsWith('video/')
                ? 'video'
                : 'raw';

          releasedFiles.push({
            storageKey: file.storageKey,
            resourceType,
            deliveryType: file.deliveryType,
          });
        }
      }

      // 10. Ghi event CourseDeleted.
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Course',
          aggregateId: course.id,
          organizationId: input.organizationId,
          eventType: 'CourseDeleted',
          occurredAt: new Date(),
          payload: {
            courseId: course.id,
            chainId: course.chainId,
            organizationId: input.organizationId,
            instructorId: course.chain.instructorId,
            releasedFiles,
          },
        },
      });

      return {
        status: 'DELETED' as const,
        courseId: course.id,
        chainDeleted: remainingVersions === 0,
        releasedFileIds,
      };
    });
  }

  findExpiredTrash(limit = 20) {
    const cutoff = new Date(Date.now() - COURSE_TRASH_MS);

    return this.prisma.course.findMany({
      where: {
        deletedAt: {
          lte: cutoff,
        },
      },
      select: {
        id: true,
        organizationId: true,
      },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  findPendingCourseDeletionJobs(limit = 20) {
    return this.prisma.outboxEvent.findMany({
      where: {
        eventType: 'CourseDeleted',
        publishedAt: null,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async claimCourseDeletionJob(id: string) {
    const now = new Date();

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        eventType: 'CourseDeleted',
        publishedAt: null,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: {
        nextAttemptAt: new Date(now.getTime() + 120_000),
        attempts: { increment: 1 },
      },
    });

    return result.count === 1;
  }

  markCourseDeletionJobCompleted(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        publishedAt: new Date(),
        nextAttemptAt: null,
        lastError: null,
      },
    });
  }

  markCourseDeletionJobFailed(id: string, error: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        lastError: error.slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + 60_000),
      },
    });
  }

  async updateMaterialMetadata(data: {
    organizationId: string;
    instructorId: string;
    courseId: string;
    lessonId: string;
    materialId: string;
    title?: string;
    isRequired?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ownsCourse = await this.lockOwnedCourseForWrite(
        tx,
        data.courseId,
        data.organizationId,
        data.instructorId,
      );

      if (!ownsCourse) {
        return { status: 'NOT_FOUND' as const };
      }

      const material = await tx.material.findFirst({
        where: {
          id: data.materialId,
          organizationId: data.organizationId,
          lessonId: data.lessonId,
          lesson: {
            organizationId: data.organizationId,
            module: {
              courseId: data.courseId,
              course: {
                organizationId: data.organizationId,
                chain: {
                  instructorId: data.instructorId,
                },
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          isRequired: true,
          lesson: {
            select: {
              disabledAt: true,
              module: {
                select: {
                  course: {
                    select: {
                      status: true,
                      lockedAt: true,
                      disabledAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!material) {
        return { status: 'NOT_FOUND' as const };
      }

      const course = material.lesson.module.course;

      if (course.status === COURSE_STATUS.SUBMITTED) {
        return { status: 'SUBMITTED' as const };
      }

      if (
        ![
          COURSE_STATUS.DRAFT,
          COURSE_STATUS.REJECTED,
          COURSE_STATUS.PUBLISHED,
        ].includes(
          course.status as
            | typeof COURSE_STATUS.DRAFT
            | typeof COURSE_STATUS.REJECTED
            | typeof COURSE_STATUS.PUBLISHED,
        ) ||
        course.disabledAt !== null ||
        material.lesson.disabledAt !== null
      ) {
        return { status: 'NOT_EDITABLE' as const };
      }

      const requiredChanged =
        data.isRequired !== undefined &&
        data.isRequired !== material.isRequired;

      if (course.lockedAt !== null && requiredChanged) {
        return { status: 'LOCKED_REQUIRED' as const };
      }

      const nextTitle = data.title ?? material.title;
      const nextRequired = data.isRequired ?? material.isRequired;

      if (
        nextTitle === material.title &&
        nextRequired === material.isRequired
      ) {
        return {
          status: 'UPDATED' as const,
          material: {
            id: material.id,
            title: material.title,
            isRequired: material.isRequired,
          },
        };
      }

      const updated = await tx.material.update({
        where: { id: material.id },
        data: {
          title: nextTitle,
          isRequired: nextRequired,
        },
        select: {
          id: true,
          title: true,
          isRequired: true,
        },
      });

      return {
        status: 'UPDATED' as const,
        material: updated,
      };
    });
  }
  async findMaterialForUpdate(
    organizationId: string,
    instructorId: string,
    courseId: string,
    lessonId: string,
    materialId: string,
  ) {
    return this.prisma.material.findFirst({
      where: {
        id: materialId,
        organizationId,
        lessonId,
        lesson: {
          organizationId,
          module: {
            courseId,
            course: {
              organizationId,
              chain: { instructorId },
            },
          },
        },
      },
      include: {
        file: true,
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });
  }

  async commitTechnicalReplacement(data: {
    organizationId: string;
    instructorId: string;
    courseId: string;
    lessonId: string;
    materialId: string;
    expectedFileId: string;
    expectedStorageKey: string;
    maxStorageBytes: bigint;
    replacement: {
      storageKey: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      deliveryType: string;
      storageFormat: string;
      durationSeconds: number | null;
      wordCount: number | null;
    };
  }) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Khóa quota của Organization.
        await tx.$executeRaw`
        INSERT INTO organization_quota_locks
          (organization_id, created_at, updated_at)
        VALUES (
          ${data.organizationId}::uuid,
          NOW(),
          NOW()
        )
        ON CONFLICT (organization_id) DO NOTHING
      `;

        await tx.$queryRaw`
        SELECT organization_id
        FROM organization_quota_locks
        WHERE organization_id = ${data.organizationId}::uuid
        FOR UPDATE
      `;

        // 2. Lock the Course and recheck Trash after the upload.
        const ownsCourse = await this.lockOwnedCourseForWrite(
          tx,
          data.courseId,
          data.organizationId,
          data.instructorId,
        );

        if (!ownsCourse) {
          return { status: 'NOT_FOUND' as const };
        }

        // 3. Khóa MediaFile dùng chung.
        const lockedFiles = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM media_files
        WHERE id = ${data.expectedFileId}::uuid
          AND organization_id = ${data.organizationId}::uuid
        FOR UPDATE
      `;

        if (lockedFiles.length === 0) {
          return { status: 'NOT_FOUND' as const };
        }

        // 4. Kiểm tra lại Material, Tenant và Instructor.
        const material = await tx.material.findFirst({
          where: {
            id: data.materialId,
            organizationId: data.organizationId,
            lessonId: data.lessonId,
            fileId: data.expectedFileId,
            lesson: {
              organizationId: data.organizationId,
              module: {
                courseId: data.courseId,
                organizationId: data.organizationId,
                course: {
                  organizationId: data.organizationId,
                  chain: {
                    instructorId: data.instructorId,
                  },
                },
              },
            },
          },
          include: {
            file: true,
            lesson: {
              include: {
                module: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        });

        if (!material) {
          return { status: 'NOT_FOUND' as const };
        }

        const course = material.lesson.module.course;

        // 5. Kiểm tra trạng thái Course.
        if (course.status === COURSE_STATUS.SUBMITTED) {
          return { status: 'SUBMITTED' as const };
        }

        if (
          ![
            COURSE_STATUS.DRAFT,
            COURSE_STATUS.REJECTED,
            COURSE_STATUS.PUBLISHED,
          ].includes(
            course.status as
              | typeof COURSE_STATUS.DRAFT
              | typeof COURSE_STATUS.REJECTED
              | typeof COURSE_STATUS.PUBLISHED,
          ) ||
          course.disabledAt !== null ||
          material.lesson.disabledAt !== null
        ) {
          return { status: 'NOT_EDITABLE' as const };
        }

        // 6. Kiểm tra file hiện tại.
        if (
          material.file.storageKey !== data.expectedStorageKey ||
          material.file.status !== 'Ready' ||
          material.file.releasedAt !== null
        ) {
          return { status: 'STALE_FILE' as const };
        }

        // Không dùng lại storageKey cũ.
        if (data.replacement.storageKey === material.file.storageKey) {
          return { status: 'INVALID_REPLACEMENT' as const };
        }

        // 7. Kiểm tra metadata phù hợp Material type.
        if (material.materialType === 'Video') {
          if (
            data.replacement.durationSeconds === null ||
            !Number.isInteger(data.replacement.durationSeconds) ||
            data.replacement.durationSeconds <= 0 ||
            data.replacement.wordCount !== null
          ) {
            return { status: 'INVALID_REPLACEMENT' as const };
          }
        } else if (material.materialType === 'Reading') {
          if (
            data.replacement.wordCount === null ||
            !Number.isInteger(data.replacement.wordCount) ||
            data.replacement.wordCount < 0 ||
            data.replacement.durationSeconds !== null
          ) {
            return { status: 'INVALID_REPLACEMENT' as const };
          }
        } else {
          return { status: 'INVALID_REPLACEMENT' as const };
        }

        if (
          !Number.isSafeInteger(data.replacement.sizeBytes) ||
          data.replacement.sizeBytes <= 0
        ) {
          return { status: 'INVALID_REPLACEMENT' as const };
        }

        // 8. Kiểm tra Storage quota trong transaction.
        const usage = await tx.mediaFile.aggregate({
          where: {
            organizationId: data.organizationId,
            status: 'Ready',
            releasedAt: null,
          },
          _sum: {
            sizeBytes: true,
          },
        });

        const usedBytes = usage._sum.sizeBytes ?? 0n;
        const incomingBytes = BigInt(data.replacement.sizeBytes);

        const nextBytes = usedBytes - material.file.sizeBytes + incomingBytes;

        if (nextBytes > data.maxStorageBytes) {
          return { status: 'QUOTA_EXCEEDED' as const };
        }

        // 9. Lưu thông tin file cũ để Service cleanup sau commit.
        const oldFile = {
          storageKey: material.file.storageKey,
          deliveryType: material.file.deliveryType,
          resourceType:
            material.materialType === 'Video'
              ? ('video' as const)
              : ('raw' as const),
        };

        // BR-126: Technical replacement repairs the existing shared MediaFile.
        // It intentionally preserves MediaFile.id and Material.fileId.
        //
        // TODO(UC22 / BR-125):
        // Version-specific content replacement is a separate operation.
        // For Draft/Rejected versions sharing an existing MediaFile,
        // create a new MediaFile and update only that version's Material.fileId.
        //
        // Never reuse this in-place update for content replacement.
        const updatedFile = await tx.mediaFile.update({
          where: {
            id: material.file.id,
          },
          data: {
            storageKey: data.replacement.storageKey,
            originalFilename: data.replacement.originalFilename,
            mimeType: data.replacement.mimeType,
            sizeBytes: incomingBytes,
            deliveryType: data.replacement.deliveryType,
            storageFormat: data.replacement.storageFormat,
            durationSeconds: data.replacement.durationSeconds,
            wordCount: data.replacement.wordCount,
            status: 'Ready',
            readyAt: new Date(),
          },
          select: {
            id: true,
            storageKey: true,
            sizeBytes: true,
            durationSeconds: true,
            wordCount: true,
          },
        });

        return {
          status: 'REPLACED' as const,
          fileId: updatedFile.id,
          storageKey: updatedFile.storageKey,
          sizeBytes: updatedFile.sizeBytes.toString(),
          durationSeconds: updatedFile.durationSeconds,
          wordCount: updatedFile.wordCount,
          oldFile,
        };
      },
      {
        timeout: 20000,
      },
    );
  }

  /**
   * UC21.2 – Read Course content for Organizer review.
   * Database access only; authorization belongs to Service.
   */
  findCourseForOrganizerReview(organizationId: string, courseId: string) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        disabledAt: null,
      },
      select: {
        id: true,
        name: true,
        shortDescription: true,
        trainingObjectives: true,
        learningOutcomes: true,
        versionNumber: true,
        courseType: true,
        expectedCompletionDays: true,
        status: true,
        lockedAt: true,
        submittedAt: true,
        chain: {
          select: { instructorId: true },
        },
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
                content: true,
                position: true,
                disabledAt: true,
                materials: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    position: true,
                    materialType: true,
                    isRequired: true,
                    disabledAt: true,
                    file: {
                      select: {
                        originalFilename: true,
                        mimeType: true,
                        purpose: true,
                        status: true,
                        readyAt: true,
                        releasedAt: true,
                        deliveryType: true,
                        durationSeconds: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get a Material only when it belongs to the requested
   * Submitted Course and Organization.
   */
  findOrganizerReviewMaterial(
    organizationId: string,
    courseId: string,
    materialId: string,
  ) {
    return this.prisma.material.findFirst({
      where: {
        id: materialId,
        organizationId,
        lesson: {
          organizationId,
          module: {
            organizationId,
            courseId,
            course: {
              organizationId,
              status: COURSE_STATUS.SUBMITTED,
              disabledAt: null,
            },
          },
        },
      },
      select: {
        materialType: true,
        disabledAt: true,
        lesson: {
          select: { disabledAt: true },
        },
        file: {
          select: {
            organizationId: true,
            purpose: true,
            status: true,
            readyAt: true,
            releasedAt: true,
            mimeType: true,
            deliveryType: true,
            storageKey: true,
            storageFormat: true,
          },
        },
      },
    });
  }

  /**
   * Used by Assessment Service through an authenticated
   * internal Course Service endpoint.
   */
  findOrganizerReviewAccess(organizationId: string, courseId: string) {
    return this.prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        status: COURSE_STATUS.SUBMITTED,
        disabledAt: null,
      },
      select: { id: true },
    });
  }

  async withdrawCourseSubmission(data: {
    courseId: string;
    organizationId: string;
    instructorId: string;
    expectedUpdatedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const expectedMs = data.expectedUpdatedAt.getTime();

      const updated = await tx.course.updateMany({
        where: {
          id: data.courseId,
          organizationId: data.organizationId,
          deletedAt: null,
          chain: {
            instructorId: data.instructorId,
          },
          status: COURSE_STATUS.SUBMITTED,
          updatedAt: {
            gte: new Date(expectedMs),
            lt: new Date(expectedMs + 1),
          },
        },
        data: {
          status: COURSE_STATUS.DRAFT,
          submittedAt: null,
        },
      });

      if (updated.count !== 1) {
        return {
          status: 'CONFLICT' as const,
        };
      }

      const course = await tx.course.findUniqueOrThrow({
        where: {
          id: data.courseId,
        },
        select: {
          id: true,
          name: true,
          versionNumber: true,
          status: true,
          submittedAt: true,
        },
      });

      return {
        status: 'WITHDRAWN' as const,
        course,
      };
    });
  }
}
