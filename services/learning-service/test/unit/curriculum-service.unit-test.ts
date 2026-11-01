import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { HttpException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import type { SnapshotMaterial } from '../../src/modules/curriculum/build-curriculum';
import { CurriculumController } from '../../src/modules/curriculum/curriculum.controller';
import type { AccessibleEnrollment } from '../../src/modules/curriculum/curriculum.repository';
import { CurriculumService } from '../../src/modules/curriculum/curriculum.service';
import {
  CourseNotAvailableError,
  CourseServiceConfigurationError,
  CourseServiceContractError,
  CourseServiceError,
  CourseServiceUnavailableError,
} from '../../src/infrastructure/clients/course/course-service.errors';
import type {
  CourseBatchItem,
  CourseTree,
  LessonContent,
} from '../../src/infrastructure/clients/course/course-service.interface';

const ORG = '0199a000-0000-7000-8000-0a0000000001';
const COURSE = '0199a000-0000-7000-8000-0e0000000002';
const ENROLLMENT = '0199a000-0000-7000-8000-2a0000000002';
const L1 = '0199a000-0000-7000-8000-1b0000000011';
const L2 = '0199a000-0000-7000-8000-1b0000000012';
const L3 = '0199a000-0000-7000-8000-1b0000000013';
const OTHER_LESSON = '0199a000-0000-7000-8000-1b00000000f1';
const M1 = '0199a000-0000-7000-8000-1c0000000111';
const M2 = '0199a000-0000-7000-8000-1c0000000112';
const M3 = '0199a000-0000-7000-8000-1c0000000121';
const M4 = '0199a000-0000-7000-8000-1c0000000131';
const DISABLED = new Date('2026-09-30T00:00:00Z');

const LEARNER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: ORG,
  role: 'LEARNER',
  isAuthenticated: true,
};

const ENROLLMENT_ROW: AccessibleEnrollment = {
  id: ENROLLMENT,
  courseId: COURSE,
  enrollmentType: 'Required',
  storedStatus: 'InProgress',
  status: 'Overdue',
  dueAt: new Date('2026-09-29T17:00:00Z'),
  dueTimezone: 'Asia/Ho_Chi_Minh',
  versionDisabledAt: null,
};

function tree(overrides: Partial<CourseTree> = {}): CourseTree {
  const video = (id: string, position: number, isRequired = true) => ({
    id,
    title: `Video ${id.slice(-3)}`,
    position,
    materialType: 'Video' as const,
    isRequired,
    durationSeconds: 600,
    disabledAt: null,
  });
  return {
    courseId: COURSE,
    chainId: '0199a000-0000-7000-8000-0d0000000001',
    versionNumber: 2,
    disabledAt: null,
    asOf: new Date('2026-10-01T00:00:00Z'),
    modules: [
      {
        id: '0199a000-0000-7000-8000-1a0000000011',
        title: 'Module 1',
        position: 1,
        lessons: [
          {
            id: L1,
            title: 'Lesson 1',
            position: 1,
            disabledAt: null,
            materials: [
              video(M1, 1),
              {
                id: M2,
                title: 'Reading 112',
                position: 2,
                materialType: 'Reading',
                isRequired: false,
                durationSeconds: null,
                disabledAt: null,
              },
            ],
          },
          {
            id: L2,
            title: 'Lesson 2',
            position: 2,
            disabledAt: null,
            materials: [video(M3, 1)],
          },
        ],
      },
      {
        id: '0199a000-0000-7000-8000-1a0000000012',
        title: 'Module 2',
        position: 2,
        lessons: [
          {
            id: L3,
            title: 'Lesson 3',
            position: 1,
            disabledAt: null,
            materials: [video(M4, 1)],
          },
        ],
      },
    ],
    ...overrides,
  };
}

const snapshotMaterials = (): SnapshotMaterial[] =>
  tree().modules.flatMap((m) =>
    m.lessons.flatMap((l) =>
      l.materials.map((x) => ({
        materialId: x.id,
        lessonId: l.id,
        materialType: x.materialType,
        isRequired: x.isRequired,
        disabledAt: null,
      })),
    ),
  );

const lessonContent = (
  overrides: Partial<LessonContent> = {},
): LessonContent => ({
  lessonId: L2,
  courseId: COURSE,
  title: 'Lesson 2 (I4)',
  content: '## Nội dung',
  disabledAt: null,
  ...overrides,
});

const batchItem: CourseBatchItem = {
  courseId: COURSE,
  chainId: '0199a000-0000-7000-8000-0d0000000001',
  versionNumber: 2,
  name: 'An toàn lao động',
  courseType: 'Public',
  status: 'Published',
  coverFileId: null,
};

function setup(
  options: {
    enrollment?: AccessibleEnrollment | null;
    tree?: () => Promise<CourseTree>;
    batch?: () => Promise<CourseBatchItem[]>;
    lesson?: () => Promise<LessonContent>;
    tenantFails?: boolean;
    snapshot?: SnapshotMaterial[];
    disabledLessons?: string[];
    completed?: string[];
  } = {},
) {
  const calls = { find: 0, tree: 0, batch: 0, lesson: 0, tenant: 0 };
  const repository = {
    findAccessibleEnrollment: () => {
      calls.find += 1;
      return Promise.resolve(
        options.enrollment === undefined ? ENROLLMENT_ROW : options.enrollment,
      );
    },
    findSnapshot: () =>
      Promise.resolve({
        materials: options.snapshot ?? snapshotMaterials(),
        disabledLessonIds: new Set(options.disabledLessons ?? []),
      }),
    findCompletedMaterialIds: () =>
      Promise.resolve(new Set(options.completed ?? [M2])),
  };
  const enrollments = {
    countRequiredMaterials: (ids: string[]) =>
      Promise.resolve(
        new Map(ids.map((id) => [id, { completed: 0, total: 3 }])),
      ),
  };
  const courseService = {
    getCourseTree: () => {
      calls.tree += 1;
      return options.tree ? options.tree() : Promise.resolve(tree());
    },
    getCoursesBatch: () => {
      calls.batch += 1;
      return options.batch ? options.batch() : Promise.resolve([batchItem]);
    },
    getLesson: () => {
      calls.lesson += 1;
      return options.lesson
        ? options.lesson()
        : Promise.resolve(lessonContent());
    },
  };
  const service = new CurriculumService(
    repository as never,
    enrollments as never,
    courseService as never,
  );
  const logger = (service as unknown as { logger: Logger }).logger;
  const loggerError = mock.method(logger, 'error', () => undefined);
  const loggerWarn = mock.method(logger, 'warn', () => undefined);
  const courseCalls = () => calls.tree + calls.batch + calls.lesson;
  return { service, calls, loggerError, loggerWarn, courseCalls };
}

async function rejectsWith(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof HttpException, String(error));
    assert.equal(error.getStatus(), status);
    assert.equal((error.getResponse() as { code: string }).code, code);
    return true;
  });
}

const COURSE_SERVICE_ERRORS: [string, () => Error][] = [
  ['không trả lời', () => new CourseServiceUnavailableError('timeout')],
  [
    'sai hợp đồng (courseId lệch)',
    () =>
      new CourseServiceContractError(
        'I2 tree',
        'courseId',
        'không khớp giá trị đã gửi',
      ),
  ],
  [
    '404 (dữ liệu lệch giữa hai service)',
    () => new CourseNotAvailableError('COURSE_NOT_FOUND', 'Course not found.'),
  ],
  ['sai cấu hình', () => new CourseServiceConfigurationError('HTTP 401')],
  ['CourseServiceError chung', () => new CourseServiceError('HTTP 400')],
];

void describe('CurriculumService – kiểm quyền D28 (cả UC27 và UC27.1)', () => {
  const both = (service: CurriculumService, enrollmentId = ENROLLMENT) => [
    service.getCurriculum(LEARNER, enrollmentId),
    service.getLesson(LEARNER, enrollmentId, L2),
  ];

  void test('enrollmentId không phải UUID → 404 ENROLLMENT_NOT_FOUND, không truy vấn DB, không gọi course-service', async () => {
    const { service, calls, courseCalls } = setup();
    for (const promise of both(service, 'abc')) {
      await rejectsWith(promise, 404, 'ENROLLMENT_NOT_FOUND');
    }
    assert.equal(calls.find, 0);
    assert.equal(courseCalls(), 0);
  });

  void test('header không phải UUID → 404 + logger.warn nêu header', async () => {
    const { service, calls, loggerWarn } = setup();
    await rejectsWith(
      service.getCurriculum(
        { ...LEARNER, organizationId: 'org-x' },
        ENROLLMENT,
      ),
      404,
      'ENROLLMENT_NOT_FOUND',
    );
    assert.equal(calls.find, 0);
    assert.match(
      String(loggerWarn.mock.calls[0].arguments[0]),
      /x-organization-id.*"org-x"/,
    );
  });

  for (const [name, enrollment, status, code] of [
    ['không thấy', null, 404, 'ENROLLMENT_NOT_FOUND'],
    [
      'Withdrawn',
      { ...ENROLLMENT_ROW, storedStatus: 'Withdrawn', status: 'Withdrawn' },
      404,
      'ENROLLMENT_NOT_FOUND',
    ],
    [
      'Halted',
      { ...ENROLLMENT_ROW, storedStatus: 'Halted', status: 'Halted' },
      403,
      'CONTENT_UNAVAILABLE',
    ],
    [
      'bản sao phiên bản bị vô hiệu hóa',
      { ...ENROLLMENT_ROW, versionDisabledAt: DISABLED },
      403,
      'CONTENT_UNAVAILABLE',
    ],
  ] as const) {
    void test(`${name} → ${status} ${code}, không gọi course-service`, async () => {
      const { service, courseCalls } = setup({ enrollment });
      for (const promise of both(service)) {
        await rejectsWith(promise, status, code);
      }
      assert.equal(courseCalls(), 0);
    });
  }

  void test('Exempted và Completed vẫn xem được', async () => {
    for (const storedStatus of ['Exempted', 'Completed']) {
      const { service } = setup({
        enrollment: { ...ENROLLMENT_ROW, storedStatus, status: storedStatus },
      });
      const result = await service.getCurriculum(LEARNER, ENROLLMENT);
      assert.equal(result.status, storedStatus);
    }
  });

  void test('I2 có disabledAt → 403 CONTENT_UNAVAILABLE', async () => {
    const { service } = setup({
      tree: () => Promise.resolve(tree({ disabledAt: DISABLED })),
    });
    for (const promise of both(service)) {
      await rejectsWith(promise, 403, 'CONTENT_UNAVAILABLE');
    }
  });

  for (const [name, error] of COURSE_SERVICE_ERRORS) {
    void test(`I2 ${name} → 503 SERVICE_UNAVAILABLE`, async () => {
      const { service, loggerError } = setup({
        tree: () => Promise.reject(error()),
      });
      for (const promise of both(service)) {
        await rejectsWith(promise, 503, 'SERVICE_UNAVAILABLE');
      }
      if (!(error() instanceof CourseServiceUnavailableError)) {
        assert.ok(loggerError.mock.callCount() >= 2, 'phải logger.error');
      }
    });
  }

  void test('lỗi không phải của course-service → ném nguyên (không giấu bug thành 503)', async () => {
    const { service } = setup({
      tree: () => Promise.reject(new TypeError('bug')),
    });
    await assert.rejects(service.getCurriculum(LEARNER, ENROLLMENT), TypeError);
  });
});

void describe('CurriculumService.getCurriculum (UC27)', () => {
  void test('đúng dạng response; status gồm Overdue; I2 and I3 once, no Tenant call', async () => {
    const { service, calls } = setup();
    const result = await service.getCurriculum(LEARNER, ENROLLMENT);
    assert.deepEqual(Object.keys(result).sort(), [
      'course',
      'courseId',
      'dueAt',
      'dueTimezone',
      'enrollmentId',
      'enrollmentType',
      'modules',
      'requiredMaterials',
      'status',
    ]);
    assert.equal(result.status, 'Overdue');
    assert.equal(result.dueAt, '2026-09-29T17:00:00.000Z');
    assert.equal(result.dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual(result.course, {
      name: 'An toàn lao động',
      versionNumber: 2,
    });
    assert.deepEqual(result.requiredMaterials, { completed: 0, total: 3 });
    assert.deepEqual(Object.keys(result.modules[0]).sort(), [
      'completed',
      'isRequired',
      'lessons',
      'moduleId',
      'position',
      'title',
    ]);
    assert.deepEqual(Object.keys(result.modules[0].lessons[0]).sort(), [
      'completed',
      'isRequired',
      'lessonId',
      'position',
      'title',
    ]);
    assert.deepEqual([calls.tree, calls.batch, calls.tenant], [1, 1, 0]);
  });

  void test('I3 thiếu Course → course: null + logger.error, vẫn trả cây', async () => {
    const { service, loggerError } = setup({
      batch: () => Promise.resolve([]),
    });
    const result = await service.getCurriculum(LEARNER, ENROLLMENT);
    assert.equal(result.course, null);
    assert.equal(result.modules.length, 2);
    assert.match(
      String(loggerError.mock.calls[0].arguments[0]),
      new RegExp(ENROLLMENT),
    );
  });

  void test('I3 không trả lời → 503 cả trang', async () => {
    const { service } = setup({
      batch: () => Promise.reject(new CourseServiceUnavailableError('timeout')),
    });
    await rejectsWith(
      service.getCurriculum(LEARNER, ENROLLMENT),
      503,
      'SERVICE_UNAVAILABLE',
    );
  });

  void test('stored timezone remains available without Tenant', async () => {
    const { service } = setup({ tenantFails: true });
    const result = await service.getCurriculum(LEARNER, ENROLLMENT);
    assert.equal(result.dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(result.modules.length, 2);
  });

  void test('Optional → không gọi tenant, dueTimezone null', async () => {
    const { service, calls } = setup({
      enrollment: {
        ...ENROLLMENT_ROW,
        enrollmentType: 'Optional',
        status: 'NotStarted',
        storedStatus: 'NotStarted',
        dueAt: null,
        dueTimezone: null,
      },
    });
    const result = await service.getCurriculum(LEARNER, ENROLLMENT);
    assert.equal(calls.tenant, 0);
    assert.equal(result.dueTimezone, null);
  });

  void test('học liệu chỉ có ở I2 → logger.warn một lần kèm số lượng', async () => {
    const { service, loggerWarn } = setup({
      snapshot: snapshotMaterials().filter(
        (m) => m.materialId !== M3 && m.materialId !== M4,
      ),
    });
    await service.getCurriculum(LEARNER, ENROLLMENT);
    assert.equal(loggerWarn.mock.callCount(), 1);
    assert.match(String(loggerWarn.mock.calls[0].arguments[0]), /\b2 học liệu/);
  });
});

void describe('CurriculumService.getLesson (UC27.1)', () => {
  void test('lessonId không phải UUID: kiểm D28 trước, qua được thì 404 LESSON_NOT_FOUND, không gọi I2/I4', async () => {
    const notFound = setup({ enrollment: null });
    await rejectsWith(
      notFound.service.getLesson(LEARNER, ENROLLMENT, 'abc'),
      404,
      'ENROLLMENT_NOT_FOUND',
    );
    const { service, courseCalls } = setup();
    await rejectsWith(
      service.getLesson(LEARNER, ENROLLMENT, 'abc'),
      404,
      'LESSON_NOT_FOUND',
    );
    assert.equal(courseCalls(), 0);
  });

  void test('Lesson không có trong cây I2 → 404 LESSON_NOT_FOUND bất kể I4 trả gì', async () => {
    for (const lesson of [
      () => Promise.resolve(lessonContent({ lessonId: OTHER_LESSON })),
      () =>
        Promise.reject(
          new CourseNotAvailableError('LESSON_NOT_FOUND', 'Lesson not found.'),
        ),
      () => Promise.reject(new CourseServiceUnavailableError('timeout')),
    ]) {
      const { service } = setup({ lesson });
      await rejectsWith(
        service.getLesson(LEARNER, ENROLLMENT, OTHER_LESSON),
        404,
        'LESSON_NOT_FOUND',
      );
    }
  });

  void test('Lesson bị ẩn theo I2, theo lesson_snapshots, hoặc I4.disabledAt → 403 LESSON_DISABLED', async () => {
    const hiddenByTree = tree();
    hiddenByTree.modules[0].lessons[1].disabledAt = DISABLED;
    for (const options of [
      { tree: () => Promise.resolve(hiddenByTree) },
      { disabledLessons: [L2] },
      {
        lesson: () => Promise.resolve(lessonContent({ disabledAt: DISABLED })),
      },
    ]) {
      const { service } = setup(options);
      await rejectsWith(
        service.getLesson(LEARNER, ENROLLMENT, L2),
        403,
        'LESSON_DISABLED',
      );
    }
  });

  for (const [name, error] of COURSE_SERVICE_ERRORS) {
    void test(`Lesson có trong cây nhưng I4 ${name} → 503`, async () => {
      const { service } = setup({ lesson: () => Promise.reject(error()) });
      await rejectsWith(
        service.getLesson(LEARNER, ENROLLMENT, L2),
        503,
        'SERVICE_UNAVAILABLE',
      );
    });
  }

  void test('I4 trả courseId khác → logger.error + 503', async () => {
    const { service, loggerError } = setup({
      lesson: () =>
        Promise.resolve(
          lessonContent({ courseId: '0199a000-0000-7000-8000-0e0000000003' }),
        ),
    });
    await rejectsWith(
      service.getLesson(LEARNER, ENROLLMENT, L2),
      503,
      'SERVICE_UNAVAILABLE',
    );
    assert.equal(loggerError.mock.callCount(), 1);
  });

  void test('thành công: tiêu đề từ I4, học liệu hiển thị theo position, trước/sau qua ranh giới Module', async () => {
    const { service } = setup({ completed: [M3] });
    const result = await service.getLesson(LEARNER, ENROLLMENT, L2);
    assert.deepEqual(result, {
      enrollmentId: ENROLLMENT,
      lesson: {
        lessonId: L2,
        title: 'Lesson 2 (I4)',
        content: '## Nội dung',
        isRequired: true,
        completed: true,
      },
      materials: [
        {
          materialId: M3,
          title: 'Video 121',
          materialType: 'Video',
          isRequired: true,
          durationSeconds: 600,
          completed: true,
        },
      ],
      previousLesson: { lessonId: L1, title: 'Lesson 1' },
      nextLesson: { lessonId: L3, title: 'Lesson 3' },
    });
  });

  void test('content rỗng → null (luồng 3a)', async () => {
    const { service } = setup({
      lesson: () => Promise.resolve(lessonContent({ content: '   ' })),
    });
    const result = await service.getLesson(LEARNER, ENROLLMENT, L2);
    assert.equal(result.lesson.content, null);
  });
});

void describe('CurriculumController', () => {
  const guard = new RolesGuard(new Reflector());
  const controller = CurriculumController.prototype;
  const contextFor = (handler: () => unknown, role: CurrentUser['role']) =>
    ({
      getHandler: () => handler,
      getClass: () => CurriculumController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { ...LEARNER, role } }),
      }),
    }) as unknown as ExecutionContext;

  for (const name of ['getCurriculum', 'getLesson']) {
    void test(`${name}: sai role → 403, LEARNER → qua`, () => {
      const handler = Reflect.get(controller, name) as () => unknown;
      for (const role of ['ADMIN', 'ORGANIZER', 'INSTRUCTOR'] as const) {
        assert.throws(
          () => guard.canActivate(contextFor(handler, role)),
          ForbiddenException,
        );
      }
      assert.equal(guard.canActivate(contextFor(handler, 'LEARNER')), true);
    });
  }
});
