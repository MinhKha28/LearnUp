/**
 * UC18.1.1 (add a question with its answers to a Quiz): the answer-key rules per type (BR-194, BR-202), the request
 * validation, and QuizService.addQuestion with Prisma and Course Service replaced by fakes (order of the checks,
 * hiding of other Instructors' Quizzes, BR-83, BR-117 checked again inside the locked transaction).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../src/infrastructure/clients/course/course-service.client';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateQuizQuestionDto } from '../../src/modules/quiz/dto/create-quiz-question.dto';
import {
  checkQuestionRules,
  optionsToStore,
  type QuestionInput,
} from '../../src/modules/quiz/quiz-question-rules';
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

const opts = (...items: [string, boolean][]) =>
  items.map(([content, isCorrect]) => ({ content, isCorrect }));

// ---------------------------------------------------------------------------------------------- rules

describe('checkQuestionRules (UC18.1.1, BR-194, BR-202)', () => {
  test('valid questions of every type pass', () => {
    const valid: QuestionInput[] = [
      { type: 'SingleChoice', options: opts(['A', true], ['B', false]) },
      {
        type: 'MultipleChoice',
        options: opts(['A', true], ['B', true], ['C', false]),
      },
      { type: 'TrueFalse', correctAnswer: true },
      { type: 'TrueFalse', correctAnswer: false },
      {
        type: 'SingleChoice',
        options: Array.from({ length: 10 }, (_, i) => ({
          content: `O${i}`,
          isCorrect: i === 0,
        })),
      },
    ];
    for (const input of valid) {
      assert.deepEqual(checkQuestionRules(input), [], JSON.stringify(input));
    }
  });

  test('TrueFalse takes correctAnswer, never options', () => {
    assert.deepEqual(checkQuestionRules({ type: 'TrueFalse' }), [
      'CORRECT_ANSWER_REQUIRED',
    ]);
    assert.deepEqual(
      checkQuestionRules({
        type: 'TrueFalse',
        options: opts(['True', true], ['False', false]),
        correctAnswer: true,
      }),
      ['OPTIONS_NOT_ALLOWED'],
    );
  });

  test('a choice question needs options and never correctAnswer', () => {
    assert.deepEqual(checkQuestionRules({ type: 'SingleChoice' }), [
      'OPTIONS_REQUIRED',
    ]);
    assert.deepEqual(
      checkQuestionRules({
        type: 'MultipleChoice',
        correctAnswer: true,
        options: opts(['A', true], ['B', false]),
      }),
      ['CORRECT_ANSWER_NOT_ALLOWED'],
    );
  });

  test('2 to 10 options', () => {
    assert.deepEqual(
      checkQuestionRules({ type: 'SingleChoice', options: opts(['A', true]) }),
      ['OPTIONS_COUNT'],
    );
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      content: `O${i}`,
      isCorrect: i === 0,
    }));
    assert.deepEqual(
      checkQuestionRules({ type: 'SingleChoice', options: eleven }),
      ['OPTIONS_COUNT'],
    );
  });

  test('two options with the same text (case and spaces ignored) are refused', () => {
    assert.deepEqual(
      checkQuestionRules({
        type: 'SingleChoice',
        options: opts(['Helmet', true], [' helmet ', false]),
      }),
      ['OPTIONS_DUPLICATED'],
    );
  });

  test('SingleChoice needs exactly one correct option', () => {
    for (const options of [
      opts(['A', false], ['B', false]),
      opts(['A', true], ['B', true], ['C', false]),
    ]) {
      assert.deepEqual(checkQuestionRules({ type: 'SingleChoice', options }), [
        'SINGLE_CORRECT_COUNT',
      ]);
    }
  });

  test('MultipleChoice needs at least one correct and one incorrect option', () => {
    assert.deepEqual(
      checkQuestionRules({
        type: 'MultipleChoice',
        options: opts(['A', false], ['B', false]),
      }),
      ['MULTIPLE_CORRECT_COUNT'],
    );
    assert.deepEqual(
      checkQuestionRules({
        type: 'MultipleChoice',
        options: opts(['A', true], ['B', true]),
      }),
      ['MULTIPLE_INCORRECT_COUNT'],
    );
  });

  test('every problem is reported at once', () => {
    assert.deepEqual(
      checkQuestionRules({
        type: 'SingleChoice',
        correctAnswer: false,
        options: opts(['A', false]),
      }),
      ['CORRECT_ANSWER_NOT_ALLOWED', 'OPTIONS_COUNT', 'SINGLE_CORRECT_COUNT'],
    );
  });
});

describe('optionsToStore (UC18.1.1)', () => {
  test('TrueFalse becomes the two options True / False in that order', () => {
    assert.deepEqual(
      optionsToStore({ type: 'TrueFalse', correctAnswer: true }),
      [
        { content: 'True', isCorrect: true },
        { content: 'False', isCorrect: false },
      ],
    );
    assert.deepEqual(
      optionsToStore({ type: 'TrueFalse', correctAnswer: false }),
      [
        { content: 'True', isCorrect: false },
        { content: 'False', isCorrect: true },
      ],
    );
  });

  test('choice options are kept in the order sent, without extra fields', () => {
    const options = [
      { content: 'B', isCorrect: false, extra: 1 },
      { content: 'A', isCorrect: true },
    ];
    assert.deepEqual(optionsToStore({ type: 'SingleChoice', options }), [
      { content: 'B', isCorrect: false },
      { content: 'A', isCorrect: true },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------- DTO

async function problems(input: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateQuizQuestionDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('CreateQuizQuestionDto (UC18.1.1)', () => {
  test('valid requests of every type', async () => {
    assert.deepEqual(
      await problems({
        type: 'SingleChoice',
        content: 'Q',
        options: opts(['A', true], ['B', false]),
      }),
      [],
    );
    assert.deepEqual(
      await problems({ type: 'TrueFalse', content: 'Q', correctAnswer: true }),
      [],
    );
  });

  test('type must be one of the three, content is trimmed, required and at most 2000 characters', async () => {
    const base = { correctAnswer: true };
    assert.deepEqual(await problems({ ...base, type: 'Essay', content: 'Q' }), [
      'type',
    ]);
    for (const content of [undefined, '', '   ', 7, 'a'.repeat(2001)]) {
      assert.deepEqual(
        await problems({ ...base, type: 'TrueFalse', content }),
        ['content'],
        String(content).slice(0, 20),
      );
    }
    const dto = plainToInstance(CreateQuizQuestionDto, {
      ...base,
      type: 'TrueFalse',
      content: '  ' + 'a'.repeat(2000) + '  ',
    });
    assert.equal(dto.content.length, 2000);
    assert.deepEqual(await validate(dto), []);
  });

  test('options: an array of at most 10, each with non-blank content (≤ 500) and a boolean isCorrect', async () => {
    const q = { type: 'SingleChoice', content: 'Q' };
    assert.deepEqual(await problems({ ...q, options: 'A' }), ['options']);
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      content: `O${i}`,
      isCorrect: i === 0,
    }));
    assert.deepEqual(await problems({ ...q, options: eleven }), ['options']);
    for (const option of [
      { content: '  ', isCorrect: false },
      { content: 'a'.repeat(501), isCorrect: false },
      { content: 'B', isCorrect: 'no' },
      { content: 'B' },
      { content: 'B', isCorrect: false, position: 2 },
    ]) {
      assert.deepEqual(
        await problems({
          ...q,
          options: [{ content: 'A', isCorrect: true }, option],
        }),
        ['options'],
        JSON.stringify(option).slice(0, 40),
      );
    }
  });

  test('correctAnswer must be a boolean; unknown fields are refused', async () => {
    const q = { type: 'TrueFalse', content: 'Q' };
    assert.deepEqual(await problems({ ...q, correctAnswer: 'true' }), [
      'correctAnswer',
    ]);
    assert.deepEqual(
      await problems({ ...q, correctAnswer: true, position: 1 }),
      ['position'],
    );
  });
});

// ---------------------------------------------------------------------------------------------- QuizService

class StubCourseClient extends CourseServiceClient {
  calls = 0;
  constructor(private readonly answer: () => Promise<CourseAuthoringContext>) {
    super();
  }
  getAuthoringContext(): Promise<CourseAuthoringContext> {
    this.calls++;
    return this.answer();
  }
  setAssignmentMinutes(): Promise<void> {
    return Promise.resolve();
  }
  getModuleIds(): Promise<string[] | null> {
    return Promise.resolve(null);
  }
  verifyOrganizerReviewAccess(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException('Not available in this test stub.'),
    );
  }
}

interface BuildOptions {
  /** The Quiz row found before the transaction; null = not found. */
  row?: Record<string, unknown> | null;
  attemptsBefore?: number;
  /** Attempts counted inside the transaction, after the row lock. */
  attemptsInTx?: number;
  /** Rows returned by SELECT ... FOR UPDATE (0 = the Quiz vanished meanwhile). */
  lockedRows?: number;
  maxPosition?: number | null;
  questionCountAfter?: number;
  course?: Partial<CourseAuthoringContext>;
  courseError?: Error;
}

function build(o: BuildOptions = {}) {
  const calls = {
    findFirst: [] as Record<string, unknown>[],
    lock: 0,
    transactions: 0,
    attemptCounts: [] as Record<string, unknown>[],
    creates: [] as Record<string, any>[],
  };
  const row =
    o.row === undefined
      ? {
          id: QUIZ,
          organizationId: ORG,
          courseId: COURSE,
          kind: 'QUIZ',
          _count: { questions: 0, quizAttempts: o.attemptsBefore ?? 0 },
        }
      : o.row;
  const tx = {
    $queryRaw: () => {
      calls.lock++;
      return Promise.resolve(
        Array.from({ length: o.lockedRows ?? 1 }, () => ({ id: QUIZ })),
      );
    },
    quizAttempt: {
      count: (args: Record<string, unknown>) => {
        calls.attemptCounts.push(args);
        return Promise.resolve(o.attemptsInTx ?? 0);
      },
    },
    quizQuestion: {
      aggregate: () =>
        Promise.resolve({
          _max: {
            position: o.maxPosition === undefined ? null : o.maxPosition,
          },
        }),
      create: (args: Record<string, any>) => {
        calls.creates.push(args);
        const data = args.data;
        return Promise.resolve({
          id: 'new-question',
          organizationId: data.organizationId,
          assessmentId: data.assessmentId,
          questionType: data.questionType,
          content: data.content,
          position: data.position,
          options: data.options.create.map(
            (option: Record<string, unknown>, i: number) => ({
              id: `opt-${i + 1}`,
              organizationId: option.organizationId,
              ...option,
            }),
          ),
        });
      },
      count: () => Promise.resolve(o.questionCountAfter ?? 1),
    },
  };
  const prisma = {
    assessment: {
      findFirst: (args: Record<string, unknown>) => {
        calls.findFirst.push(args);
        return Promise.resolve(row);
      },
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      calls.transactions++;
      return fn(tx);
    },
  } as unknown as PrismaService;
  const courses = new StubCourseClient(() =>
    o.courseError
      ? Promise.reject(o.courseError)
      : Promise.resolve(draftCourse(o.course)),
  );
  return { quizzes: new QuizService(prisma, courses), calls, courses };
}

const single = {
  type: 'SingleChoice' as const,
  content: 'Which gear is required?',
  options: opts(['Helmet', true], ['Cap', false], ['Scarf', false]),
};

describe('addQuestion (UC18.1.1)', () => {
  test('adds the question at the end with its options in the order sent, inside the caller’s tenant', async () => {
    const { quizzes, calls } = build({ maxPosition: 3, questionCountAfter: 4 });
    const result = await quizzes.addQuestion(instructor, QUIZ, single);

    assert.deepEqual(result, {
      quizId: QUIZ,
      questionCount: 4,
      question: {
        id: 'new-question',
        position: 4,
        type: 'SingleChoice',
        content: 'Which gear is required?',
        options: [
          { id: 'opt-1', position: 1, content: 'Helmet', isCorrect: true },
          { id: 'opt-2', position: 2, content: 'Cap', isCorrect: false },
          { id: 'opt-3', position: 3, content: 'Scarf', isCorrect: false },
        ],
      },
    });
    assert.deepEqual(calls.findFirst[0].where, {
      id: QUIZ,
      organizationId: ORG,
      kind: 'QUIZ',
    });
    const data = calls.creates[0].data;
    assert.equal(data.organizationId, ORG);
    assert.equal(data.assessmentId, QUIZ);
    assert.deepEqual(
      data.options.create.map((o: Record<string, unknown>) => o.organizationId),
      [ORG, ORG, ORG],
    );
    // The row is locked and the attempts counted again inside the transaction (BR-117, BR-314).
    assert.equal(calls.lock, 1);
    assert.deepEqual(calls.attemptCounts[0].where, { assessmentId: QUIZ });
    // No organizationId / assessmentId leak in the answer.
    assert.equal('organizationId' in result.question, false);
    assert.equal('organizationId' in result.question.options[0], false);
  });

  test('the first question of an empty Quiz gets position 1', async () => {
    const { quizzes, calls } = build({ maxPosition: null });
    const result = await quizzes.addQuestion(instructor, QUIZ, single);
    assert.equal(result.question.position, 1);
    assert.equal(calls.creates[0].data.position, 1);
  });

  test('a TrueFalse question is stored with the options True / False', async () => {
    const { quizzes, calls } = build();
    const result = await quizzes.addQuestion(instructor, QUIZ, {
      type: 'TrueFalse',
      content: 'Exits must stay clear.',
      correctAnswer: false,
    });
    assert.deepEqual(
      calls.creates[0].data.options.create.map((o: Record<string, unknown>) => [
        o.position,
        o.content,
        o.isCorrect,
      ]),
      [
        [1, 'True', false],
        [2, 'False', true],
      ],
    );
    assert.equal(result.question.type, 'TrueFalse');
  });

  test('a wrong answer key is a 400 with every reason, before anything is read (BR-202)', async () => {
    const { quizzes, calls, courses } = build();
    await assert.rejects(
      quizzes.addQuestion(instructor, QUIZ, {
        type: 'SingleChoice',
        content: 'Q',
        options: opts(['A', false], ['A', false]),
      }),
      (error) => {
        assert.ok(error instanceof BadRequestException);
        const body = error.getResponse() as Record<string, unknown>;
        assert.equal(body.code, 'QUIZ_QUESTION_INVALID');
        assert.deepEqual(body.errors, [
          'OPTIONS_DUPLICATED',
          'SINGLE_CORRECT_COUNT',
        ]);
        return true;
      },
    );
    assert.equal(calls.findFirst.length, 0);
    assert.equal(courses.calls, 0);
    assert.equal(calls.transactions, 0);
  });

  test('only an Instructor may add (403)', async () => {
    for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN'] as const) {
      const { quizzes, calls } = build();
      await rejectsWith(
        quizzes.addQuestion(asRole(role), QUIZ, single),
        ForbiddenException,
        'FORBIDDEN',
      );
      assert.equal(calls.findFirst.length, 0, role);
    }
  });

  test('missing, another Instructor’s, another Organization’s or an unknown Course: the same 404 (BR-79, BR-287)', async () => {
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
    for (const { quizzes, calls } of cases) {
      await assert.rejects(
        quizzes.addQuestion(instructor, QUIZ, single),
        (error) => {
          assert.ok(error instanceof NotFoundException);
          assert.deepEqual(error.getResponse(), {
            code: 'QUIZ_NOT_FOUND',
            message: 'Quiz not found.',
          });
          return true;
        },
      );
      assert.equal(calls.transactions, 0);
    }
  });

  test('Course Service down is a 503 and nothing is written (BR-78)', async () => {
    const { quizzes, calls } = build({
      courseError: new ServiceUnavailableException({
        code: 'COURSE_SERVICE_UNAVAILABLE',
        message: 'Course Service is unavailable. Please try again later.',
      }),
    });
    await rejectsWith(
      quizzes.addQuestion(instructor, QUIZ, single),
      ServiceUnavailableException,
      'COURSE_SERVICE_UNAVAILABLE',
    );
    assert.equal(calls.transactions, 0);
  });

  test('a Submitted, Archived or Disabled Course refuses with COURSE_NOT_EDITABLE (BR-83, BR-285)', async () => {
    for (const [course, reason] of [
      [{ status: 'Submitted' }, 'COURSE_SUBMITTED'],
      [{ status: 'Archived' }, 'COURSE_NOT_EDITABLE'],
      [{ disabled: true }, 'COURSE_NOT_EDITABLE'],
      [{ status: 'Published', disabled: true }, 'COURSE_NOT_EDITABLE'],
    ] as const) {
      const { quizzes, calls } = build({ course });
      await assert.rejects(
        quizzes.addQuestion(instructor, QUIZ, single),
        (error) => {
          assert.ok(error instanceof ConflictException, JSON.stringify(course));
          const body = error.getResponse() as Record<string, unknown>;
          assert.equal(body.code, 'COURSE_NOT_EDITABLE');
          assert.equal(body.reason, reason, JSON.stringify(course));
          return true;
        },
      );
      assert.equal(calls.transactions, 0);
    }
  });

  test('Draft, Rejected, Published and a Locked Course all accept a new question', async () => {
    for (const course of [
      { status: 'Draft' },
      { status: 'Rejected' },
      { status: 'Published' },
      { status: 'Published', locked: true },
    ]) {
      const { quizzes } = build({ course });
      const result = await quizzes.addQuestion(instructor, QUIZ, single);
      assert.equal(result.quizId, QUIZ, JSON.stringify(course));
    }
  });

  test('a Quiz a Learner already started refuses with QUIZ_HAS_ATTEMPTS (BR-117)', async () => {
    const { quizzes, calls } = build({ attemptsBefore: 1 });
    await rejectsWith(
      quizzes.addQuestion(instructor, QUIZ, single),
      ConflictException,
      'QUIZ_HAS_ATTEMPTS',
    );
    assert.equal(calls.transactions, 0);
  });

  test('an attempt started between the check and the lock is still caught, and nothing is created', async () => {
    const { quizzes, calls } = build({ attemptsBefore: 0, attemptsInTx: 1 });
    await rejectsWith(
      quizzes.addQuestion(instructor, QUIZ, single),
      ConflictException,
      'QUIZ_HAS_ATTEMPTS',
    );
    assert.equal(calls.lock, 1);
    assert.equal(calls.creates.length, 0);
  });

  test('a Quiz deleted between the read and the lock is a 404', async () => {
    const { quizzes, calls } = build({ lockedRows: 0 });
    await rejectsWith(
      quizzes.addQuestion(instructor, QUIZ, single),
      NotFoundException,
      'QUIZ_NOT_FOUND',
    );
    assert.equal(calls.creates.length, 0);
  });
});
