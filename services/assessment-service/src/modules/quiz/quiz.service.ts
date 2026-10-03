import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPageResponse, type CurrentUser } from '@learnup/ts-common';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../infrastructure/clients/course/course-service.client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ListQuizzesQueryDto } from './dto/list-quizzes-query.dto';
import {
  QUIZ_KIND,
  QuizListPage,
  QuizLockReason,
  QuizSummary,
} from './interfaces/quiz-list.interface';

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
      include: {
        _count: { select: { questions: true, quizAttempts: true } },
      },
    });

    // Course-level reasons are the same for every Quiz of the Course.
    const courseReasons: QuizLockReason[] = [];
    if (course.locked) courseReasons.push('COURSE_LOCKED'); // BR-94
    // BR-285. Course Service writes 'SUBMITTED' while its seed and fake client use 'Submitted'.
    if (course.status.toUpperCase() === 'SUBMITTED') {
      courseReasons.push('COURSE_SUBMITTED');
    }

    const items: QuizSummary[] = rows.map((q) => {
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
    });

    return {
      // A Course holds few Quizzes, so everything is returned as a single page.
      ...createPageResponse(items, 1, Math.max(items.length, 1), items.length),
      // BR-99: lets the UI explain why the Quizzes cannot be edited.
      courseLocked: course.locked,
      courseStatus: course.status,
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
