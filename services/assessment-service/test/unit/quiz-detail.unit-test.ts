/**
 * UC18.1 (view Quiz detail): the permission matrix of BR-99 as a pure function, the detail answer with Prisma and
 * Course Service replaced by fakes, and the guarantee that the UC18 list reasons did not change.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../src/infrastructure/clients/course/course-service.client';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { QuizPermissions } from '../../src/modules/quiz/interfaces/quiz-detail.interface';
import type { QuizLockReason } from '../../src/modules/quiz/interfaces/quiz-list.interface';
import { computeQuizPermissions } from '../../src/modules/quiz/quiz-permissions';
import { QuizService } from '../../src/modules/quiz/quiz.service';
import {
  asRole,
  COURSE,
  draftCourse,
  instructor,
  ORG,
  OTHER_INSTRUCTOR,
  rejectsWith,
} from './fixtures';

const QUIZ = '00000000-0000-4000-8000-0000000000b1';
const MODULE = '00000000-0000-4000-8000-0000000000e1';

type Course = Pick<CourseAuthoringContext, 'status' | 'locked' | 'disabled'>;
const course = (over: Partial<Course> = {}): Course => ({
  status: 'Draft',
  locked: false,
  disabled: false,
  ...over,
});

/** The UC18 list reasons exactly as QuizService computed them before UC18.1. */
function legacyLockReasons(c: Course, hasAttempts: boolean): QuizLockReason[] {
  const courseReasons: QuizLockReason[] = [];
  if (c.locked) courseReasons.push('COURSE_LOCKED');
  if (c.status === 'Submitted') courseReasons.push('COURSE_SUBMITTED');
  return hasAttempts ? ['QUIZ_HAS_ATTEMPTS', ...courseReasons] : courseReasons;
}

const reasonsOf = (p: QuizPermissions) =>
  Object.fromEntries(
    Object.entries(p).map(([key, value]) => [key, value.reasons]),
  ) as Record<keyof QuizPermissions, QuizLockReason[]>;

describe('computeQuizPermissions (UC18.1, BR-99)', () => {
  test('a Draft Course without attempts allows everything', () => {
    const { permissions, lockReasons } = computeQuizPermissions(
      course(),
      false,
    );
    assert.deepEqual(lockReasons, []);
    for (const [key, value] of Object.entries(permissions)) {
      assert.deepEqual(value, { allowed: true, reasons: [] }, key);
    }
  });

  test('attempts freeze questions, time limit, n and m, not the score or the flag (BR-96, BR-97)', () => {
    const r = reasonsOf(computeQuizPermissions(course(), true).permissions);
    assert.deepEqual(r.editQuestions, ['QUIZ_HAS_ATTEMPTS']);
    assert.deepEqual(r.editTimeLimit, ['QUIZ_HAS_ATTEMPTS']);
    assert.deepEqual(r.editAttemptRule, ['QUIZ_HAS_ATTEMPTS']);
    assert.deepEqual(r.deleteLastQuestion, ['QUIZ_HAS_ATTEMPTS']);
    assert.deepEqual(r.editPassingScore, []);
    assert.deepEqual(r.editRequired, []);
    assert.deepEqual(r.deleteQuiz, []); // BR-92 needs Locked as well
  });

  test('a Locked Course freezes the passing score and the required flag (BR-94)', () => {
    const r = reasonsOf(
      computeQuizPermissions(
        course({ status: 'Published', locked: true }),
        false,
      ).permissions,
    );
    assert.deepEqual(r.editPassingScore, ['COURSE_LOCKED']);
    assert.deepEqual(r.editRequired, ['COURSE_LOCKED']);
    assert.deepEqual(r.editQuestions, []);
    assert.deepEqual(r.editTimeLimit, []);
    assert.deepEqual(r.editAttemptRule, []);
    assert.deepEqual(r.deleteQuiz, []); // an unused Quiz can still go
  });

  test('Locked + attempts blocks the delete (BR-92)', () => {
    const r = reasonsOf(
      computeQuizPermissions(
        course({ status: 'Published', locked: true }),
        true,
      ).permissions,
    );
    assert.deepEqual(r.deleteQuiz, ['COURSE_LOCKED', 'QUIZ_HAS_ATTEMPTS']);
  });

  test('the last question can only go while the Course is Draft or Rejected (BR-323)', () => {
    for (const status of ['Draft', 'Rejected']) {
      const { permissions } = computeQuizPermissions(course({ status }), false);
      assert.equal(permissions.deleteLastQuestion.allowed, true, status);
    }
    const published = computeQuizPermissions(
      course({ status: 'Published' }),
      false,
    ).permissions;
    assert.deepEqual(published.deleteLastQuestion.reasons, [
      'COURSE_LEFT_DRAFT',
    ]);
    assert.equal(published.editQuestions.allowed, true);
  });

  test('a Submitted Course blocks every change with COURSE_SUBMITTED (BR-285)', () => {
    const { permissions } = computeQuizPermissions(
      course({ status: 'Submitted' }),
      false,
    );
    for (const [key, value] of Object.entries(permissions)) {
      assert.deepEqual(
        value,
        { allowed: false, reasons: ['COURSE_SUBMITTED'] },
        key,
      );
    }
  });

  test('an Archived or Disabled Course blocks every change with COURSE_NOT_EDITABLE', () => {
    for (const c of [
      course({ status: 'Archived' }),
      course({ disabled: true }),
      course({ status: 'Published', disabled: true }),
    ]) {
      const { permissions } = computeQuizPermissions(c, false);
      for (const [key, value] of Object.entries(permissions)) {
        assert.equal(value.allowed, false, key);
        assert.deepEqual(value.reasons, ['COURSE_NOT_EDITABLE'], key);
      }
    }
  });

  test('the reasons add up: Submitted + Locked + attempts', () => {
    const r = reasonsOf(
      computeQuizPermissions(
        course({ status: 'Submitted', locked: true }),
        true,
      ).permissions,
    );
    assert.deepEqual(r.editQuestions, [
      'COURSE_SUBMITTED',
      'QUIZ_HAS_ATTEMPTS',
    ]);
    assert.deepEqual(r.editPassingScore, ['COURSE_SUBMITTED', 'COURSE_LOCKED']);
    assert.deepEqual(r.deleteQuiz, [
      'COURSE_SUBMITTED',
      'COURSE_LOCKED',
      'QUIZ_HAS_ATTEMPTS',
    ]);
  });

  test('the UC18 list reasons are exactly the ones from before UC18.1', () => {
    for (const status of [
      'Draft',
      'Rejected',
      'Published',
      'Submitted',
      'Archived',
    ]) {
      for (const locked of [false, true]) {
        for (const disabled of [false, true]) {
          for (const hasAttempts of [false, true]) {
            const c = course({ status, locked, disabled });
            assert.deepEqual(
              computeQuizPermissions(c, hasAttempts).lockReasons,
              legacyLockReasons(c, hasAttempts),
              JSON.stringify({ ...c, hasAttempts }),
            );
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------- QuizService

class StubCourseClient extends CourseServiceClient {
  constructor(private readonly answer: () => Promise<CourseAuthoringContext>) {
    super();
  }
  getAuthoringContext(): Promise<CourseAuthoringContext> {
    return this.answer();
  }
  setAssignmentMinutes(): Promise<void> {
    return Promise.resolve();
  }
  getModuleIds(): Promise<string[] | null> {
    return Promise.resolve(null);
  }
}

function quizRow(over: Record<string, unknown> = {}) {
  return {
    id: QUIZ,
    organizationId: ORG,
    courseId: COURSE,
    moduleId: MODULE,
    kind: 'QUIZ',
    title: 'Safety Quiz',
    position: 2,
    passingScore: 72.5, // Prisma Decimal; Number() accepts it
    isRequired: true,
    timeLimitMinutes: 15,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    disabledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    _count: { questions: 2, quizAttempts: 0 },
    questions: [
      {
        id: 'q1',
        position: 1,
        questionType: 'SingleChoice',
        content: 'Which gear is required?',
        options: [
          { id: 'o1', position: 1, content: 'Helmet', isCorrect: true },
          { id: 'o2', position: 2, content: 'Cap', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        position: 2,
        questionType: 'TrueFalse',
        content: 'Exits must stay clear.',
        options: [
          { id: 'o3', position: 1, content: 'True', isCorrect: true },
          { id: 'o4', position: 2, content: 'False', isCorrect: false },
        ],
      },
    ],
    ...over,
  };
}

interface BuildOptions {
  row?: ReturnType<typeof quizRow> | null;
  rows?: ReturnType<typeof quizRow>[];
  course?: Partial<CourseAuthoringContext>;
  courseError?: Error;
}

function build(opts: BuildOptions = {}) {
  const queries: Record<string, unknown>[] = [];
  const prisma = {
    assessment: {
      findFirst: (args: Record<string, unknown>) => {
        queries.push(args);
        return Promise.resolve(opts.row === undefined ? quizRow() : opts.row);
      },
      findMany: () => Promise.resolve(opts.rows ?? []),
    },
  } as unknown as PrismaService;
  const courses = new StubCourseClient(() =>
    opts.courseError
      ? Promise.reject(opts.courseError)
      : Promise.resolve(draftCourse(opts.course)),
  );
  return { quizzes: new QuizService(prisma, courses), queries };
}

describe('getQuiz (UC18.1)', () => {
  test('returns configuration, placement, ordered questions with answer keys and permissions', async () => {
    const { quizzes, queries } = build();
    const quiz = await quizzes.getQuiz(instructor, QUIZ);

    assert.equal(quiz.id, QUIZ);
    assert.equal(quiz.placement, 'MODULE');
    assert.equal(quiz.moduleId, MODULE);
    assert.equal(quiz.passingScore, 72.5);
    assert.equal(quiz.isRequired, true);
    assert.equal(quiz.timeLimitMinutes, 15);
    assert.equal(quiz.questionCount, 2);
    assert.equal(quiz.courseStatus, 'Draft');
    assert.equal(quiz.courseLocked, false);
    assert.equal(quiz.hasAttempts, false);
    assert.deepEqual(quiz.lockReasons, []);
    assert.equal(quiz.permissions.editQuestions.allowed, true);
    assert.deepEqual(
      quiz.questions.map((q) => [q.id, q.type, q.options.map((o) => o.id)]),
      [
        ['q1', 'SingleChoice', ['o1', 'o2']],
        ['q2', 'TrueFalse', ['o3', 'o4']],
      ],
    );
    assert.deepEqual(quiz.questions[0].options[0], {
      id: 'o1',
      position: 1,
      content: 'Helmet',
      isCorrect: true,
    });
    // No database column leaks (organizationId, kind, questionType...).
    assert.equal('organizationId' in quiz, false);
    assert.equal('questionType' in quiz.questions[0], false);

    // Read only inside the caller's tenant, only Quizzes, questions and options in display order.
    const where = queries[0].where as Record<string, unknown>;
    assert.deepEqual(where, { id: QUIZ, organizationId: ORG, kind: 'QUIZ' });
    const include = queries[0].include as {
      questions: {
        orderBy: unknown;
        include: { options: { orderBy: unknown } };
      };
    };
    assert.deepEqual(include.questions.orderBy, { position: 'asc' });
    assert.deepEqual(include.questions.include.options.orderBy, {
      position: 'asc',
    });
  });

  test('a Course-level Quiz has placement COURSE (BR-154, BR-291)', async () => {
    const { quizzes } = build({ row: quizRow({ moduleId: null }) });
    const quiz = await quizzes.getQuiz(instructor, QUIZ);
    assert.equal(quiz.placement, 'COURSE');
    assert.equal(quiz.moduleId, null);
  });

  test('a Quiz with no question yet answers with an empty list', async () => {
    const { quizzes } = build({
      row: quizRow({
        questions: [],
        _count: { questions: 0, quizAttempts: 0 },
      }),
    });
    const quiz = await quizzes.getQuiz(instructor, QUIZ);
    assert.deepEqual(quiz.questions, []);
    assert.equal(quiz.questionCount, 0);
  });

  test('the Course facts drive the lock reasons and permissions', async () => {
    const { quizzes } = build({
      row: quizRow({ _count: { questions: 2, quizAttempts: 3 } }),
      course: { status: 'Published', locked: true },
    });
    const quiz = await quizzes.getQuiz(instructor, QUIZ);
    assert.equal(quiz.courseLocked, true);
    assert.equal(quiz.hasAttempts, true);
    assert.deepEqual(quiz.lockReasons, ['QUIZ_HAS_ATTEMPTS', 'COURSE_LOCKED']);
    assert.deepEqual(quiz.permissions.deleteQuiz.reasons, [
      'COURSE_LOCKED',
      'QUIZ_HAS_ATTEMPTS',
    ]);
    assert.deepEqual(quiz.permissions.deleteLastQuestion.reasons, [
      'QUIZ_HAS_ATTEMPTS',
      'COURSE_LEFT_DRAFT',
    ]);
  });

  test('a Submitted Course can still be viewed (BR-285 only blocks changes)', async () => {
    const { quizzes } = build({ course: { status: 'Submitted' } });
    const quiz = await quizzes.getQuiz(instructor, QUIZ);
    assert.equal(quiz.questions.length, 2);
    assert.deepEqual(quiz.lockReasons, ['COURSE_SUBMITTED']);
    assert.equal(quiz.permissions.editPassingScore.allowed, false);
  });

  test('only an Instructor may look (403)', async () => {
    for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN'] as const) {
      await rejectsWith(
        build().quizzes.getQuiz(asRole(role), QUIZ),
        ForbiddenException,
        'FORBIDDEN',
      );
    }
  });

  test('missing, another Instructor’s or an unknown Course all look the same (404, BR-79, BR-287)', async () => {
    const cases = [
      build({ row: null }),
      build({ course: { instructorId: OTHER_INSTRUCTOR } }),
      build({
        course: { organizationId: '00000000-0000-4000-8000-0000000000bb' },
      }),
      build({
        courseError: new NotFoundException({
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found.',
        }),
      }),
    ];
    for (const { quizzes } of cases) {
      await assert.rejects(quizzes.getQuiz(instructor, QUIZ), (error) => {
        assert.ok(error instanceof NotFoundException);
        assert.deepEqual(error.getResponse(), {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found.',
        });
        return true;
      });
    }
  });

  test('Course Service being down is a 503, never an answer without the check (BR-78)', async () => {
    const { quizzes } = build({
      courseError: new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: 'Course Service is unavailable. Please try again later.',
      }),
    });
    await rejectsWith(
      quizzes.getQuiz(instructor, QUIZ),
      ServiceUnavailableException,
      'COURSE_SERVICE_UNAVAILABLE',
    );
  });
});

describe('listQuizzes (UC18) after the refactor', () => {
  test('the lock reasons are unchanged: Archived, Disabled and Published add none', async () => {
    const rows = [
      quizRow({ id: 'a', _count: { questions: 1, quizAttempts: 0 } }),
      quizRow({ id: 'b', _count: { questions: 1, quizAttempts: 2 } }),
    ];
    for (const c of [
      { status: 'Archived' },
      { disabled: true },
      { status: 'Published' },
    ]) {
      const page = await build({ rows, course: c }).quizzes.listQuizzes(
        instructor,
        { courseId: COURSE },
      );
      assert.deepEqual(
        page.items.map((q) => q.lockReasons),
        [[], ['QUIZ_HAS_ATTEMPTS']],
        JSON.stringify(c),
      );
      // The list rows keep their UC18 shape: no detail fields.
      assert.equal('permissions' in page.items[0], false);
      assert.equal('questions' in page.items[0], false);
    }
  });

  test('Locked and Submitted keep their UC18 reasons', async () => {
    const rows = [quizRow({ _count: { questions: 1, quizAttempts: 1 } })];
    const page = await build({
      rows,
      course: { status: 'Submitted', locked: true },
    }).quizzes.listQuizzes(instructor, { courseId: COURSE });
    assert.deepEqual(page.items[0].lockReasons, [
      'QUIZ_HAS_ATTEMPTS',
      'COURSE_LOCKED',
      'COURSE_SUBMITTED',
    ]);
    assert.equal(page.items[0].locked, true);
  });
});
