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
import { QuizDetail } from './interfaces/quiz-detail.interface';
import {
  QUIZ_KIND,
  QuizListPage,
  QuizSummary,
} from './interfaces/quiz-list.interface';
import { computeQuizPermissions } from './quiz-permissions';

/** What a list row needs besides the columns: question and attempt counts in the same query (no N+1). */
const quizSummaryInclude = {
  _count: { select: { questions: true, quizAttempts: true } },
} satisfies Prisma.AssessmentInclude;

type QuizSummaryRow = Prisma.AssessmentGetPayload<{
  include: typeof quizSummaryInclude;
}>;

/** UC18.1: the counts plus every question and its options, both in display order. */
const quizDetailInclude = {
  ...quizSummaryInclude,
  questions: {
    orderBy: { position: 'asc' },
    include: { options: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.AssessmentInclude;

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

    const items = rows.map((q) => this.toSummary(q, course));

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
      !AUTHORABLE_STATUSES.includes(course.status)
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

    return this.toSummary(quiz, course);
  }

  /**
   * UC18.1 — one Quiz with configuration, placement, questions, answer keys and what may be changed now (BR-99).
   * Instructor only: the answer keys must never reach a Learner.
   */
  async getQuiz(user: CurrentUser, id: string): Promise<QuizDetail> {
    const organizationId = this.requireInstructor(user);
    const quiz = await this.prisma.assessment.findFirst({
      where: { id, organizationId, kind: QUIZ_KIND },
      include: quizDetailInclude,
    });
    if (!quiz) throw this.quizNotFound();

    // BR-79 / BR-287: a Quiz of another Instructor's Course, or of a Course Course Service no longer knows,
    // looks exactly like a missing one. Course Service being down stays a 503 (BR-78: no local copy to fall back on).
    let course: CourseAuthoringContext;
    try {
      course = await this.requireOwnCourse(user, quiz.courseId);
    } catch (error) {
      if (error instanceof NotFoundException) throw this.quizNotFound();
      throw error;
    }

    const { permissions } = computeQuizPermissions(
      course,
      quiz._count.quizAttempts > 0,
    );
    return {
      ...this.toSummary(quiz, course),
      placement: quiz.moduleId ? 'MODULE' : 'COURSE',
      courseStatus: course.status,
      courseLocked: course.locked,
      permissions,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        position: question.position,
        type: question.questionType,
        content: question.content,
        options: question.options.map((option) => ({
          id: option.id,
          position: option.position,
          content: option.content,
          isCorrect: option.isCorrect,
        })),
      })),
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    };
  }

  private quizNotFound() {
    return new NotFoundException({
      code: 'QUIZ_NOT_FOUND',
      message: 'Quiz not found.',
    });
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
      !AUTHORABLE_STATUSES.includes(course.status)
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

  private toSummary(
    q: QuizSummaryRow,
    course: CourseAuthoringContext,
  ): QuizSummary {
    const hasAttempts = q._count.quizAttempts > 0;
    // BR-99: attempts (BR-96, BR-97), Locked (BR-94) and Submitted (BR-285); same list as before UC18.1.
    const { lockReasons } = computeQuizPermissions(course, hasAttempts);
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
