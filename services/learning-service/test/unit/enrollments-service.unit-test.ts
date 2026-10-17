import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../../generated/prisma/client';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import type { CourseSnapshotRows } from '../../src/modules/course-snapshots/course-snapshot-rows';
import { CreateEnrollmentDto } from '../../src/modules/enrollments/dto/create-enrollments.dto';
import { EnrollmentsController } from '../../src/modules/enrollments/enrollments.controller';
import { EnrollmentsService } from '../../src/modules/enrollments/enrollments.service';
import {
  CourseNotAvailableError,
  CourseServiceConfigurationError,
  CourseServiceContractError,
  CourseServiceUnavailableError,
} from '../../src/infrastructure/clients/course/course-service.errors';
import type {
  CourseTree,
  LockedCourse,
} from '../../src/infrastructure/clients/course/course-service.interface';
import {
  TenantUnavailableError,
  type OrganizationAccess,
} from '../../src/infrastructure/clients/tenant/tenant.client';

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const COURSE_ID = '0199a000-0000-7000-8000-0e0000000003';
const EXISTING_ID = '0199a000-0000-7000-8000-ee0000000001';
const NEW_ID = '0199a000-0000-7000-8000-ee0000000002';

const LEARNER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: ORG_A,
  role: 'LEARNER',
  isAuthenticated: true,
};

const LOCK: LockedCourse = {
  courseId: COURSE_ID,
  organizationId: ORG_A,
  chainId: '0199a000-0000-7000-8000-0d0000000002',
  expectedCompletionDays: 7,
  courseType: 'Public',
  lockedAt: new Date('2026-10-01T00:00:00Z'),
};

const TREE: CourseTree = {
  courseId: COURSE_ID,
  chainId: LOCK.chainId,
  versionNumber: 1,
  disabledAt: null,
  asOf: new Date('2026-10-01T01:00:00Z'),
  modules: [],
};

const TX = { __tx: true };

/** Dựng service với các phụ thuộc giả, đếm số lần gọi. */
function setup(
  options: {
    existingId?: string | null;
    videoCompletionPercent?: number | null;
    tenant?: () => Promise<OrganizationAccess>;
    lock?: () => Promise<LockedCourse>;
    snapshotExists?: boolean;
    create?: () => Promise<unknown>;
  } = {},
) {
  const calls = { tenant: 0, lock: 0, tree: 0, findExisting: 0 };
  const created: Prisma.EnrollmentUncheckedCreateInput[] = [];
  const insertedSnapshots: CourseSnapshotRows[] = [];
  let existingId = options.existingId ?? null;

  const enrollments = {
    findIdByLearnerAndCourse: () => {
      calls.findExisting += 1;
      return Promise.resolve(existingId);
    },
    create: (data: Prisma.EnrollmentUncheckedCreateInput, tx: unknown) => {
      assert.equal(tx, TX);
      created.push(data);
      if (options.create) {
        return options.create();
      }
      return Promise.resolve({
        id: NEW_ID,
        courseId: data.courseId,
        enrollmentType: data.enrollmentType,
        status: data.status,
        enrolledAt: new Date(),
      });
    },
    findCourseIdsOfLearner: () =>
      Promise.resolve([{ courseId: COURSE_ID, enrollmentId: EXISTING_ID }]),
  };
  const courseSnapshots = {
    existsForCourse: () => Promise.resolve(options.snapshotExists ?? false),
    insertIgnoringConflicts: (rows: CourseSnapshotRows, tx: unknown) => {
      assert.equal(tx, TX);
      insertedSnapshots.push(rows);
      return Promise.resolve();
    },
  };
  const platformSettings = {
    getVideoCompletionPercent: () =>
      Promise.resolve(
        options.videoCompletionPercent === undefined
          ? 90
          : options.videoCompletionPercent,
      ),
  };
  const courseService = {
    lockCourse: (
      _user: CurrentUser,
      _courseId: string,
      selfEnroll: boolean,
    ) => {
      calls.lock += 1;
      assert.equal(selfEnroll, true);
      return options.lock ? options.lock() : Promise.resolve(LOCK);
    },
    getCourseTree: () => {
      calls.tree += 1;
      return Promise.resolve(TREE);
    },
  };
  const tenant = {
    getOrganizationAccess: () => {
      calls.tenant += 1;
      return options.tenant
        ? options.tenant()
        : Promise.resolve({
            subscriptionStatus: 'Active',
            readOnlyEndsAt: null,
            timezone: 'Asia/Ho_Chi_Minh',
          });
    },
  };
  const prisma = {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
  };

  const service = new EnrollmentsService(
    prisma as never,
    enrollments as never,
    courseSnapshots as never,
    platformSettings as never,
    courseService as never,
    tenant,
    {} as never,
    undefined,
    {
      findRegistration: async () => {
        calls.findExisting += 1;
        return existingId ? { id: existingId, status: 'NotStarted' } : null;
      },
    } as never,
  );
  const logger = (service as unknown as { logger: Logger }).logger;
  const loggerError = mock.method(logger, 'error', () => undefined);
  mock.method(logger, 'warn', () => undefined);

  return {
    service,
    calls,
    created,
    insertedSnapshots,
    loggerError,
    setExistingId: (id: string | null) => {
      existingId = id;
    },
  };
}

function access(subscriptionStatus: string) {
  return () =>
    Promise.resolve({
      subscriptionStatus,
      readOnlyEndsAt: null,
      timezone: 'Asia/Ho_Chi_Minh',
    });
}

/** Kiểm HttpException: status, code và (nếu có) message. */
async function rejectsWith(
  promise: Promise<unknown>,
  status: number,
  code: string,
  message?: string,
): Promise<Record<string, unknown>> {
  let body: Record<string, unknown> = {};
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof HttpException, String(error));
    assert.equal(error.getStatus(), status);
    body = error.getResponse() as Record<string, unknown>;
    assert.equal(body.code, code);
    if (message !== undefined) {
      assert.equal(body.message, message);
    }
    return true;
  });
  return body;
}

void describe('EnrollmentsService.enrollOptional (UC25.3)', () => {
  void test('đã có Enrollment → 409 ALREADY_ENROLLED kèm enrollmentId; không gọi tenant, không gọi I1', async () => {
    const { service, calls } = setup({ existingId: EXISTING_ID });
    const body = await rejectsWith(
      service.enrollOptional(LEARNER, COURSE_ID),
      409,
      'ALREADY_ENROLLED',
      'Bạn đã đăng ký Course này',
    );
    assert.equal(body.enrollmentId, EXISTING_ID);
    assert.equal(calls.tenant, 0);
    assert.equal(calls.lock, 0);
  });

  void test('thiếu platform_settings → 503 + logger.error; không gọi tenant, không gọi I1', async () => {
    const { service, calls, loggerError } = setup({
      videoCompletionPercent: null,
    });
    await rejectsWith(
      service.enrollOptional(LEARNER, COURSE_ID),
      503,
      'SERVICE_UNAVAILABLE',
    );
    assert.equal(loggerError.mock.callCount(), 1);
    assert.equal(calls.tenant, 0);
    assert.equal(calls.lock, 0);
  });

  void test('tenant Grace → 403 ORGANIZATION_IN_GRACE đúng message; không gọi I1', async () => {
    const { service, calls } = setup({ tenant: access('Grace') });
    await rejectsWith(
      service.enrollOptional(LEARNER, COURSE_ID),
      403,
      'ORGANIZATION_IN_GRACE',
      'Tổ chức của bạn đang trong thời gian ân hạn, chưa thể đăng ký Course mới',
    );
    assert.equal(calls.lock, 0);
  });

  for (const status of ['Suspended', 'Abc']) {
    void test(`tenant ${status} → 403 + logger.error nêu giá trị; không gọi I1`, async () => {
      const { service, calls, loggerError } = setup({
        tenant: access(status),
      });
      await rejectsWith(
        service.enrollOptional(LEARNER, COURSE_ID),
        403,
        'FORBIDDEN',
        'Không thể đăng ký Course lúc này',
      );
      assert.equal(loggerError.mock.callCount(), 1);
      assert.match(
        String(loggerError.mock.calls[0].arguments[0]),
        new RegExp(`"${status}"`),
      );
      assert.equal(calls.lock, 0);
    });
  }

  void test('tenant lỗi mạng → 503; không gọi I1', async () => {
    const { service, calls } = setup({
      tenant: () => Promise.reject(new TenantUnavailableError('ECONNREFUSED')),
    });
    await rejectsWith(
      service.enrollOptional(LEARNER, COURSE_ID),
      503,
      'SERVICE_UNAVAILABLE',
      'Hệ thống đang bận, vui lòng thử lại',
    );
    assert.equal(calls.lock, 0);
  });

  const lockErrors: [string, Error, number, string][] = [
    [
      'CourseNotAvailable',
      new CourseNotAvailableError('COURSE_NOT_AVAILABLE', 'x'),
      404,
      'COURSE_NOT_AVAILABLE',
    ],
    [
      'Unavailable',
      new CourseServiceUnavailableError('timeout'),
      503,
      'SERVICE_UNAVAILABLE',
    ],
    [
      'Contract',
      new CourseServiceContractError('I1 lock', 'chainId', 'phải là UUID'),
      503,
      'SERVICE_UNAVAILABLE',
    ],
    [
      'Configuration',
      new CourseServiceConfigurationError('HTTP 401'),
      500,
      'INTERNAL_ERROR',
    ],
  ];
  for (const [name, error, status, code] of lockErrors) {
    void test(`I1 ${name} → ${status}; không ghi gì`, async () => {
      const { service, created, calls } = setup({
        lock: () => Promise.reject(error),
      });
      await rejectsWith(
        service.enrollOptional(LEARNER, COURSE_ID),
        status,
        code,
      );
      assert.equal(calls.tree, 0);
      assert.equal(created.length, 0);
    });
  }

  void test('có sẵn bản sao → không gọi I2, không ghi bản sao', async () => {
    const { service, calls, insertedSnapshots } = setup({
      snapshotExists: true,
    });
    await service.enrollOptional(LEARNER, COURSE_ID);
    assert.equal(calls.tree, 0);
    assert.equal(insertedSnapshots.length, 0);
  });

  void test('chưa có bản sao → gọi I2 một lần, ghi bản sao trong cùng transaction', async () => {
    const { service, calls, insertedSnapshots } = setup();
    await service.enrollOptional(LEARNER, COURSE_ID);
    assert.equal(calls.tree, 1);
    assert.equal(insertedSnapshots.length, 1);
    assert.equal(insertedSnapshots[0].course.chainId, LOCK.chainId);
  });

  void test('Enrollment ghi đúng: Optional, NotStarted, 4 cột hạn NULL, extension 0, video_completion_percent đọc ở bước b', async () => {
    const { service, created } = setup({ videoCompletionPercent: 85 });
    const result = await service.enrollOptional(LEARNER, COURSE_ID);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0], {
      organizationId: ORG_A,
      learnerId: LEARNER.userId,
      courseId: COURSE_ID,
      enrollmentType: 'Optional',
      status: 'NotStarted',
      videoCompletionPercent: 85,
      assignedAt: null,
      expectedCompletionDays: null,
      baseDueAt: null,
      dueAt: null,
      extensionSeconds: 0,
    });
    assert.deepEqual(Object.keys(result).sort(), [
      'courseId',
      'enrolledAt',
      'enrollmentType',
      'id',
      'restored',
      'status',
    ]);
  });

  void test('P2002 trong transaction → truy vấn mới lấy enrollmentId → 409', async () => {
    const harness = setup({
      create: () => {
        // Request song song vừa commit Enrollment của chính Learner này
        harness.setExistingId(EXISTING_ID);
        return Promise.reject(
          new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        );
      },
    });
    const body = await rejectsWith(
      harness.service.enrollOptional(LEARNER, COURSE_ID),
      409,
      'ALREADY_ENROLLED',
    );
    assert.equal(body.enrollmentId, EXISTING_ID);
    // Lần 1 ở bước a, lần 2 sau khi transaction kết thúc
    assert.equal(harness.calls.findExisting, 2);
  });
});

void describe('EnrollmentsController', () => {
  const guard = new RolesGuard(new Reflector());
  const controller = EnrollmentsController.prototype;

  const contextFor = (handler: () => unknown, role: CurrentUser['role']) =>
    ({
      getHandler: () => handler,
      getClass: () => EnrollmentsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { ...LEARNER, role } }),
      }),
    }) as unknown as ExecutionContext;

  // Handler gốc trên prototype: Reflector đọc metadata @Roles từ chính hàm này
  const handlers: [string, () => unknown][] = [
    ['POST /enrollments', Reflect.get(controller, 'enroll') as () => unknown],
    [
      'GET /enrollments/me/course-ids',
      Reflect.get(controller, 'getMyCourseIds') as () => unknown,
    ],
    [
      'GET /enrollments/me',
      Reflect.get(controller, 'findMine') as () => unknown,
    ],
  ];
  for (const [name, handler] of handlers) {
    void test(`${name}: sai role → 403, LEARNER → qua`, () => {
      for (const role of ['ADMIN', 'ORGANIZER', 'INSTRUCTOR'] as const) {
        assert.throws(
          () => guard.canActivate(contextFor(handler, role)),
          ForbiddenException,
        );
      }
      assert.equal(guard.canActivate(contextFor(handler, 'LEARNER')), true);
    });
  }

  void test('body courseId không phải UUID → lỗi validate (400)', async () => {
    for (const body of [{ courseId: 'abc' }, {}, { courseId: 123 }]) {
      const errors = await validate(plainToInstance(CreateEnrollmentDto, body));
      assert.ok(errors.length > 0, JSON.stringify(body));
    }
    const ok = await validate(
      plainToInstance(CreateEnrollmentDto, { courseId: COURSE_ID }),
    );
    assert.equal(ok.length, 0);
  });
});
