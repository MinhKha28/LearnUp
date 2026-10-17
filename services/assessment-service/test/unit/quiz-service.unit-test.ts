/** Business rules of UC18.5 (delete Quiz), with Prisma and Course Service replaced by fakes. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../src/infrastructure/clients/course/course-service.client';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
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

class StubCourseClient extends CourseServiceClient {
  constructor(private readonly ctx: CourseAuthoringContext) {
    super();
  }
  getAuthoringContext(): Promise<CourseAuthoringContext> {
    return Promise.resolve(this.ctx);
  }
  setAssignmentMinutes(): Promise<void> {
    return Promise.resolve();
  }
  getModuleIds(): Promise<string[] | null> {
    return Promise.resolve(null);
  }
}

interface Options {
  course?: Partial<CourseAuthoringContext>;
  attempts?: number; // attempts seen on the first read
  attemptsAtLock?: number; // attempts seen again under the row lock
  quizExists?: boolean;
}

function build(opts: Options = {}) {
  const attempts = opts.attempts ?? 0;
  const calls = { deleted: [] as string[], locked: 0, answersCleared: 0 };
  const row = {
    id: QUIZ,
    organizationId: ORG,
    courseId: COURSE,
    kind: 'QUIZ',
    _count: { questions: 3, quizAttempts: attempts },
  };
  const tx = {
    $queryRaw: () => {
      calls.locked += 1;
      return Promise.resolve([{ id: QUIZ }]);
    },
    quizAttempt: {
      count: () => Promise.resolve(opts.attemptsAtLock ?? attempts),
    },
    quizAttemptAnswer: {
      deleteMany: () => {
        calls.answersCleared += 1;
        return Promise.resolve({ count: 0 });
      },
    },
    assessment: {
      delete: ({ where }: { where: { id: string } }) => {
        calls.deleted.push(where.id);
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    assessment: {
      findFirst: () => Promise.resolve(opts.quizExists === false ? null : row),
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const quizzes = new QuizService(
    prisma,
    new StubCourseClient(draftCourse(opts.course)),
  );
  return { quizzes, calls };
}

describe('deleteQuiz (UC18.5)', () => {
  test('deletes an unused Quiz and returns its id', async () => {
    const { quizzes, calls } = build();
    assert.deepEqual(await quizzes.deleteQuiz(instructor, QUIZ), { id: QUIZ });
    assert.deepEqual(calls.deleted, [QUIZ]);
    assert.equal(calls.locked, 1);
    assert.equal(calls.answersCleared, 1); // answers are cleared before the Quiz row goes
  });

  test('a Locked Course still lets an unused Quiz go, a used one is blocked (BR-92)', async () => {
    const unused = build({ course: { locked: true } });
    await unused.quizzes.deleteQuiz(instructor, QUIZ);
    assert.equal(unused.calls.deleted.length, 1);

    const used = build({ course: { locked: true }, attempts: 2 });
    await rejectsWith(
      used.quizzes.deleteQuiz(instructor, QUIZ),
      ConflictException,
      'QUIZ_HAS_DATA',
    );
    assert.equal(used.calls.deleted.length, 0);
  });

  test('a Quiz with attempts is deletable while the Course is not Locked', async () => {
    const { quizzes, calls } = build({ attempts: 2 });
    await quizzes.deleteQuiz(instructor, QUIZ);
    assert.equal(calls.deleted.length, 1);
  });

  test('an attempt that lands after the first read blocks the delete on a Locked Course', async () => {
    const { quizzes, calls } = build({
      course: { locked: true },
      attempts: 0,
      attemptsAtLock: 1,
    });
    await rejectsWith(
      quizzes.deleteQuiz(instructor, QUIZ),
      ConflictException,
      'QUIZ_HAS_DATA',
    );
    assert.equal(calls.deleted.length, 0);
  });

  test('a Course in review, archived or disabled accepts no delete (BR-285)', async () => {
    for (const course of [
      { status: 'Submitted' },
      { status: 'Archived' },
      { disabled: true },
    ]) {
      const { quizzes, calls } = build({ course });
      await rejectsWith(
        quizzes.deleteQuiz(instructor, QUIZ),
        ConflictException,
        'COURSE_NOT_EDITABLE',
      );
      assert.equal(calls.deleted.length, 0);
    }
  });

  test('only the Instructor in charge may delete (403 / 404)', async () => {
    await rejectsWith(
      build().quizzes.deleteQuiz(asRole('LEARNER'), QUIZ),
      ForbiddenException,
      'FORBIDDEN',
    );
    await rejectsWith(
      build({ course: { instructorId: OTHER_INSTRUCTOR } }).quizzes.deleteQuiz(
        instructor,
        QUIZ,
      ),
      NotFoundException,
    );
    await rejectsWith(
      build({ quizExists: false }).quizzes.deleteQuiz(instructor, QUIZ),
      NotFoundException,
    );
  });
});
