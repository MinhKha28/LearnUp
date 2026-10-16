import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPageResponse, type CurrentUser } from '@learnup/ts-common';
import type { Prisma } from 'generated/prisma/browser';
import { AUTHORABLE_STATUSES } from '../assessments/assessments.service';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../infrastructure/clients/course/course-service.client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { ListQuizzesQueryDto } from './dto/list-quizzes-query.dto';
import {
  QUIZ_KIND,
  QuizListPage,
  QuizLockReason,
  QuizSummary,
} from './interfaces/quiz-list.interface';

/** What a list row needs besides the columns: question and attempt counts in the same query (no N+1). */
const quizSummaryInclude = {
  _count: { select: { questions: true, quizAttempts: true } },
} satisfies Prisma.AssessmentInclude;

type QuizSummaryRow = Prisma.AssessmentGetPayload<{
  include: typeof quizSummaryInclude;
}>;

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseServiceClient,
  ) {}

  /** UC18 — list the Quizzes of a Course, optionally of one Module. */
  async listQuizzes(
    user: CurrentUser,
    query: ListQuizzesQueryDto,
  ): Promise<QuizListPage> {
    const organizationId = this.requireInstructor(user);
    const course = await this.requireOwnCourse(user, query.courseId);

    // moduleId is only a filter here; Course Service is not asked whether the Module belongs to the Course.
    const rows = await this.prisma.assessment.findMany({
      where: {
        organizationId,
        courseId: query.courseId,
        kind: QUIZ_KIND,
        ...(query.moduleId ? { moduleId: query.moduleId } : {}),
      },
      // BR-291: Module-level Quizzes first, Course-level ones (moduleId null) last; position within one place.
      orderBy: [
        { moduleId: { sort: 'asc', nulls: 'last' } },
        { position: 'asc' },
        { id: 'asc' },
      ],
      include: quizSummaryInclude,
    });

    // Course-level reasons are the same for every Quiz of the Course.
    const courseReasons = this.courseLockReasons(course);
    const items = rows.map((q) => this.toSummary(q, courseReasons));

    return {
      // A Course holds few Quizzes, so everything is returned as a single page.
      ...createPageResponse(items, 1, Math.max(items.length, 1), items.length),
      // BR-99: lets the UI explain why the Quizzes cannot be edited.
      courseLocked: course.locked,
      courseStatus: course.status,
    };
  }

  /** UC18.2 — create a Quiz attached to a Module or to the Course (BR-154, BR-156). */
  async createQuiz(
    user: CurrentUser,
    dto: CreateQuizDto,
  ): Promise<QuizSummary> {
    const organizationId = this.requireInstructor(user);
    const course = await this.requireOwnCourse(user, dto.courseId);

    // BR-285 / BR-69 / BR-284: only Draft, Rejected and not-yet-Locked Published Courses are authorable.
    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Quizzes cannot be added while the Course is ${course.status}.`,
      });
    }
    // BR-318: once Locked, only an optional Quiz can be added (unlike Assignments, which are blocked).
    if (course.locked && dto.isRequired) {
      throw new ConflictException({
        code: 'REQUIRED_QUIZ_ON_LOCKED_COURSE',
        message:
          'The Course is Locked because a Learner has enrolled, so only an optional Quiz can be added.',
      });
    }

    const moduleId = dto.moduleId ?? null;
    if (moduleId) {
      // null = the fake client does not know the Module tree and accepts any moduleId.
      const moduleIds = await this.courses.getModuleIds(dto.courseId, user);
      if (moduleIds && !moduleIds.includes(moduleId)) {
        throw new BadRequestException({
          code: 'MODULE_NOT_IN_COURSE',
          message: 'The selected Module does not belong to this Course.',
        });
      }
    }

    // BR-175 / BR-269: copy the platform defaults at creation time (same read as createAssignment).
    const settings = await this.prisma.platformSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const maxConsecutiveAttempts =
      dto.maxConsecutiveAttempts ??
      settings?.defaultMaxConsecutiveAttempts ??
      3;
    const lockoutHours =
      dto.lockoutHours ?? settings?.defaultLockoutHours ?? 24;

    const quiz = await this.prisma.$transaction(async (tx) => {
      // Same lock expression as createAssignment, so Quiz and Assignment creates on one Course serialise.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.courseId}::text))`;
      // BR-291 / BR-318: Quizzes and Assignments share the order of one place; a new one goes last.
      const last = await tx.assessment.aggregate({
        where: { courseId: dto.courseId, moduleId },
        _max: { position: true },
      });

      return tx.assessment.create({
        data: {
          organizationId,
          courseId: dto.courseId,
          moduleId,
          kind: QUIZ_KIND,
          title: dto.title,
          position: (last._max.position ?? 0) + 1,
          passingScore: dto.passingScore,
          maxConsecutiveAttempts,
          lockoutHours,
          isRequired: dto.isRequired,
          timeLimitMinutes: dto.timeLimitMinutes,
          peerReviewEnabled: false, // Quiz: no prompt, no peer review
        },
        include: quizSummaryInclude,
      });
    });
    // BR-52: a Quiz time limit is not part of the Course duration, so no outbox event.

    return this.toSummary(quiz, this.courseLockReasons(course));
  }

  /**
   * UC18.5 — delete a Quiz.
   * BR-92: blocked only when the Course is Locked AND the Quiz already has attempts.
   */
  async deleteQuiz(user: CurrentUser, id: string): Promise<{ id: string }> {
    const organizationId = this.requireInstructor(user);
    const quiz = await this.prisma.assessment.findFirst({
      where: { id, organizationId, kind: QUIZ_KIND },
      include: quizSummaryInclude,
    });
    if (!quiz) throw new NotFoundException('Quiz not found.');
    const course = await this.requireOwnCourse(user, quiz.courseId);

    // BR-285: a Submitted, Archived or Disabled Course accepts no edit at all.
    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Quizzes cannot be deleted while the Course is ${course.status}.`,
      });
    }
    if (course.locked && quiz._count.quizAttempts > 0) {
      throw this.hasDataError();
    }

    // Questions, options, attempts and per-learner counters go with it (ON DELETE CASCADE); their answers are removed by hand.
    await this.prisma.$transaction(async (tx) => {
      // Re-check under a row lock: a Learner starting the Quiz right now must not slip past BR-92.
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM assessments WHERE id = ${quiz.id}::uuid FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException('Quiz not found.');
      const attempts = await tx.quizAttempt.count({
        where: { assessmentId: quiz.id },
      });
      if (course.locked && attempts > 0) throw this.hasDataError();
      // Answers point at questions without a cascade (quiz_attempt_answers.question_id), so they go first.
      await tx.quizAttemptAnswer.deleteMany({
        where: { attempt: { assessmentId: quiz.id } },
      });
      await tx.assessment.delete({ where: { id: quiz.id } });
    });
    // BR-52: a Quiz time limit is not part of the Course duration, so no outbox event (same as create).

    return { id: quiz.id };
  }

  private hasDataError() {
    return new ConflictException({
      code: 'QUIZ_HAS_DATA',
      message:
        'This Quiz already has attempts and the Course is Locked, so it cannot be deleted.',
    });
  }

  /** Reasons that come from the Course and apply to every Quiz in it (BR-99). */
  private courseLockReasons(course: CourseAuthoringContext): QuizLockReason[] {
    const reasons: QuizLockReason[] = [];
    if (course.locked) reasons.push('COURSE_LOCKED'); // BR-94
    // BR-285. Course Service writes 'SUBMITTED' while its seed and fake client use 'Submitted'.
    if (course.status.toUpperCase() === 'SUBMITTED') {
      reasons.push('COURSE_SUBMITTED');
    }
    return reasons;
  }

  private toSummary(
    q: QuizSummaryRow,
    courseReasons: QuizLockReason[],
  ): QuizSummary {
    const hasAttempts = q._count.quizAttempts > 0;
    // BR-96 / BR-97: questions, time limit, n and m are frozen once a Learner has started the Quiz.
    const lockReasons: QuizLockReason[] = hasAttempts
      ? ['QUIZ_HAS_ATTEMPTS', ...courseReasons]
      : [...courseReasons];
    return {
      id: q.id,
      courseId: q.courseId,
      moduleId: q.moduleId,
      title: q.title,
      position: q.position,
      questionCount: q._count.questions,
      passingScore: Number(q.passingScore),
      isRequired: q.isRequired,
      timeLimitMinutes: q.timeLimitMinutes,
      maxConsecutiveAttempts: q.maxConsecutiveAttempts,
      lockoutHours: q.lockoutHours,
      hasAttempts,
      locked: lockReasons.length > 0,
      lockReasons,
      disabled: q.disabledAt !== null,
    };
  }

  // Trùng với AssessmentsService, nên tách dùng chung sau.
  private requireInstructor(user: CurrentUser): string {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an Instructor can manage Quizzes.',
      });
    }
    return user.organizationId;
  }

  // Trùng với AssessmentsService, nên tách dùng chung sau.
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
}
