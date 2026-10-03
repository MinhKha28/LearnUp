import {
  createApiError,
  HEADER_NAMES,
  type CurrentUser,
} from '@learnup/ts-common';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EnrollmentsRepository } from '../enrollments/enrollments.repository';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import {
  CourseNotAvailableError,
  CourseServiceError,
  CourseServiceUnavailableError,
} from '../../infrastructure/clients/course/course-service.errors';
import type {
  CourseBatchItem,
  CourseTree,
  LessonContent,
} from '../../infrastructure/clients/course/course-service.interface';
import { serviceUnavailable } from '../../infrastructure/clients/course/service-unavailable';
import { OrganizationTimezoneService } from '../../infrastructure/clients/tenant/organization-timezone.service';
import {
  buildCurriculum,
  neighborLessons,
  type Curriculum,
  type CurriculumLesson,
} from './build-curriculum';
import {
  CurriculumRepository,
  type AccessibleEnrollment,
} from './curriculum.repository';

export interface CurriculumView {
  enrollmentId: string;
  courseId: string;
  enrollmentType: string;
  status: string;
  dueAt: string | null;
  organizationTimezone: string | null;
  requiredMaterials: { completed: number; total: number };
  course: { name: string; versionNumber: number } | null;
  modules: {
    moduleId: string;
    title: string;
    position: number;
    isRequired: boolean;
    completed: boolean | null;
    lessons: {
      lessonId: string;
      title: string;
      position: number;
      isRequired: boolean;
      completed: boolean | null;
    }[];
  }[];
}

export interface LessonView {
  enrollmentId: string;
  lesson: {
    lessonId: string;
    title: string;
    content: string | null;
    isRequired: boolean;
    completed: boolean | null;
  };
  materials: {
    materialId: string;
    title: string;
    materialType: string;
    isRequired: boolean;
    durationSeconds: number | null;
    completed: boolean;
  }[];
  previousLesson: { lessonId: string; title: string } | null;
  nextLesson: { lessonId: string; title: string } | null;
}

const enrollmentNotFound = () =>
  new NotFoundException(
    createApiError('ENROLLMENT_NOT_FOUND', 'Không tìm thấy Course'),
  );
const contentUnavailable = () =>
  new ForbiddenException(
    createApiError(
      'CONTENT_UNAVAILABLE',
      'Course đang tạm dừng, bạn chưa thể truy cập nội dung',
    ),
  );
const lessonNotFound = () =>
  new NotFoundException(
    createApiError('LESSON_NOT_FOUND', 'Không tìm thấy Lesson'),
  );
const lessonDisabled = () =>
  new ForbiddenException(
    createApiError('LESSON_DISABLED', 'Lesson này đang tạm ngưng'),
  );

@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(
    private readonly curriculum: CurriculumRepository,
    private readonly enrollments: EnrollmentsRepository,
    private readonly courseService: CourseServiceClient,
    private readonly organizationTimezone: OrganizationTimezoneService,
  ) {}

  /** UC27: phần đầu và cây Module, Lesson. Chỉ đọc (BR-307). */
  async getCurriculum(
    user: CurrentUser,
    enrollmentId: string,
  ): Promise<CurriculumView> {
    const enrollment = await this.findAccessibleEnrollment(user, enrollmentId);
    const organizationId = user.organizationId!;
    const needsTimezone =
      enrollment.enrollmentType === 'Required' && enrollment.dueAt !== null;

    const [treeResult, batchResult, organizationTimezone] = await Promise.all([
      settle(this.courseService.getCourseTree(user, enrollment.courseId)),
      settle(this.courseService.getCoursesBatch(user, [enrollment.courseId])),
      needsTimezone
        ? this.organizationTimezone.getTimezone(user)
        : Promise.resolve(null),
    ]);
    const tree = this.treeOrThrow(treeResult, enrollment);
    const batch = this.valueOrThrow(batchResult, 'I3 batch', enrollment);

    const curriculum = await this.buildFor(tree, enrollment, organizationId);
    const counts = await this.enrollments.countRequiredMaterials(
      [enrollment.id],
      organizationId,
    );
    const course = batch.find(
      (item: CourseBatchItem) => item.courseId === enrollment.courseId,
    );
    if (!course) {
      // Như D26: vẫn trả cây, chỉ thiếu tên Course
      this.logger.error(
        `I3 không trả Course ${enrollment.courseId} của Enrollment ${enrollment.id}; trả course: null.`,
      );
    }

    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      enrollmentType: enrollment.enrollmentType,
      status: enrollment.status,
      dueAt: enrollment.dueAt ? enrollment.dueAt.toISOString() : null,
      organizationTimezone,
      requiredMaterials: counts.get(enrollment.id) ?? {
        completed: 0,
        total: 0,
      },
      course: course
        ? { name: course.name, versionNumber: course.versionNumber }
        : null,
      modules: curriculum.modules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        position: module.position,
        isRequired: module.isRequired,
        completed: module.completed,
        lessons: module.lessons.map((lesson) => ({
          lessonId: lesson.lessonId,
          title: lesson.title,
          position: lesson.position,
          isRequired: lesson.isRequired,
          completed: lesson.completed,
        })),
      })),
    };
  }

  /** UC27.1: nội dung một Lesson, học liệu hiển thị và Lesson trước/sau (D32). Chỉ đọc (BR-307). */
  async getLesson(
    user: CurrentUser,
    enrollmentId: string,
    lessonId: string,
  ): Promise<LessonView> {
    const enrollment = await this.findAccessibleEnrollment(user, enrollmentId);
    // Không gửi lessonId sai định dạng sang I4 (course-service trả 400)
    if (!isUUID(lessonId, 'all')) {
      throw lessonNotFound();
    }

    const [treeResult, lessonResult] = await Promise.all([
      settle(this.courseService.getCourseTree(user, enrollment.courseId)),
      settle(this.courseService.getLesson(user, enrollment.courseId, lessonId)),
    ]);
    const tree = this.treeOrThrow(treeResult, enrollment);
    const curriculum = await this.buildFor(
      tree,
      enrollment,
      user.organizationId!,
    );

    if (!curriculum.treeLessonIds.has(lessonId)) {
      throw lessonNotFound();
    }
    const visible = curriculum.visibleLessons.find(
      (lesson) => lesson.lessonId === lessonId,
    );
    if (!visible) {
      throw lessonDisabled();
    }
    const content = this.lessonOrThrow(lessonResult, enrollment, lessonId);
    if (content.disabledAt !== null) {
      throw lessonDisabled();
    }

    const { previous, next } = neighborLessons(curriculum, lessonId);
    return {
      enrollmentId: enrollment.id,
      lesson: {
        lessonId,
        title: content.title,
        content: content.content.trim() === '' ? null : content.content,
        isRequired: visible.isRequired,
        completed: visible.completed,
      },
      materials: visible.materials.map((material) => ({
        materialId: material.materialId,
        title: material.title,
        materialType: material.materialType,
        isRequired: material.isRequired,
        durationSeconds: material.durationSeconds,
        completed: material.completed,
      })),
      previousLesson: previous ? neighbor(previous) : null,
      nextLesson: next ? neighbor(next) : null,
    };
  }

  /**
   * D28: kiểm cục bộ trước khi gọi course-service. Không thấy hoặc Withdrawn → 404;
   * Halted hoặc bản sao phiên bản bị vô hiệu hóa → 403.
   */
  private async findAccessibleEnrollment(
    user: CurrentUser,
    enrollmentId: string,
  ): Promise<AccessibleEnrollment> {
    const organizationId = user.organizationId ?? '';
    const invalidHeaders = [
      [HEADER_NAMES.USER_ID, user.userId],
      [HEADER_NAMES.ORGANIZATION_ID, organizationId],
    ].filter(([, value]) => !isUUID(value, 'all'));
    for (const [header, value] of invalidHeaders) {
      this.logger.warn(
        `UC27: header ${header} không phải UUID ("${value.slice(0, 64)}"); trả 404.`,
      );
    }
    if (invalidHeaders.length > 0 || !isUUID(enrollmentId, 'all')) {
      throw enrollmentNotFound();
    }

    const enrollment = await this.curriculum.findAccessibleEnrollment(
      enrollmentId,
      user.userId,
      organizationId,
    );
    if (!enrollment || enrollment.storedStatus === 'Withdrawn') {
      throw enrollmentNotFound();
    }
    if (
      enrollment.storedStatus === 'Halted' ||
      enrollment.versionDisabledAt !== null
    ) {
      throw contentUnavailable();
    }
    return enrollment;
  }

  private async buildFor(
    tree: CourseTree,
    enrollment: AccessibleEnrollment,
    organizationId: string,
  ): Promise<Curriculum> {
    const [snapshot, completed] = await Promise.all([
      this.curriculum.findSnapshot(enrollment.courseId, organizationId),
      this.curriculum.findCompletedMaterialIds(enrollment.id, organizationId),
    ]);
    const curriculum = buildCurriculum(tree, snapshot, completed);

    const { onlyInTree, onlyInSnapshot, requiredMismatch } =
      curriculum.discrepancies;
    const where = `Course ${enrollment.courseId} (Enrollment ${enrollment.id})`;
    if (onlyInTree.length > 0) {
      this.logger.warn(
        `${where}: ${onlyInTree.length} học liệu có trong I2 nhưng chưa có trong bản sao; hiện là không bắt buộc.`,
      );
    }
    if (onlyInSnapshot.length > 0) {
      this.logger.error(
        `${where}: học liệu có trong bản sao nhưng không có trong I2, bỏ qua: ${onlyInSnapshot.join(', ')}.`,
      );
    }
    if (requiredMismatch.length > 0) {
      this.logger.error(
        `${where}: isRequired của I2 khác bản sao (BR-90), dùng bản sao: ${requiredMismatch.join(', ')}.`,
      );
    }
    return curriculum;
  }

  /** I2 lỗi → 503 (kể cả 404: dữ liệu lệch giữa hai service); phiên bản bị vô hiệu hóa → 403 (D28). */
  private treeOrThrow(
    result: Settled<CourseTree>,
    enrollment: AccessibleEnrollment,
  ): CourseTree {
    const tree = this.valueOrThrow(result, 'I2 tree', enrollment);
    if (tree.disabledAt !== null) {
      throw contentUnavailable();
    }
    return tree;
  }

  /** I4 lỗi hoặc trả Lesson của phiên bản khác → 503. */
  private lessonOrThrow(
    result: Settled<LessonContent>,
    enrollment: AccessibleEnrollment,
    lessonId: string,
  ): LessonContent {
    const content = this.valueOrThrow(result, 'I4 lesson', enrollment);
    if (
      content.courseId !== enrollment.courseId ||
      content.lessonId !== lessonId
    ) {
      this.logger.error(
        `I4 trả Lesson ${content.lessonId} của Course ${content.courseId}, khác Lesson ${lessonId} của Course ${enrollment.courseId} đã hỏi.`,
      );
      throw serviceUnavailable();
    }
    return content;
  }

  /**
   * Mọi lỗi course-service thành 503, không để thành 500. Client đã ghi log khi không trả lời
   * hoặc sai hợp đồng; các trường hợp còn lại ghi logger.error ở đây.
   */
  private valueOrThrow<T>(
    result: Settled<T>,
    endpoint: string,
    enrollment: AccessibleEnrollment,
  ): T {
    if (result.ok) {
      return result.value;
    }
    const { error } = result;
    if (!(error instanceof CourseServiceError)) {
      throw error;
    }
    if (!(error instanceof CourseServiceUnavailableError)) {
      const reason =
        error instanceof CourseNotAvailableError
          ? `không tìm thấy (${error.code ?? 'không có mã'}): dữ liệu lệch giữa learning và course-service`
          : error.message;
      this.logger.error(
        `${endpoint} cho Enrollment ${enrollment.id}, Course ${enrollment.courseId}: ${reason}.`,
      );
    }
    throw serviceUnavailable();
  }
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Chờ mọi lời gọi song song xong rồi mới quyết định lỗi nào trả về, để thứ tự kiểm cố định. */
function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

function neighbor(lesson: CurriculumLesson): {
  lessonId: string;
  title: string;
} {
  return { lessonId: lesson.lessonId, title: lesson.title };
}
