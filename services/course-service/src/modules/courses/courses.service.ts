import {
  COURSE_COVER_MAX_SIZE_BYTES,
  COURSE_COVER_MIME_TYPES,
  COURSE_STATUS,
  READING_UPLOAD_BUFFER_MAX_BYTES,
  VIDEO_UPLOAD_BUFFER_MAX_BYTES,
} from './course-values';
import { CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
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
import { UpdateLessonContentDto } from './dto/update-lesson-content.dto';
import { CreateVideoMaterialDto } from './dto/create-video-material.dto';
import { CreateReadingMaterialDto } from './dto/create-reading-material.dto';
import { extractReadingText } from './reading-text-extractor';

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

  async findLessonDetail(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ) {
    // 1. Phân quyền Instructor.
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only Instructor can view Lesson details.');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    // 2. Đọc Lesson và các học liệu.
    const detail = await this.coursesRepository.findLessonDetail(
      courseId,
      lessonId,
      user.organizationId,
      user.userId,
    );

    if (!detail) {
      throw new NotFoundException('Lesson not found.');
    }

    // 3. Tách dữ liệu để tạo response rõ ràng.
    const { module, materials, ...lesson } = detail;

    return {
      course: {
        id: module.course.id,
        name: module.course.name,
        status: module.course.status,
        locked: module.course.lockedAt !== null,
      },

      module: {
        id: module.id,
        title: module.title,
        position: module.position,
      },

      lesson: {
        ...lesson,
        required: materials.some((material) => material.isRequired),
      },

      materials: materials.map(({ file, ...material }) => ({
        ...material,
        file: {
          originalFilename: file.originalFilename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes.toString(),
          durationSeconds: file.durationSeconds,
          wordCount: file.wordCount,
          status: file.status,
          releasedAt: file.releasedAt,
        },
      })),
    };
  }

  private async checkLessonContentAccess(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ) {
    // 1. Phân quyền.
    if (user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException(
        'Only Instructor can update Lesson content.',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }

    // 2. Tìm Lesson và xác minh Course ownership.
    const lesson = await this.coursesRepository.findLessonForContentUpdate(
      courseId,
      lessonId,
      user.organizationId,
      user.userId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    // 3. Không biên tập trong lúc chờ phê duyệt.
    if (lesson.module.course.status === COURSE_STATUS.SUBMITTED) {
      return {
        lesson,
        reason: 'SUBMITTED' as const,
      };
    }

    // 4. Hỏi Learning Service.
    const hasCompleted = await this.learningClient.hasAnyLearnerCompletedLesson(
      user,
      courseId,
      lessonId,
    );

    return {
      lesson,
      reason: hasCompleted ? ('COMPLETED' as const) : null,
    };
  }

  async getLessonContentEditability(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ) {
    const access = await this.checkLessonContentAccess(
      user,
      courseId,
      lessonId,
    );

    return {
      canEdit: access.reason === null,
      reason: access.reason,
    };
  }

  async updateLessonContent(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
    dto: UpdateLessonContentDto,
  ) {
    // Luôn kiểm tra lại khi nhấn Save.
    const access = await this.checkLessonContentAccess(
      user,
      courseId,
      lessonId,
    );

    if (access.reason === 'SUBMITTED') {
      throw new ConflictException(
        'Submitted Course cannot be edited. Withdraw it first.',
      );
    }

    if (access.reason === 'COMPLETED') {
      throw new ConflictException(
        'Lesson content cannot be changed because at least one Learner has completed this Lesson.',
      );
    }

    // Không thực hiện UPDATE khi nội dung không thay đổi.
    if (access.lesson.content === dto.content) {
      return {
        id: lessonId,
        content: access.lesson.content,
      };
    }

    const updated = await this.coursesRepository.updateLessonContent(
      courseId,
      lessonId,
      user.organizationId!,
      user.userId,
      dto.content,
      access.lesson.updatedAt,
    );

    if (!updated) {
      throw new ConflictException(
        'Lesson was modified concurrently. Reload and try again.',
      );
    }

    return {
      id: lessonId,
      content: dto.content,
    };
  }

  async getVideoUploadContext(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ) {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException('Only Instructor can add Video materials.');
    }

    const lesson = await this.coursesRepository.findLessonForMaterialUpload(
      courseId,
      lessonId,
      user.organizationId,
      user.userId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    const [settings, policy, usedBytes] = await Promise.all([
      this.coursesRepository.getVideoSettings(),

      this.tenantClient.getInstructorMaterialUploadPolicy(user),

      this.coursesRepository.getOrganizationStoredBytes(user.organizationId),
    ]);

    if (!settings) {
      throw new ServiceUnavailableException(
        'Platform Video settings are unavailable.',
      );
    }

    const course = lesson.module.course;

    const courseBlocked =
      course.status === COURSE_STATUS.SUBMITTED ||
      course.disabledAt !== null ||
      lesson.disabledAt !== null;

    const maxTransportBytes = BigInt(VIDEO_UPLOAD_BUFFER_MAX_BYTES);

    const effectiveMaxBytes =
      settings.maxVideoSizeBytes < maxTransportBytes
        ? settings.maxVideoSizeBytes
        : maxTransportBytes;

    const storageLimit = BigInt(policy.maxStorageBytes);

    const remainingBytes =
      storageLimit > usedBytes ? storageLimit - usedBytes : 0n;

    return {
      courseName: course.name,
      lessonTitle: lesson.title,
      locked: course.lockedAt !== null,

      subscriptionStatus: policy.subscriptionStatus,
      canUpload: policy.canUpload && !courseBlocked,

      blockReason: courseBlocked ? 'COURSE_NOT_EDITABLE' : policy.reason,

      maxVideoSizeBytes: effectiveMaxBytes.toString(),
      maxVideoDurationMinutes: settings.maxVideoDurationMinutes,
      allowedVideoMimeTypes: settings.allowedVideoMimeTypes,

      maxStorageBytes: policy.maxStorageBytes,
      usedStorageBytes: usedBytes.toString(),
      remainingStorageBytes: remainingBytes.toString(),
    };
  }

  private validateVideoSignature(file: Express.Multer.File): string {
    const buffer = file.buffer;

    // Container MP4/MOV thường có box 'ftyp' tại byte 4.
    const isIsoMedia =
      buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';

    // WebM bắt đầu bằng EBML magic bytes.
    const isWebm =
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3;

    switch (file.mimetype) {
      case 'video/mp4':
        if (isIsoMedia) return 'mp4';
        break;

      case 'video/webm':
        if (isWebm) return 'webm';
        break;

      case 'video/quicktime':
        if (isIsoMedia) return 'mov';
        break;
    }

    throw new BadRequestException('Invalid or unsupported Video file format.');
  }

  async uploadVideoMaterial(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
    dto: CreateVideoMaterialDto,
    file?: Express.Multer.File,
  ) {
    // 1. Phân quyền.
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException('Only Instructor can add Video materials.');
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Video file is required.');
    }

    const organizationId = user.organizationId;
    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Video title cannot be empty.');
    }

    if (file.originalname.length > 255) {
      throw new BadRequestException('Original Video filename is too long.');
    }

    // 2. Kiểm tra Lesson / Course / BR-286.
    const lesson = await this.coursesRepository.findLessonForMaterialUpload(
      courseId,
      lessonId,
      organizationId,
      user.userId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    const course = lesson.module.course;

    if (course.status === COURSE_STATUS.SUBMITTED) {
      throw new ConflictException('Submitted Course cannot be edited.');
    }

    if (course.disabledAt !== null || lesson.disabledAt !== null) {
      throw new ConflictException(
        'Disabled Course or Lesson cannot receive materials.',
      );
    }

    if (course.lockedAt !== null && dto.isRequired) {
      throw new ConflictException(
        'BR-286: Locked Course only accepts Optional materials.',
      );
    }

    // 3. Lấy giới hạn Video từ Platform Settings.
    const settings = await this.coursesRepository.getVideoSettings();

    if (!settings) {
      throw new ServiceUnavailableException(
        'Platform Video settings are unavailable.',
      );
    }

    const effectiveMaxBytes =
      settings.maxVideoSizeBytes < BigInt(VIDEO_UPLOAD_BUFFER_MAX_BYTES)
        ? settings.maxVideoSizeBytes
        : BigInt(VIDEO_UPLOAD_BUFFER_MAX_BYTES);

    if (file.size <= 0 || !Number.isSafeInteger(file.size)) {
      throw new BadRequestException('Invalid Video size.');
    }

    if (BigInt(file.size) > effectiveMaxBytes) {
      throw new PayloadTooLargeException(
        'Video exceeds the allowed size limit.',
      );
    }

    if (!settings.allowedVideoMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Video MIME type is not allowed.');
    }

    // Kiểm tra nội dung file, không chỉ tin MIME.
    const expectedFormat = this.validateVideoSignature(file);

    // 4. Kiểm tra Subscription: chỉ Active còn hạn.
    const policy =
      await this.tenantClient.getInstructorMaterialUploadPolicy(user);

    if (!policy.canUpload) {
      throw new ForbiddenException(
        policy.reason === 'SUBSCRIPTION_GRACE'
          ? 'Video uploads are blocked during Subscription Grace.'
          : policy.reason === 'SUBSCRIPTION_SUSPENDED'
            ? 'Video uploads are blocked while Subscription is Suspended.'
            : 'Subscription does not allow Video uploads.',
      );
    }

    // 5. Kiểm tra quota trước khi gửi Cloudinary.
    const usedBytes =
      await this.coursesRepository.getOrganizationStoredBytes(organizationId);

    if (usedBytes + BigInt(file.size) > BigInt(policy.maxStorageBytes)) {
      throw new ConflictException('Insufficient Subscription storage.');
    }

    let storedFile: IStoredFile | null = null;
    let committed = false;

    try {
      // 6. Upload Buffer qua @learnup/ts-storage.
      // Provider đã được chỉnh chunked upload cho Video.
      storedFile = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        {
          folder: `learnup/${organizationId}/courses/videos`,
          resourceType: 'video',
          validation: {
            maxSizeBytes: Number(effectiveMaxBytes),
            allowedMimeTypes: settings.allowedVideoMimeTypes,
          },
        },
      );

      // 7. Kiểm tra metadata do Cloudinary trả về.
      const duration = storedFile.durationSeconds;

      if (
        storedFile.resourceType !== 'video' ||
        storedFile.format?.toLowerCase() !== expectedFormat ||
        duration === undefined ||
        !Number.isInteger(duration) ||
        duration <= 0
      ) {
        throw new BadRequestException(
          'Invalid Video metadata returned by Cloudinary.',
        );
      }

      if (duration > settings.maxVideoDurationMinutes * 60) {
        throw new BadRequestException(
          'Video exceeds maximum allowed duration.',
        );
      }

      if (
        BigInt(storedFile.sizeBytes) > effectiveMaxBytes ||
        storedFile.sizeBytes <= 0
      ) {
        throw new PayloadTooLargeException(
          'Uploaded Video exceeds allowed size.',
        );
      }

      // 8. Kiểm tra lại Subscription trước khi lưu.
      const latestPolicy =
        await this.tenantClient.getInstructorMaterialUploadPolicy(user);

      if (!latestPolicy.canUpload) {
        throw new ForbiddenException(
          'Subscription no longer allows Video uploads.',
        );
      }

      // 9. Transaction: kiểm tra Locked/quota và lưu.
      const result = await this.coursesRepository.createVideoMaterialWithQuota({
        organizationId,
        instructorId: user.userId,
        courseId,
        lessonId,
        title,
        isRequired: dto.isRequired,
        maxStorageBytes: BigInt(latestPolicy.maxStorageBytes),
        file: {
          storageKey: storedFile.storageKey,
          originalFilename: storedFile.originalFilename,
          mimeType: storedFile.mimeType,
          sizeBytes: storedFile.sizeBytes,
          durationSeconds: duration,
        },
      });

      switch (result.status) {
        case 'NOT_FOUND':
          throw new NotFoundException('Lesson not found.');

        case 'SUBMITTED':
          throw new ConflictException('Submitted Course cannot be edited.');

        case 'DISABLED':
          throw new ConflictException(
            'Disabled Course or Lesson cannot receive materials.',
          );

        case 'LOCKED_REQUIRED':
          throw new ConflictException(
            'BR-286: Only Optional materials are allowed.',
          );

        case 'QUOTA_EXCEEDED':
          throw new ConflictException('Insufficient Subscription storage.');

        case 'CREATED':
          // Database transaction đã commit thành công.
          committed = true;

          return {
            ...result.material,
            sizeBytes: String(storedFile.sizeBytes),
            durationSeconds: duration,
          };
      }
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof StorageProviderError) {
        throw new ServiceUnavailableException(
          'Unable to upload Video to Cloudinary.',
        );
      }

      throw error;
    } finally {
      // Cloudinary không nằm trong transaction PostgreSQL.
      // Nếu DB hoặc validation sau upload thất bại,
      // xóa file Cloudinary để bù trừ.
      if (storedFile && !committed) {
        try {
          await this.storage.delete(storedFile.storageKey, {
            resourceType: storedFile.resourceType,
          });
        } catch (cleanupError) {
          console.error('Unable to clean up uploaded Video:', cleanupError);
        }
      }
    }
  }

  async getReadingUploadContext(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ) {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException(
        'Only Instructor can upload Reading materials.',
      );
    }

    const lesson = await this.coursesRepository.findLessonForMaterialUpload(
      courseId,
      lessonId,
      user.organizationId,
      user.userId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    const [settings, policy, usedBytes] = await Promise.all([
      this.coursesRepository.getReadingSettings(),
      this.tenantClient.getInstructorMaterialUploadPolicy(user),
      this.coursesRepository.getOrganizationStoredBytes(user.organizationId),
    ]);

    if (!settings) {
      throw new ServiceUnavailableException(
        'Reading settings are unavailable.',
      );
    }

    const course = lesson.module.course;

    const courseBlocked =
      !['Draft', 'Rejected', 'Published'].includes(course.status) ||
      course.disabledAt !== null ||
      lesson.disabledAt !== null;

    const configuredSize = settings.maxReadingSizeBytes;

    const bufferLimit = BigInt(READING_UPLOAD_BUFFER_MAX_BYTES);

    const effectiveMaxBytes =
      configuredSize < bufferLimit ? configuredSize : bufferLimit;

    const storageLimit = BigInt(policy.maxStorageBytes);

    const remainingBytes =
      storageLimit > usedBytes ? storageLimit - usedBytes : 0n;

    return {
      courseName: course.name,
      lessonTitle: lesson.title,
      locked: course.lockedAt !== null,

      subscriptionStatus: policy.subscriptionStatus,
      canUpload: policy.canUpload && !courseBlocked,
      blockReason: courseBlocked ? 'COURSE_NOT_EDITABLE' : policy.reason,

      maxReadingSizeBytes: effectiveMaxBytes.toString(),
      allowedReadingMimeTypes: settings.allowedReadingMimeTypes.filter(
        (mime) => mime === 'application/pdf',
      ),
      remainingStorageBytes: remainingBytes.toString(),
      readingSpeedWordsPerMinute: settings.readingSpeedWordsPerMinute,
    };
  }

  async uploadReadingMaterial(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
    dto: CreateReadingMaterialDto,
    file?: Express.Multer.File,
  ) {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException(
        'Only Instructor can upload Reading materials.',
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Reading PDF file is required.');
    }

    const organizationId = user.organizationId;
    const title = dto.title.trim();

    if (!title || title.length > 200) {
      throw new BadRequestException('Invalid Reading title.');
    }

    if (file.originalname.length > 255) {
      throw new BadRequestException('Reading filename is too long.');
    }

    // 1. Kiểm tra quyền sở hữu và Locked.
    const lesson = await this.coursesRepository.findLessonForMaterialUpload(
      courseId,
      lessonId,
      organizationId,
      user.userId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    const course = lesson.module.course;

    if (
      !['Draft', 'Rejected', 'Published'].includes(course.status) ||
      course.disabledAt !== null ||
      lesson.disabledAt !== null
    ) {
      throw new ConflictException('Course or Lesson cannot be edited.');
    }

    if (course.lockedAt !== null && dto.isRequired) {
      throw new ConflictException(
        'BR-286: Locked Course only accepts Optional materials.',
      );
    }

    // 2. Lấy cấu hình.
    const settings = await this.coursesRepository.getReadingSettings();

    if (!settings) {
      throw new ServiceUnavailableException(
        'Reading settings are unavailable.',
      );
    }

    const transportLimit = BigInt(READING_UPLOAD_BUFFER_MAX_BYTES);

    const maxBytes =
      settings.maxReadingSizeBytes < transportLimit
        ? settings.maxReadingSizeBytes
        : transportLimit;

    if (file.size <= 0 || !Number.isSafeInteger(file.size)) {
      throw new BadRequestException('Invalid file size.');
    }

    if (BigInt(file.size) > maxBytes) {
      throw new PayloadTooLargeException('Reading exceeds the allowed size.');
    }

    if (
      file.mimetype !== 'application/pdf' ||
      !settings.allowedReadingMimeTypes.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Only configured PDF Reading files are supported.',
      );
    }

    // Không tin hoàn toàn MIME của browser.
    if (
      file.buffer.length < 8 ||
      file.buffer.toString('ascii', 0, 5) !== '%PDF-'
    ) {
      throw new BadRequestException('Invalid PDF file signature.');
    }

    // 3. Kiểm tra Subscription.
    const policy =
      await this.tenantClient.getInstructorMaterialUploadPolicy(user);

    if (!policy.canUpload) {
      throw new ForbiddenException(
        'Subscription does not allow Reading uploads.',
      );
    }

    const usedBytes =
      await this.coursesRepository.getOrganizationStoredBytes(organizationId);

    if (usedBytes + BigInt(file.size) > BigInt(policy.maxStorageBytes)) {
      throw new ConflictException('Insufficient Subscription storage.');
    }

    // 4. Trích xuất số từ trước khi upload.
    let extraction: Awaited<ReturnType<typeof extractReadingText>>;

    try {
      extraction = await extractReadingText(file.buffer);
    } catch {
      throw new BadRequestException(
        'Unable to read PDF. The file may be corrupted or password-protected.',
      );
    }

    // 5. Upload Cloudinary.
    let storedFile: IStoredFile | null = null;
    let committed = false;

    try {
      storedFile = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        {
          folder: `learnup/${organizationId}/courses/readings`,
          resourceType: 'raw',
          validation: {
            maxSizeBytes: Number(maxBytes),
            allowedMimeTypes: ['application/pdf'],
          },
        },
      );

      if (
        storedFile.sizeBytes <= 0 ||
        BigInt(storedFile.sizeBytes) > maxBytes
      ) {
        throw new BadRequestException('Invalid uploaded Reading size.');
      }

      // 6. Kiểm tra Subscription lần cuối.
      const latestPolicy =
        await this.tenantClient.getInstructorMaterialUploadPolicy(user);

      if (!latestPolicy.canUpload) {
        throw new ForbiddenException('Subscription no longer allows uploads.');
      }

      // 7. Lưu transaction.
      const result =
        await this.coursesRepository.createReadingMaterialWithQuota({
          organizationId,
          instructorId: user.userId,
          courseId,
          lessonId,
          title,
          isRequired: dto.isRequired,
          maxStorageBytes: BigInt(latestPolicy.maxStorageBytes),
          file: {
            storageKey: storedFile.storageKey,
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: storedFile.sizeBytes,
            wordCount: extraction.wordCount,
          },
        });

      switch (result.status) {
        case 'NOT_FOUND':
          throw new NotFoundException('Lesson not found.');

        case 'SUBMITTED':
        case 'NOT_EDITABLE':
          throw new ConflictException('Course or Lesson cannot be edited.');

        case 'LOCKED_REQUIRED':
          throw new ConflictException(
            'BR-286: Only Optional materials are allowed.',
          );

        case 'QUOTA_EXCEEDED':
          throw new ConflictException('Insufficient Subscription storage.');

        case 'CREATED':
          committed = true;

          return {
            ...result.material,
            sizeBytes: String(storedFile.sizeBytes),
            wordCount: extraction.wordCount,
            extractionWarning: extraction.extractionWarning,
          };
      }
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof StorageProviderError) {
        throw new ServiceUnavailableException(
          'Unable to upload Reading to Cloudinary.',
        );
      }

      throw error;
    } finally {
      // DB và Cloudinary không cùng transaction.
      if (storedFile && !committed) {
        try {
          await this.storage.delete(storedFile.storageKey, {
            resourceType: storedFile.resourceType,
          });
        } catch (error) {
          console.error('Reading cleanup failed:', error);
        }
      }
    }
  }
}
