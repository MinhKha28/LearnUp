import {
  createApiError,
  createPageResponse,
  CurrentUser,
  PageResponse,
  STANDARD_ERROR_CODES,
} from '@learnup/ts-common';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CatalogRepository } from './catalog.repository';
import { CatalogCourseDto } from './dto/catalog-course.dto';
import { CourseIntroductionDto } from './dto/course-introduction.dto';

/** Kích thước trang cố định của danh mục (D11); client không đổi được. */
export const CATALOG_PAGE_SIZE = 12;

const COURSE_NOT_IN_CATALOG_MESSAGE =
  'Course không tồn tại hoặc không còn trong danh mục';

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  /** UC25: danh mục Course Public đang Published của tổ chức. */
  async findCatalog(
    user: CurrentUser,
    page: number,
  ): Promise<PageResponse<CatalogCourseDto>> {
    this.assertLearner(user);

    const organizationId = user.organizationId;
    // Header không phải UUID thì tổ chức không thể có Course nào
    if (!organizationId || !isUUID(organizationId, 'all')) {
      return createPageResponse([], page, CATALOG_PAGE_SIZE, 0);
    }

    // Đếm trước: trang vượt tổng trả rỗng ngay, offset quá lớn (page = 1e20) không xuống Prisma
    const total = await this.catalogRepository.countCatalog(organizationId);
    const skip = (page - 1) * CATALOG_PAGE_SIZE;
    if (skip >= total) {
      return createPageResponse([], page, CATALOG_PAGE_SIZE, total);
    }

    const courses = await this.catalogRepository.findCatalogCourses(
      organizationId,
      skip,
      CATALOG_PAGE_SIZE,
    );
    const durations = await this.catalogRepository.estimateDurationMinutes(
      organizationId,
      courses.map((course) => course.id),
    );

    const items = courses.map((course) => ({
      ...course,
      estimatedDurationMinutes: durations.get(course.id) ?? null,
    }));
    return createPageResponse(items, page, CATALOG_PAGE_SIZE, total);
  }

  /**
   * UC25.1: giới thiệu một Course trong danh mục.
   * Mọi trường hợp không xem được (sai định dạng, khác tổ chức, không Published/Public, bị vô hiệu hóa) trả cùng một lỗi 404.
   */
  async findIntroduction(
    user: CurrentUser,
    courseId: string,
  ): Promise<CourseIntroductionDto> {
    this.assertLearner(user);

    const organizationId = user.organizationId;
    if (
      !organizationId ||
      !isUUID(organizationId, 'all') ||
      !isUUID(courseId, 'all')
    ) {
      throw this.courseNotInCatalog();
    }

    const course = await this.catalogRepository.findIntroductionCourse(
      organizationId,
      courseId,
    );
    if (!course) {
      throw this.courseNotInCatalog();
    }

    const durations = await this.catalogRepository.estimateDurationMinutes(
      organizationId,
      [course.id],
    );

    let requiredMaterialCount = 0;
    const modules = course.modules.map((module) => {
      const lessons = module.lessons.map(({ materials, ...lesson }) => {
        const requiredCount = materials.filter((m) => m.isRequired).length;
        requiredMaterialCount += requiredCount;
        return {
          ...lesson,
          isRequired: requiredCount > 0,
          materialCount: materials.length,
        };
      });
      return {
        ...module,
        isRequired: lessons.some((lesson) => lesson.isRequired),
        lessons,
      };
    });

    return {
      ...course,
      estimatedDurationMinutes: durations.get(course.id) ?? null,
      requiredMaterialCount,
      modules,
    };
  }

  /** Actor của UC25, UC25.1 là Learner; Instructor không được xem cây Course của người khác (BR-79). */
  private assertLearner(user: CurrentUser): void {
    if (user.role !== 'LEARNER') {
      throw new ForbiddenException(
        createApiError(
          STANDARD_ERROR_CODES.FORBIDDEN,
          'Only Learner can view the course catalog.',
        ),
      );
    }
  }

  private courseNotInCatalog(): NotFoundException {
    return new NotFoundException(
      createApiError('COURSE_NOT_FOUND', COURSE_NOT_IN_CATALOG_MESSAGE),
    );
  }
}
