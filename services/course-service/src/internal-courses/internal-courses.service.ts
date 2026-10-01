import { createApiError } from '@learnup/ts-common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourseBatchItemDto } from './dto/course-batch-item.dto';
import { CourseTreeDto } from './dto/course-tree.dto';
import { LessonContentDto } from './dto/lesson-content.dto';
import { LockedCourseDto } from './dto/locked-course.dto';

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

/**
 * REST nội bộ cho learning-service (CourseService_Database_Design.md mục 4.2).
 * Mọi truy vấn lọc theo organizationId của người gọi; Course của tổ chức khác coi như không tồn tại.
 */
@Injectable()
export class InternalCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gắn Locked và kiểm Course còn nhận Enrollment (BR-70, BR-62, BR-80, BR-83).
   * Gọi lại không đổi kết quả: locked_at đã có thì giữ nguyên.
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

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockableCourseRow[]>`
        SELECT id, organization_id, chain_id, expected_completion_days,
               course_type, status, locked_at
        FROM courses
        WHERE id = ${courseId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE`;

      const course = rows[0];
      if (!course) {
        throw courseNotFound();
      }

      if (course.status !== 'Published') {
        throw new ConflictException(
          createApiError(
            'COURSE_NOT_AVAILABLE',
            'Course is not published and cannot accept enrollments.',
          ),
        );
      }

      if (selfEnroll && course.course_type !== 'Public') {
        throw new ConflictException(
          createApiError(
            'COURSE_NOT_AVAILABLE',
            'Only Public courses accept self-enrollment.',
          ),
        );
      }

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
      return [];
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
}
