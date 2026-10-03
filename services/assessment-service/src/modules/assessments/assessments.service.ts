import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { RubricsService } from '../rubrics/rubrics.service';
import type { Prisma } from '../../generated/prisma/client';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

const KIND_ASSIGNMENT = 'ASSIGNMENT';
// Course states in which an Instructor may author (BR-284: Published stays editable until Locked;
// Submitted is frozen for review, Archived/Disabled are terminal or sanctioned).
export const AUTHORABLE_STATUSES = ['DRAFT', 'REJECTED', 'PUBLISHED'];

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseServiceClient,
    private readonly rubrics: RubricsService,
  ) {}

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
    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
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
          promptFileKey: dto.promptFile?.fileKey,
          promptFileName: dto.promptFile?.fileName,
          promptFileMime: dto.promptFile?.mimeType,
          promptFileSizeBytes: dto.promptFile?.sizeBytes,
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
    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
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
      nextFileKey = dto.promptFile?.fileKey ?? null;
      if (nextFileKey !== assignment.promptFileKey) {
        data.promptFileKey = nextFileKey;
        data.promptFileName = dto.promptFile?.fileName ?? null;
        data.promptFileMime = dto.promptFile?.mimeType ?? null;
        data.promptFileSizeBytes = dto.promptFile?.sizeBytes ?? null;
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
    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
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

    return { id: assignment.id };
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
