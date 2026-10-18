import {
  COURSE_COVER_MAX_SIZE_BYTES,
  COURSE_COVER_MIME_TYPES,
  COURSE_STATUS,
} from './course-values';
import { CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { TenantClient } from '@infra/clients/tenant/tenant.client';
import { OrganizationCourseListQueryDto } from './dto/organization-course-list-query.dto';
import { LearningClient } from '@infra/clients/learning/learning.client';
import { Prisma } from '@generated/prisma/browser';
import { STORAGE_PROVIDER } from '@/infrastructure/storage/storage.constants';
import {
  StorageProviderError,
  StorageValidationError,
  type IStorageProvider,
  type IStoredFile,
} from '@learnup/ts-storage';
import { CoursesRepository } from './courses.repository';
import { CourseAuthoringContext } from './interfaces/courses.interface';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateCourseStructureDto } from './dto/update-course-structure.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly tenantClient: TenantClient,
    private readonly learningClient: LearningClient,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
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

    const [courses, total] = await this.coursesRepository.findInstructorCourses(
      where,
      skip,
      pageSize,
    );

    const courseIds = courses.map((course) => course.id);

    const learnerCounts = await this.learningClient.getCourseLearnerCounts(
      user,
      courseIds,
    );

    const learnerCountMap = new Map(
      learnerCounts.map((item) => [item.courseId, item.learnerCount]),
    );

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
        learnerCount: learnerCountMap.get(course.id) ?? 0,
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
    const course = await this.coursesRepository.findAuthoringContext(
      courseId,
      organizationId,
    );

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
    const result = await this.coursesRepository.createCourse({
      organizationId: user.organizationId,
      instructorId: user.userId,
      name: dto.name.trim(),
      shortDescription: dto.shortDescription?.trim() || null,
      trainingObjectives: dto.trainingObjectives?.trim() || null,
      learningOutcomes,
      coverFileId: dto.coverFileId ?? null,
      expectedCompletionDays: dto.expectedCompletionDays,
      courseType: dto.courseType,
      status: COURSE_STATUS.DRAFT,
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

    const course = await this.coursesRepository.findStructure(
      courseId,
      user.organizationId,
      user.userId,
    );

    if (!course) {
      throw new NotFoundException('Course not found.');
    }
    const locked = course.lockedAt !== null;
    const submitted = course.status === COURSE_STATUS.SUBMITTED;
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

    const course = await this.coursesRepository.findOwnedCourseForEditing(
      courseId,
      user.organizationId,
      user.userId,
    );

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    if (course.status === COURSE_STATUS.SUBMITTED) {
      throw new BadRequestException(
        'Submitted Course cannot be edited. Withdraw the Course before adding a Module.',
      );
    }

    if (course.lockedAt) {
      throw new BadRequestException(
        'Cannot add Module because Course is Locked.',
      );
    }

    return this.coursesRepository.createModule(
      user.organizationId,
      courseId,
      title,
    );
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

    const course = await this.coursesRepository.findOwnedCourseForEditing(
      courseId,
      user.organizationId,
      user.userId,
    );

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    if (course.status === COURSE_STATUS.SUBMITTED) {
      throw new BadRequestException(
        'Submitted Course cannot be edited. Withdraw the Course before adding a Lesson.',
      );
    }

    if (course.lockedAt) {
      throw new BadRequestException(
        'Cannot add Lesson because Course is Locked.',
      );
    }

    const module = await this.coursesRepository.findModule(
      moduleId,
      courseId,
      user.organizationId,
    );

    if (!module) {
      throw new NotFoundException('Module not found.');
    }

    return this.coursesRepository.createLesson(
      user.organizationId,
      moduleId,
      title,
      content,
    );
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
    const search = query.search?.trim();

    const where: Prisma.CourseWhereInput = {
      organizationId: user.organizationId,

      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
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

      ...(query.instructorId
        ? {
            chain: {
              instructorId: query.instructorId,
            },
          }
        : {}),

      ...(query.submittedFrom || query.submittedTo
        ? {
            submittedAt: {
              ...(query.submittedFrom
                ? {
                    gte: new Date(`${query.submittedFrom}T00:00:00.000Z`),
                  }
                : {}),

              ...(query.submittedTo
                ? {
                    lte: new Date(`${query.submittedTo}T23:59:59.999Z`),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [courses, total] =
      await this.coursesRepository.findOrganizationCourses(
        where,
        skip,
        pageSize,
      );

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

  async getOrganizationCourseInstructors(user: CurrentUser) {
    if (user.role !== 'ORGANIZER') {
      throw new ForbiddenException(
        'Only Organizer can view Course instructors.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const instructorIds =
      await this.coursesRepository.findOrganizationInstructorIds(
        user.organizationId,
      );

    if (instructorIds.length === 0) {
      return [];
    }

    return this.tenantClient.getInstructors(user, instructorIds);
  }

  async findDetail(user: CurrentUser, courseId: string) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can view Course details.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    const course = await this.coursesRepository.findDetail(
      courseId,
      user.organizationId,
      user.userId,
    );

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    const estimatedDurationMinutes =
      await this.calculateEstimatedDurationMinutes(
        user.organizationId,
        course.id,
      );

    const { lockedAt, coverFile, ...result } = course;

    const coverUrl =
      coverFile?.status === 'Ready' && !coverFile.releasedAt
        ? this.storage.getUrl(coverFile.storageKey, 'image')
        : null;

    return {
      ...result,
      coverUrl,
      estimatedDurationMinutes,
      locked: lockedAt !== null,
    };
  }

  private async calculateEstimatedDurationMinutes(
    organizationId: string,
    courseId: string,
  ): Promise<number | null> {
    const readingSpeed =
      await this.coursesRepository.getReadingSpeedWordsPerMinute();

    if (readingSpeed === null || readingSpeed <= 0) {
      return null;
    }

    return this.coursesRepository.calculateEstimatedDurationMinutes(
      organizationId,
      courseId,
      readingSpeed,
    );
  }

  async uploadCover(user: CurrentUser, file?: Express.Multer.File) {
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can upload Course cover.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    if (!file) {
      throw new BadRequestException('Course cover file is required.');
    }

    let storedFile: IStoredFile;

    try {
      storedFile = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        {
          folder: `learnup/${user.organizationId}/courses/covers`,
          resourceType: 'image',
          validation: {
            maxSizeBytes: COURSE_COVER_MAX_SIZE_BYTES,
            allowedMimeTypes: COURSE_COVER_MIME_TYPES,
          },
        },
      );
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof StorageProviderError) {
        throw new ServiceUnavailableException('Unable to upload Course cover.');
      }

      throw error;
    }

    try {
      const mediaFile = await this.coursesRepository.createCourseCoverMediaFile(
        user.organizationId,
        storedFile,
      );

      return {
        fileId: mediaFile.id,
        url: storedFile.secureUrl,
        originalFilename: mediaFile.originalFilename,
        mimeType: mediaFile.mimeType,
        sizeBytes: Number(mediaFile.sizeBytes),
      };
    } catch (error) {
      await this.storage
        .delete(storedFile.storageKey, {
          resourceType: storedFile.resourceType,
        })
        .catch(() => undefined);

      throw error;
    }
  }

  async updateCourse(
    user: CurrentUser,
    courseId: string,
    dto: UpdateCourseDto,
  ) {
    // 1. Chỉ Instructor được cập nhật.
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can update Course.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    // 2. Chuẩn hóa dữ liệu.
    const data: UpdateCourseDto = {
      ...dto,
      name: dto.name.trim(),
      shortDescription: dto.shortDescription?.trim() || null,
      trainingObjectives: dto.trainingObjectives?.trim() || null,
      learningOutcomes: dto.learningOutcomes.map((item) => item.trim()),
    };

    // Không chấp nhận chuỗi chỉ chứa khoảng trắng.
    if (!data.name) {
      throw new BadRequestException('Course name cannot be empty.');
    }

    if (data.learningOutcomes.some((item) => !item)) {
      throw new BadRequestException('Learning outcome cannot be empty.');
    }

    // 3. Cập nhật Course.
    const result = await this.coursesRepository.updateCourse(
      courseId,
      user.organizationId,
      user.userId,
      data,
    );

    // 4. Xử lý lỗi nghiệp vụ.
    switch (result.status) {
      case 'NOT_FOUND':
        throw new NotFoundException('Course not found.');

      case 'NOT_EDITABLE':
        throw new ConflictException(
          'Only Draft or Rejected Course can be edited.',
        );

      case 'INVALID_COVER':
        throw new BadRequestException('Invalid Course cover.');

      case 'CONFLICT':
        throw new ConflictException(
          'Course was modified concurrently. Please retry.',
        );
    }

    // 5. Trả thông tin Course sau cập nhật.
    const course = await this.findDetail(user, courseId);

    return {
      ...course,
      courseTypeChanged: result.courseTypeChanged,
    };
  }

  async updateStructure(
    user: CurrentUser,
    courseId: string,
    dto: UpdateCourseStructureDto,
  ) {
    // 1. Kiểm tra role.
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException(
        'Only Instructor can update Course structure.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    // 2. Chuẩn hóa tiêu đề Module và Lesson.
    const data: UpdateCourseStructureDto = {
      modules: dto.modules.map((module) => ({
        id: module.id,
        title: module.title.trim(),
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title.trim(),
        })),
      })),
    };

    // 3. Không cho phép tiêu đề chỉ chứa khoảng trắng.
    for (const module of data.modules) {
      if (!module.title) {
        throw new BadRequestException('Module title cannot be empty.');
      }

      if (module.lessons.some((lesson) => !lesson.title)) {
        throw new BadRequestException('Lesson title cannot be empty.');
      }
    }

    // 4. Repository kiểm tra ownership,
    // Status, Locked và cập nhật transaction.
    const result = await this.coursesRepository.updateStructure(
      courseId,
      user.organizationId,
      user.userId,
      data,
    );

    switch (result.status) {
      case 'NOT_FOUND':
        throw new NotFoundException('Course not found.');

      case 'SUBMITTED':
        throw new ConflictException(
          'Submitted Course cannot be edited. Withdraw it first.',
        );

      case 'INVALID_STRUCTURE':
        throw new ConflictException(
          'Course structure has changed. Reload and try again.',
        );

      case 'LOCKED':
        throw new ConflictException(
          'Cannot reorder Module or Lesson because Course is Locked.',
        );
    }

    return {
      updated: true,
      titleChanged: result.titleChanged,
      orderChanged: result.orderChanged,
    };
  }
}
