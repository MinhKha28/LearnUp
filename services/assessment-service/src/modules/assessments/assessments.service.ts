import {
  StorageProviderError,
  StorageValidationError,
  type IStorageProvider,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  createPageResponse,
  type CurrentUser,
  type PageResponse,
} from '@learnup/ts-common';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../infrastructure/clients/course/course-service.client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import { RubricsService } from '../rubrics/rubrics.service';
import {
  CreateAssignmentDto,
  PromptFileDto,
} from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Prisma } from 'generated/prisma/browser';

const KIND_ASSIGNMENT = 'ASSIGNMENT';
// BR-320: one prompt file per Assignment, same limits as a submission file. The team has not fixed a number yet,
// so this takes the Reading limit of BR-268 (PDF, 50 MB).
export const PROMPT_FILE_MAX_BYTES = 50 * 1024 * 1024;
const PDF_MIME = 'application/pdf';
const promptFolder = (organizationId: string) =>
  `learnup/${organizationId}/assignments/prompts`;
// Course states in which an Instructor may author (BR-284: Published stays editable until Locked;
// Submitted is frozen for review, Archived/Disabled are terminal or sanctioned). Course Service writes these in Title Case.
export const AUTHORABLE_STATUSES = ['Draft', 'Rejected', 'Published'];

export const assignmentInclude = {
  rubricCriteria: { orderBy: { position: 'asc' as const } },
  _count: { select: { submissions: true } },
};

type AssignmentRow = NonNullable<
  Awaited<ReturnType<AssessmentsService['findAssignmentRow']>>
>;

export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  position: number;
  peerReviewEnabled: boolean;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  locked: boolean;
  disabled: boolean;
}

/** Same shape as the other list endpoints ({ meta, items }) plus the Course-level flags the UI needs. */
export interface AssignmentListPage extends PageResponse<AssignmentSummary> {
  courseLocked: boolean;
  courseStatus: string;
}

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseServiceClient,
    private readonly rubrics: RubricsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  /** UC19.2 / UC19.3 — store the prompt file (BR-320); the returned object goes into `promptFile` of create/update. */
  async uploadPromptFile(
    user: CurrentUser,
    file?: { buffer: Buffer; originalname: string; size: number },
  ): Promise<PromptFileDto> {
    const organizationId = this.requireInstructor(user);
    if (!file) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_REQUIRED',
        message: 'Send one PDF file in the "file" field.',
      });
    }
    if (file.size > PROMPT_FILE_MAX_BYTES) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_TOO_LARGE',
        message: 'The prompt file must be 50 MB or smaller.',
      });
    }
    // The browser-reported type can be anything, so check the PDF signature itself.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException({
        code: 'PROMPT_FILE_NOT_PDF',
        message: 'The prompt file must be a PDF.',
      });
    }
    // multer reads the name as latin1; turn it back into UTF-8 so accented names survive.
    const fileName = Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .split(/[\\/]/)
      .pop()!
      .slice(0, 255);
    try {
      const stored = await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: fileName,
          mimeType: PDF_MIME,
          sizeBytes: file.size,
        },
        {
          folder: promptFolder(organizationId),
          resourceType: 'raw',
          validation: {
            maxSizeBytes: PROMPT_FILE_MAX_BYTES,
            allowedMimeTypes: [PDF_MIME],
          },
        },
      );
      return {
        fileKey: stored.storageKey,
        fileName,
        mimeType: PDF_MIME,
        sizeBytes: stored.sizeBytes,
      };
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException({
          code: 'PROMPT_FILE_INVALID',
          message: error.message,
        });
      }
      if (error instanceof StorageProviderError) {
        this.logger.error(
          `Prompt file upload failed: ${error.message} ${JSON.stringify(error.cause, Object.getOwnPropertyNames(Object(error.cause)))}`,
        );
        throw new ServiceUnavailableException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'Unable to store the prompt file. Try again later.',
        });
      }
      throw error;
    }
  }

  /** UC19.1 — the prompt file of an Assignment the caller manages. */
  async downloadPromptFile(user: CurrentUser, id: string) {
    const { assignment } = await this.findOwnAssignment(user, id);
    if (!assignment.promptFileKey) {
      throw new NotFoundException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'This Assignment has no prompt file.',
      });
    }
    // The file lives in Cloudinary; fetch it here so the browser keeps talking to this service only.
    const response = await fetch(
      this.storage.getUrl(assignment.promptFileKey, 'raw'),
    ).catch(() => null);
    if (!response) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Unable to read the prompt file. Try again later.',
      });
    }
    if (!response.ok) {
      throw new NotFoundException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file is no longer available.',
      });
    }
    const content = Buffer.from(await response.arrayBuffer());
    return {
      content,
      fileName: assignment.promptFileName ?? 'prompt.pdf',
      mimeType: assignment.promptFileMime ?? PDF_MIME,
    };
  }

  /** Only keys of this Organization's prompt folder are accepted (they come from uploadPromptFile); the type is always PDF. */
  private resolvePromptFile(
    organizationId: string,
    file: PromptFileDto,
  ): PromptFileDto {
    if (
      file.fileKey.includes('..') ||
      !file.fileKey.startsWith(`${promptFolder(organizationId)}/`)
    ) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file was not uploaded. Upload it first.',
      });
    }
    if (file.sizeBytes > PROMPT_FILE_MAX_BYTES) {
      throw new BadRequestException({
        code: 'PROMPT_FILE_TOO_LARGE',
        message: 'The prompt file must be 50 MB or smaller.',
      });
    }
    return { ...file, mimeType: PDF_MIME };
  }

  /** UC19.2 — create an Assignment attached to a Course (BR-162). */
  async createAssignment(user: CurrentUser, dto: CreateAssignmentDto) {
    const organizationId = this.requireInstructor(user);

    if (!dto.prompt?.trim() && !dto.promptFile) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_PROMPT_REQUIRED',
        message: 'An Assignment needs a prompt text or one prompt file.',
      });
    }

    const course = await this.requireOwnCourse(user, dto.courseId);
    if (course.disabled || !AUTHORABLE_STATUSES.includes(course.status)) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Assignments cannot be added while the Course is ${course.status}.`,
      });
    }
    // BR-318: no new Assignment once the Course is Locked.
    if (course.locked) {
      throw new ConflictException({
        code: 'COURSE_LOCKED',
        message:
          'The Course is Locked because a Learner has enrolled. Create a new Course version to add an Assignment.',
      });
    }

    const promptFile = dto.promptFile
      ? this.resolvePromptFile(organizationId, dto.promptFile)
      : undefined;
    const settings = await this.prisma.platformSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const maxConsecutiveAttempts =
      dto.maxConsecutiveAttempts ??
      settings?.defaultMaxConsecutiveAttempts ??
      3;
    const lockoutHours =
      dto.lockoutHours ?? settings?.defaultLockoutHours ?? 24;

    const assignment = await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent creates on one Course so two Assignments never get the same position.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.courseId}::text))`;
      // BR-154: Assignments sit at the end of the Course tree, ordered among course-level assessments.
      const last = await tx.assessment.aggregate({
        where: { courseId: dto.courseId, moduleId: null },
        _max: { position: true },
      });

      const created = await tx.assessment.create({
        data: {
          organizationId,
          courseId: dto.courseId,
          kind: KIND_ASSIGNMENT,
          title: dto.title.trim(),
          position: (last._max.position ?? 0) + 1,
          passingScore: dto.passingScore,
          maxConsecutiveAttempts,
          lockoutHours,
          isRequired: true, // BR-165: no optional Assignment
          prompt: dto.prompt?.trim() || null,
          promptFileKey: promptFile?.fileKey,
          promptFileName: promptFile?.fileName,
          promptFileMime: promptFile?.mimeType,
          promptFileSizeBytes: promptFile?.sizeBytes,
          expectedDurationMinutes: dto.expectedDurationMinutes,
          peerReviewEnabled: false, // switched on later via UC19.5
        },
      });
      // BR-164: the Rubric is stored with the Assignment, in the same transaction.
      await this.rubrics.createMany(tx, organizationId, created.id, dto.rubric);
      const withRubric = await tx.assessment.findUniqueOrThrow({
        where: { id: created.id },
        include: assignmentInclude,
      });

      // BR-51 / BR-172: Course Service adds this duration to the Course estimate.
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Assignment',
          aggregateId: created.id,
          eventType: 'AssignmentCreated',
          organizationId,
          occurredAt: new Date(),
          payload: {
            assignmentId: created.id,
            courseId: created.courseId,
            expectedDurationMinutes: dto.expectedDurationMinutes,
          },
        },
      });

      return withRubric;
    });

    return this.toDetail(assignment, course.locked);
  }

  /** UC19 — list the Assignments of a Course. */
  async listAssignments(
    user: CurrentUser,
    courseId: string,
  ): Promise<AssignmentListPage> {
    const organizationId = this.requireInstructor(user);
    const course = await this.requireOwnCourse(user, courseId);

    const rows = await this.prisma.assessment.findMany({
      where: { organizationId, courseId, kind: KIND_ASSIGNMENT },
      orderBy: { position: 'asc' },
      include: { _count: { select: { submissions: true } } },
    });

    const items: AssignmentSummary[] = rows.map((a) => ({
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      position: a.position,
      peerReviewEnabled: a.peerReviewEnabled,
      maxConsecutiveAttempts: a.maxConsecutiveAttempts,
      lockoutHours: a.lockoutHours,
      // BR-98: prompt, Rubric, n and m are frozen once a submission exists.
      locked: a._count.submissions > 0,
      disabled: a.disabledAt !== null,
    }));

    return {
      // A Course holds few Assignments, so everything is returned as a single page.
      ...createPageResponse(items, 1, Math.max(items.length, 1), items.length),
      // BR-318 / BR-99: lets the UI explain why adding an Assignment is blocked.
      courseLocked: course.locked,
      courseStatus: course.status,
    };
  }

  /** UC19.1 — view one Assignment with prompt, Rubric and grading configuration. */
  async getAssignment(user: CurrentUser, id: string) {
    const { assignment, course } = await this.findOwnAssignment(user, id);
    return this.toDetail(assignment, course.locked);
  }

  /** Load an Assignment the caller may manage: Instructor of the Course (BR-79), same tenant. */
  async findOwnAssignment(user: CurrentUser, id: string) {
    const organizationId = this.requireInstructor(user);
    const assignment = await this.findAssignmentRow(organizationId, id);
    if (!assignment) throw new NotFoundException('Assignment not found.');

    const course = await this.requireOwnCourse(user, assignment.courseId);
    return { assignment, course };
  }

  /**
   * UC19.3 — update an Assignment.
   * BR-98: prompt, Rubric, n and m only while there is no submission.
   * BR-319: passing score not once the Course is Locked.
   * BR-173: expected duration is always editable, even when Locked.
   */
  async updateAssignment(
    user: CurrentUser,
    id: string,
    dto: UpdateAssignmentDto,
  ) {
    const organizationId = this.requireInstructor(user);
    const { assignment, course } = await this.findOwnAssignment(user, id);

    // A Submitted, Archived or Disabled Course accepts no edit at all.
    if (course.disabled || !AUTHORABLE_STATUSES.includes(course.status)) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Assignments cannot be changed while the Course is ${course.status}.`,
      });
    }

    const data: Prisma.AssessmentUpdateInput = {};
    const frozenBySubmission: string[] = [];

    if (dto.title !== undefined && dto.title.trim() !== assignment.title) {
      data.title = dto.title.trim();
    }

    const nextPrompt =
      dto.prompt !== undefined ? dto.prompt.trim() || null : assignment.prompt;
    if (nextPrompt !== assignment.prompt) {
      data.prompt = nextPrompt;
      frozenBySubmission.push('prompt');
    }

    let nextFileKey = assignment.promptFileKey;
    if (dto.promptFile !== undefined) {
      const newFile = dto.promptFile
        ? this.resolvePromptFile(organizationId, dto.promptFile)
        : null;
      nextFileKey = newFile?.fileKey ?? null;
      if (nextFileKey !== assignment.promptFileKey) {
        data.promptFileKey = nextFileKey;
        data.promptFileName = newFile?.fileName ?? null;
        data.promptFileMime = newFile?.mimeType ?? null;
        data.promptFileSizeBytes = newFile?.sizeBytes ?? null;
        frozenBySubmission.push('prompt file');
      }
    }
    if (!nextPrompt && !nextFileKey) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_PROMPT_REQUIRED',
        message: 'An Assignment needs a prompt text or one prompt file.',
      });
    }

    if (
      dto.maxConsecutiveAttempts !== undefined &&
      dto.maxConsecutiveAttempts !== assignment.maxConsecutiveAttempts
    ) {
      data.maxConsecutiveAttempts = dto.maxConsecutiveAttempts;
      frozenBySubmission.push('consecutive submissions (n)');
    }
    if (
      dto.lockoutHours !== undefined &&
      dto.lockoutHours !== assignment.lockoutHours
    ) {
      data.lockoutHours = dto.lockoutHours;
      frozenBySubmission.push('temporary lock (m)');
    }

    const rubricKey = (
      list: { name: string; description: string; maxPoints: number }[],
    ) =>
      JSON.stringify(
        list.map((c) => [c.name.trim(), c.description.trim(), c.maxPoints]),
      );
    const rubricChanged =
      dto.rubric !== undefined &&
      rubricKey(dto.rubric) !== rubricKey(assignment.rubricCriteria);
    if (rubricChanged) frozenBySubmission.push('Rubric');

    if (frozenBySubmission.length > 0 && assignment._count.submissions > 0) {
      throw new ConflictException({
        code: 'ASSIGNMENT_HAS_SUBMISSIONS',
        message: `Learners have already submitted, so these cannot be changed: ${frozenBySubmission.join(', ')}.`,
      });
    }

    if (
      dto.passingScore !== undefined &&
      dto.passingScore !== Number(assignment.passingScore)
    ) {
      if (course.locked) {
        throw new ConflictException({
          code: 'PASSING_SCORE_LOCKED',
          message:
            'The passing score cannot be changed because the Course is Locked. Create a new Course version to change it.',
        });
      }
      data.passingScore = dto.passingScore;
    }

    const durationChanged =
      dto.expectedDurationMinutes !== undefined &&
      dto.expectedDurationMinutes !== assignment.expectedDurationMinutes;
    if (durationChanged) {
      data.expectedDurationMinutes = dto.expectedDurationMinutes;
    }

    if (Object.keys(data).length === 0 && !rubricChanged) {
      return this.toDetail(assignment, course.locked);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Re-check under a row lock: a Learner submitting right now must not slip past BR-98.
      const submissions = await this.lockAndCountSubmissions(tx, assignment.id);
      if (frozenBySubmission.length > 0 && submissions > 0) {
        throw new ConflictException({
          code: 'ASSIGNMENT_HAS_SUBMISSIONS',
          message: `Learners have already submitted, so these cannot be changed: ${frozenBySubmission.join(', ')}.`,
        });
      }
      if (Object.keys(data).length > 0) {
        await tx.assessment.update({ where: { id: assignment.id }, data });
      }
      if (rubricChanged && dto.rubric) {
        await this.rubrics.replaceAll(
          tx,
          organizationId,
          assignment.id,
          dto.rubric,
        );
      }
      if (durationChanged) {
        // BR-51 / BR-172: Course Service recomputes the Course estimate from this.
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Assignment',
            aggregateId: assignment.id,
            eventType: 'AssignmentDurationChanged',
            organizationId,
            occurredAt: new Date(),
            payload: {
              assignmentId: assignment.id,
              courseId: assignment.courseId,
              expectedDurationMinutes: dto.expectedDurationMinutes,
              previousExpectedDurationMinutes:
                assignment.expectedDurationMinutes,
            },
          },
        });
      }
      return tx.assessment.findUniqueOrThrow({
        where: { id: assignment.id },
        include: assignmentInclude,
      });
    });

    // The old file is no longer linked: remove it from storage.
    if (assignment.promptFileKey && nextFileKey !== assignment.promptFileKey) {
      await this.removeStoredFile(assignment.promptFileKey, assignment.id);
    }

    return this.toDetail(updated, course.locked);
  }

  /**
   * UC19.4 — delete an Assignment.
   * BR-92: blocked only when the Course is Locked AND the Assignment already has data.
   */
  async deleteAssignment(user: CurrentUser, id: string) {
    const organizationId = this.requireInstructor(user);
    const { assignment, course } = await this.findOwnAssignment(user, id);

    // A Submitted, Archived or Disabled Course accepts no edit at all.
    if (course.disabled || !AUTHORABLE_STATUSES.includes(course.status)) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Assignments cannot be deleted while the Course is ${course.status}.`,
      });
    }
    if (course.locked && assignment._count.submissions > 0) {
      throw new ConflictException({
        code: 'ASSIGNMENT_HAS_DATA',
        message:
          'This Assignment already has submissions and the Course is Locked, so it cannot be deleted.',
      });
    }

    // Rubric, peer review cycles and per-learner counters go with it (ON DELETE CASCADE).
    await this.prisma.$transaction(async (tx) => {
      // Re-check under a row lock: a Learner submitting right now must not slip past BR-92.
      const submissions = await this.lockAndCountSubmissions(tx, assignment.id);
      if (course.locked && submissions > 0) {
        throw new ConflictException({
          code: 'ASSIGNMENT_HAS_DATA',
          message:
            'This Assignment already has submissions and the Course is Locked, so it cannot be deleted.',
        });
      }
      await tx.assessment.delete({ where: { id: assignment.id } });
      // BR-51 / BR-172: Course Service takes this duration out of the Course estimate.
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Assignment',
          aggregateId: assignment.id,
          eventType: 'AssignmentDeleted',
          organizationId,
          occurredAt: new Date(),
          payload: {
            assignmentId: assignment.id,
            courseId: assignment.courseId,
            expectedDurationMinutes: assignment.expectedDurationMinutes,
          },
        },
      });
    });

    if (assignment.promptFileKey) {
      await this.removeStoredFile(assignment.promptFileKey, assignment.id);
    }

    return { id: assignment.id };
  }

  /**
   * Best effort: the row is already gone, so a storage failure is only logged (the file stays as an orphan).
   * A key another Assignment still uses is kept (a new Course version may share the file, BR-100).
   */
  private async removeStoredFile(fileKey: string, exceptId: string) {
    try {
      const others = await this.prisma.assessment.count({
        where: { promptFileKey: fileKey, id: { not: exceptId } },
      });
      if (others === 0) {
        await this.storage.delete(fileKey, { resourceType: 'raw' });
      }
    } catch (error) {
      this.logger.warn(
        `Prompt file ${fileKey} was not removed: ${String(error)}`,
      );
    }
  }

  /**
   * Lock the Assignment row, then count its submissions. Inserting a submission takes a
   * key-share lock on this row (FK), so it waits until we commit, which makes the
   * "no submission yet" checks of BR-98 / BR-92 reliable.
   */
  private async lockAndCountSubmissions(
    tx: Prisma.TransactionClient,
    assessmentId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM assessments WHERE id = ${assessmentId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Assignment not found.');
    return tx.submission.count({ where: { assessmentId } });
  }

  findAssignmentRow(organizationId: string, id: string) {
    return this.prisma.assessment.findFirst({
      where: { id, organizationId, kind: KIND_ASSIGNMENT },
      include: assignmentInclude,
    });
  }

  private requireInstructor(user: CurrentUser): string {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an Instructor can manage Assignments.',
      });
    }
    return user.organizationId;
  }

  /** BR-79 / BR-287: only the Instructor in charge of the chain can see the Course; hide it otherwise. */
  private async requireOwnCourse(
    user: CurrentUser,
    courseId: string,
  ): Promise<CourseAuthoringContext> {
    const course = await this.courses.getAuthoringContext(courseId, user);
    if (
      course.organizationId !== user.organizationId ||
      course.instructorId !== user.userId
    ) {
      throw new NotFoundException('Course not found.');
    }
    return course;
  }

  toDetail(a: AssignmentRow, courseLocked: boolean) {
    return {
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      position: a.position,
      prompt: a.prompt,
      promptFile: a.promptFileKey
        ? {
            fileKey: a.promptFileKey,
            fileName: a.promptFileName,
            mimeType: a.promptFileMime,
            sizeBytes: Number(a.promptFileSizeBytes),
          }
        : null,
      passingScore: Number(a.passingScore),
      expectedDurationMinutes: a.expectedDurationMinutes,
      maxConsecutiveAttempts: a.maxConsecutiveAttempts,
      lockoutHours: a.lockoutHours,
      peerReview: {
        enabled: a.peerReviewEnabled,
        reviewersPerSubmission: a.peerReviewersPerSubmission,
        cycleDays: a.peerReviewCycleDays,
        deadlineDays: a.peerReviewDeadlineDays,
        scoreGap:
          a.peerReviewScoreGap === null ? null : Number(a.peerReviewScoreGap),
      },
      locked: a._count.submissions > 0,
      courseLocked,
      disabled: a.disabledAt !== null,
      rubric: a.rubricCriteria.map((c) => this.rubrics.toResponse(c)),
      createdAt: a.createdAt,
    };
  }
}
