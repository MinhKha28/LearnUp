import { COURSE_STATUS, COURSE_TYPE } from '../courses/course-values';
import { createApiError } from '@learnup/ts-common';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '@infra/prisma/prisma.service';
import { CourseBatchItemDto } from './dto/course-batch-item.dto';
import { AssignmentMinutesDto } from './dto/assignment-minutes.dto';
import { CourseTreeDto } from './dto/course-tree.dto';
import { InstructorCourseCountsDto } from './dto/instructor-course-counts.dto';
import { LessonContentDto } from './dto/lesson-content.dto';
import { LockedCourseDto } from './dto/locked-course.dto';
import { OrganizationUsageDto } from './dto/organization-usage.dto';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import {
  StorageProviderError,
  type IReadableStorageProvider,
} from '@learnup/ts-storage';

interface LockableCourseRow {
  id: string;
  organization_id: string;
  chain_id: string;
  expected_completion_days: number;
  course_type: string;
  status: string;
  locked_at: Date | null;
}

const courseNotFound = () =>
  new NotFoundException(
    createApiError('COURSE_NOT_FOUND', 'Course not found.'),
  );

function validateEnrollmentCourse(
  course: LockableCourseRow | undefined,
  selfEnroll: boolean,
): asserts course is LockableCourseRow {
  if (!course) throw courseNotFound();
  if (course.status !== COURSE_STATUS.PUBLISHED) {
    throw new ConflictException(
      createApiError(
        'COURSE_NOT_AVAILABLE',
        'Course is not published and cannot accept enrollments.',
      ),
    );
  }
  if (selfEnroll && course.course_type !== COURSE_TYPE.PUBLIC) {
    throw new ConflictException(
      createApiError(
        'COURSE_NOT_AVAILABLE',
        'Only Public courses accept self-enrollment.',
      ),
    );
  }
}

/**
 * REST nội bộ cho learning-service (CourseService_Database_Design.md mục 4.2).
 * Mọi truy vấn lọc theo organizationId của người gọi; Course của tổ chức khác coi như không tồn tại.
 */
@Injectable()
export class InternalCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: IReadableStorageProvider,
  ) {}

  /**
   * Course đã Locked không cần khóa lại: locked_at không quay về NULL (BR-83).
   * Enrollment được tạo sau khi I1 commit; lần khóa đầu vẫn kiểm lại dưới khóa dòng.
   */
  async lock(
    organizationId: string | undefined,
    courseId: string,
    selfEnroll: boolean,
  ): Promise<LockedCourseDto> {
    // Header không phải UUID thì không thể sở hữu Course nào
    if (!organizationId || !isUUID(organizationId, 'all')) {
      throw courseNotFound();
    }

    const existingRows = await this.prisma.$queryRaw<LockableCourseRow[]>`
      SELECT id, organization_id, chain_id, expected_completion_days,
             course_type, status, locked_at
      FROM courses
      WHERE id = ${courseId}::uuid AND organization_id = ${organizationId}::uuid`;
    const existing = existingRows[0];
    validateEnrollmentCourse(existing, selfEnroll);
    if (existing.locked_at !== null) {
      return {
        courseId: existing.id,
        organizationId: existing.organization_id,
        chainId: existing.chain_id,
        expectedCompletionDays: existing.expected_completion_days,
        courseType: existing.course_type,
        lockedAt: existing.locked_at,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockableCourseRow[]>`
        SELECT id, organization_id, chain_id, expected_completion_days,
               course_type, status, locked_at
        FROM courses
        WHERE id = ${courseId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE`;

      const course = rows[0];
      validateEnrollmentCourse(course, selfEnroll);

      let lockedAt = course.locked_at;
      if (lockedAt === null) {
        const updated = await tx.$queryRaw<{ locked_at: Date }[]>`
          UPDATE courses
          SET locked_at = now(), updated_at = now()
          WHERE id = ${courseId}::uuid
          RETURNING locked_at`;
        lockedAt = updated[0].locked_at;
      }

      return {
        courseId: course.id,
        organizationId: course.organization_id,
        chainId: course.chain_id,
        expectedCompletionDays: course.expected_completion_days,
        courseType: course.course_type,
        lockedAt,
      };
    });
  }

  /**
   * UC19 / BR-51 / BR-172: thời lượng của Assignment cộng vào thời lượng ước tính của Course. assessment-service gửi
   * tổng tuyệt đối nên gọi lại bao nhiêu lần cũng cho cùng kết quả. Chỉnh được cả khi Course đã Locked (BR-173),
   * vì con số này chỉ phục vụ hiển thị và ước tính, không phải căn cứ tính kết quả.
   */
  async setAssignmentMinutes(
    organizationId: string | undefined,
    courseId: string,
    minutes: number,
  ): Promise<AssignmentMinutesDto> {
    if (!organizationId || !isUUID(organizationId, 'all')) {
      throw courseNotFound();
    }
    const rows = await this.prisma.$queryRaw<
      { id: string; assignment_minutes: number; as_of: Date }[]
    >`
      UPDATE courses
      SET assignment_minutes = ${minutes}::int,
          assignment_minutes_as_of = now(),
          updated_at = now()
      WHERE id = ${courseId}::uuid AND organization_id = ${organizationId}::uuid
      RETURNING id, assignment_minutes, assignment_minutes_as_of AS as_of`;
    const row = rows[0];
    if (!row) throw courseNotFound();
    return {
      courseId: row.id,
      assignmentMinutes: row.assignment_minutes,
      assignmentMinutesAsOf: row.as_of,
    };
  }

  /**
   * Cây chương trình của một phiên bản. Không kiểm status: Learner đã Enroll vẫn học khi Course bị Archived.
   * Đọc trong một snapshot (REPEATABLE READ) để asOf đúng với toàn bộ dữ liệu trả về.
   */
  async getTree(
    organizationId: string | undefined,
    courseId: string,
  ): Promise<CourseTreeDto> {
    if (!organizationId || !isUUID(organizationId, 'all')) {
      throw courseNotFound();
    }

    return this.prisma.$transaction(
      async (tx) => {
        // now() là thời điểm bắt đầu transaction; snapshot được chụp ở câu lệnh đầu tiên này
        const [{ as_of: asOf }] = await tx.$queryRaw<{ as_of: Date }[]>`
          SELECT now() AS as_of`;

        const course = await tx.course.findFirst({
          where: { id: courseId, organizationId },
          select: {
            id: true,
            chainId: true,
            versionNumber: true,
            disabledAt: true,
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
                        file: { select: { durationSeconds: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!course) {
          throw courseNotFound();
        }

        return {
          courseId: course.id,
          chainId: course.chainId,
          versionNumber: course.versionNumber,
          disabledAt: course.disabledAt,
          asOf,
          modules: course.modules.map((module) => ({
            ...module,
            lessons: module.lessons.map((lesson) => ({
              ...lesson,
              materials: lesson.materials.map(({ file, ...material }) => ({
                ...material,
                durationSeconds:
                  material.materialType === 'Video'
                    ? file.durationSeconds
                    : null,
              })),
            })),
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Thông tin phiên bản theo lô; ID không thuộc tổ chức hoặc không tồn tại thì bỏ qua. */
  async findBatch(
    organizationId: string | undefined,
    courseIds: string[],
  ): Promise<CourseBatchItemDto[]> {
    if (!organizationId || !isUUID(organizationId, 'all')) {
      throw new BadRequestException({
        code: 'ORGANIZATION_REQUIRED',
        message: 'A valid organization header is required.',
      });
    }

    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds }, organizationId },
      select: {
        id: true,
        chainId: true,
        versionNumber: true,
        name: true,
        courseType: true,
        status: true,
        coverFileId: true,
      },
    });

    // Giữ thứ tự của courseIds gửi lên
    const order = new Map(courseIds.map((id, index) => [id, index]));
    return courses
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(({ id, ...course }) => ({ courseId: id, ...course }));
  }

  /** Nội dung một Lesson; Lesson phải thuộc đúng Course và cùng tổ chức. */
  async getLesson(
    organizationId: string | undefined,
    courseId: string,
    lessonId: string,
  ): Promise<LessonContentDto> {
    const lessonNotFound = new NotFoundException(
      createApiError('LESSON_NOT_FOUND', 'Lesson not found.'),
    );
    if (!organizationId || !isUUID(organizationId, 'all')) {
      throw lessonNotFound;
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        organizationId,
        module: { courseId, organizationId },
      },
      select: {
        id: true,
        title: true,
        content: true,
        disabledAt: true,
        module: { select: { courseId: true } },
      },
    });

    if (!lesson) {
      throw lessonNotFound;
    }

    return {
      lessonId: lesson.id,
      courseId: lesson.module.courseId,
      title: lesson.title,
      content: lesson.content,
      disabledAt: lesson.disabledAt,
    };
  }

  async getOrganizationUsage(
    callerOrganizationId: string | undefined,
    organizationId: string,
  ): Promise<OrganizationUsageDto> {
    if (!callerOrganizationId || callerOrganizationId !== organizationId) {
      throw new NotFoundException(
        createApiError('ORGANIZATION_NOT_FOUND', 'Organization not found.'),
      );
    }

    const [courseChains, storage] = await Promise.all([
      this.prisma.courseChain.count({
        where: { organizationId, courses: { some: {} } },
      }),
      this.prisma.mediaFile.aggregate({
        where: { organizationId, status: 'Ready', releasedAt: null },
        _sum: { sizeBytes: true },
      }),
    ]);

    return {
      organizationId,
      courseChains,
      storageBytes: (storage._sum.sizeBytes ?? 0n).toString(),
    };
  }

  async countCourseChainsByInstructors(
    organizationId: string | undefined,
    instructorIds: string[],
  ): Promise<InstructorCourseCountsDto> {
    const counts: Record<string, number> = Object.fromEntries(
      instructorIds.map((id) => [id, 0]),
    );
    if (!organizationId || !isUUID(organizationId, 'all')) {
      return { counts };
    }

    const groups = await this.prisma.courseChain.groupBy({
      by: ['instructorId'],
      where: {
        organizationId,
        instructorId: { in: instructorIds },
        courses: { some: {} },
      },
      _count: { _all: true },
    });
    for (const group of groups) {
      counts[group.instructorId] = group._count._all;
    }
    return { counts };
  }
  async getMaterialSignedUrl(
    organizationId: string,
    courseId: string,
    materialId: string,
  ) {
    const material = await this.prisma.material.findFirst({
      where: {
        id: materialId,
        organizationId,
        lesson: {
          organizationId,
          module: {
            organizationId,
            courseId,
            course: { organizationId },
          },
        },
      },
      select: {
        materialType: true,
        disabledAt: true,
        lesson: {
          select: {
            disabledAt: true,
            module: {
              select: {
                course: {
                  select: {
                    disabledAt: true,
                  },
                },
              },
            },
          },
        },
        file: {
          select: {
            status: true,
            releasedAt: true,
            readyAt: true,
            purpose: true,
            storageKey: true,
            mimeType: true,
            deliveryType: true,
            storageFormat: true,
            organizationId: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException({
        code: 'MATERIAL_NOT_FOUND',
        message: 'Material not found.',
      });
    }

    if (
      material.disabledAt !== null ||
      material.lesson.disabledAt !== null ||
      material.lesson.module.course.disabledAt !== null
    ) {
      throw new ConflictException({
        code: 'MATERIAL_DISABLED',
        message: 'Material is unavailable.',
      });
    }

    const file = material.file;

    if (
      file.organizationId !== organizationId ||
      file.status !== 'Ready' ||
      file.readyAt === null ||
      file.releasedAt !== null ||
      file.deliveryType !== 'authenticated'
    ) {
      throw new ConflictException({
        code: 'MATERIAL_FILE_NOT_READY',
        message: 'Protected material file is not ready.',
      });
    }

    const isVideo = material.materialType === 'Video';
    const isReading = material.materialType === 'Reading';

    if (
      (!isVideo && !isReading) ||
      file.purpose !== (isVideo ? 'LessonVideo' : 'LessonReading') ||
      (isVideo && !file.mimeType.startsWith('video/')) ||
      (isReading && file.mimeType !== 'application/pdf')
    ) {
      throw new ConflictException({
        code: 'MATERIAL_FILE_NOT_READY',
        message: 'Invalid material file.',
      });
    }

    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 900;

    try {
      const url = this.storage.getSignedUrl(file.storageKey, {
        resourceType: isVideo ? 'video' : 'raw',
        format: isVideo ? file.storageFormat : '',
        deliveryType: 'authenticated',
        expiresAt: expiresAtSeconds,
      });

      return {
        url,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
        mimeType: file.mimeType,
      };
    } catch (error) {
      if (error instanceof StorageProviderError) {
        console.error('[Signed URL Error]', {
          name: error.name,
          message: error.message,
        });

        throw new ServiceUnavailableException({
          code: 'MATERIAL_URL_UNAVAILABLE',
          message: 'Unable to generate material URL.',
        });
      }

      throw error;
    }
  }
}
