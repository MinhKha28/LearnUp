import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { ParsePagePipe } from '../../src/common/pipes/parse-page.pipe';
import {
  normalizeCourseName,
  parseMyEnrollmentFilters,
} from '../../src/modules/enrollments/my-enrollment-filters';
import type {
  MyEnrollmentCriteria,
  MyEnrollmentRow,
} from '../../src/modules/enrollments/enrollments.repository';
import {
  EnrollmentsService,
  MY_ENROLLMENTS_PAGE_SIZE,
} from '../../src/modules/enrollments/enrollments.service';
import {
  CourseServiceContractError,
  CourseServiceUnavailableError,
} from '../../src/infrastructure/clients/course/course-service.errors';
import type { CourseBatchItem } from '../../src/infrastructure/clients/course/course-service.interface';
import {
  TenantUnavailableError,
  type OrganizationAccess,
} from '../../src/infrastructure/clients/tenant/tenant.client';

const ORG = '0199a000-0000-7000-8000-0a0000000001';
const COURSE_1 = '0199a000-0000-7000-8000-0e0000000002';
const COURSE_2 = '0199a000-0000-7000-8000-0e0000000004';
const ENROLLMENT_1 = '0199a000-0000-7000-8000-ee0000000011';
const ENROLLMENT_2 = '0199a000-0000-7000-8000-ee0000000012';

const LEARNER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: ORG,
  role: 'LEARNER',
  isAuthenticated: true,
};

const REQUIRED_ROW: MyEnrollmentRow = {
  id: ENROLLMENT_1,
  courseId: COURSE_1,
  enrollmentType: 'Required',
  status: 'Overdue',
  dueAt: new Date('2026-09-29T17:00:00Z'),
  dueTimezone: 'Asia/Ho_Chi_Minh',
};
const OPTIONAL_ROW: MyEnrollmentRow = {
  id: ENROLLMENT_2,
  courseId: COURSE_2,
  enrollmentType: 'Optional',
  status: 'NotStarted',
  dueAt: null,
  dueTimezone: null,
};

const batchItem = (courseId: string): CourseBatchItem => ({
  courseId,
  chainId: '0199a000-0000-7000-8000-0d0000000001',
  versionNumber: 2,
  name: `Course ${courseId.slice(-2)}`,
  courseType: 'Public',
  status: 'Published',
  coverFileId: null,
});

const ACCESS: OrganizationAccess = {
  subscriptionStatus: 'Active',
  organizationStatus: 'Active',
  readOnlyEndsAt: null,
  timezone: 'Asia/Ho_Chi_Minh',
};

/** Dựng service với repository, I3 và tenant giả; đếm số lần gọi. */
function setup(
  options: {
    total?: number;
    rows?: MyEnrollmentRow[];
    batch?: (ids: string[]) => Promise<CourseBatchItem[]>;
    tenant?: () => Promise<OrganizationAccess>;
  } = {},
) {
  const rows = options.rows ?? [REQUIRED_ROW, OPTIONAL_ROW];
  const calls = {
    count: 0,
    criteria: [] as MyEnrollmentCriteria[],
    materialIds: [] as string[][],
    page: 0,
    materials: 0,
    batch: [] as string[][],
    tenant: 0,
  };

  const enrollments = {
    countMine: (
      _learner: string,
      _org: string,
      criteria: MyEnrollmentCriteria,
    ) => {
      calls.criteria.push(criteria);
      calls.count += 1;
      return Promise.resolve(options.total ?? rows.length);
    },
    findMinePage: (
      _learnerId: string,
      _organizationId: string,
      limit: number,
      offset: number,
      criteria: MyEnrollmentCriteria,
    ) => {
      calls.criteria.push(criteria);
      calls.page += 1;
      assert.equal(limit, MY_ENROLLMENTS_PAGE_SIZE);
      return Promise.resolve(rows.slice(offset, offset + limit));
    },
    findMineCandidates: (
      _learner: string,
      _org: string,
      criteria: MyEnrollmentCriteria,
    ) =>
      Promise.resolve(
        rows.filter(
          (row) =>
            (!criteria.type || row.enrollmentType === criteria.type) &&
            (!criteria.status || row.status === criteria.status),
        ),
      ),
    countRequiredMaterials: (ids: string[]) => {
      calls.materialIds.push(ids);
      calls.materials += 1;
      return Promise.resolve(
        new Map(ids.map((id) => [id, { completed: 1, total: 6 }])),
      );
    },
  };
  const courseService = {
    getCoursesBatch: (_user: CurrentUser, ids: string[]) => {
      calls.batch.push(ids);
      return options.batch
        ? options.batch(ids)
        : Promise.resolve(ids.map(batchItem));
    },
  };
  const tenant = {
    getOrganizationAccess: () => {
      calls.tenant += 1;
      return options.tenant ? options.tenant() : Promise.resolve(ACCESS);
    },
  };

  const service = new EnrollmentsService(
    {} as never,
    enrollments as never,
    {} as never,
    {} as never,
    courseService as never,
    tenant,
  );
  const loggerError = mock.method(
    (service as unknown as { logger: Logger }).logger,
    'error',
    () => undefined,
  );
  const loggerWarn = mock.method(
    (service as unknown as { logger: Logger }).logger,
    'warn',
    () => undefined,
  );
  return { service, calls, loggerError, loggerWarn };
}

async function rejectsWithStatus(
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

void describe('EnrollmentsService.findMyEnrollments (UC26)', () => {
  void test('chưa có Enrollment → items rỗng, total 0; không đọc trang, không gọi I3, không gọi tenant', async () => {
    const { service, calls } = setup({ rows: [], total: 0 });
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.deepEqual(result, {
      meta: { current: 1, pageSize: 20, pages: 0, total: 0 },
      items: [],
    });
    assert.deepEqual(
      [calls.page, calls.materials, calls.batch.length, calls.tenant],
      [0, 0, 0, 0],
    );
  });

  void test('trang vượt tổng (kể cả page = 1e20) → items rỗng, total đúng; không chạy truy vấn danh sách', async () => {
    for (const page of [2, 1e20]) {
      const { service, calls } = setup();
      const result = await service.findMyEnrollments(LEARNER, page);
      assert.deepEqual(result.items, []);
      assert.equal(result.meta.total, 2);
      assert.equal(result.meta.current, page);
      assert.deepEqual(
        [calls.page, calls.batch.length, calls.tenant],
        [0, 0, 0],
      );
    }
  });

  void test('header không phải UUID → rỗng, không chạm database, logger.warn nêu tên header và giá trị cắt 64 ký tự', async () => {
    const { service, calls, loggerWarn } = setup();
    const longValue = 'x'.repeat(100);
    const result = await service.findMyEnrollments(
      { ...LEARNER, userId: longValue, organizationId: 'abc' },
      1,
    );
    assert.equal(result.meta.total, 0);
    assert.equal(calls.count, 0);

    const messages = loggerWarn.mock.calls.map((c) => String(c.arguments[0]));
    assert.equal(messages.length, 2);
    assert.match(messages[0], /x-user-id/);
    assert.ok(messages[0].includes(`"${'x'.repeat(64)}"`));
    assert.ok(!messages[0].includes('x'.repeat(65)));
    assert.match(messages[1], /x-organization-id/);
    assert.match(messages[1], /"abc"/);
  });

  void test('header hợp lệ → không logger.warn', async () => {
    const { service, loggerWarn } = setup();
    await service.findMyEnrollments(LEARNER, 1);
    assert.equal(loggerWarn.mock.callCount(), 0);
  });

  void test('đủ dữ liệu → đúng dạng từng phần tử; I3 gọi một lần cho các courseId của trang', async () => {
    const { service, calls } = setup();
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.deepEqual(calls.batch, [[COURSE_1, COURSE_2]]);
    assert.deepEqual(Object.keys(result).sort(), ['items', 'meta']);
    assert.equal(result.items[0].dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual(result.items[0], {
      enrollmentId: ENROLLMENT_1,
      courseId: COURSE_1,
      enrollmentType: 'Required',
      status: 'Overdue',
      dueAt: '2026-09-29T17:00:00.000Z',
      dueTimezone: 'Asia/Ho_Chi_Minh',
      requiredMaterials: { completed: 1, total: 6 },
      course: { name: 'Course 02', versionNumber: 2, coverFileId: null },
    });
    assert.equal(result.items[1].dueAt, null);
  });

  void test('I3 thiếu một courseId → course: null + logger.error nêu enrollmentId và courseId; các dòng khác giữ nguyên', async () => {
    const { service, loggerError } = setup({
      batch: () => Promise.resolve([batchItem(COURSE_2)]),
    });
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.equal(result.items[0].course, null);
    assert.notEqual(result.items[1].course, null);
    assert.equal(loggerError.mock.callCount(), 1);
    const message = String(loggerError.mock.calls[0].arguments[0]);
    assert.match(message, new RegExp(ENROLLMENT_1));
    assert.match(message, new RegExp(COURSE_1));
  });

  for (const [name, error] of [
    ['không trả lời', new CourseServiceUnavailableError('timeout')],
    [
      'sai hợp đồng',
      new CourseServiceContractError('I3 batch', 'name', 'phải là chuỗi'),
    ],
  ] as const) {
    void test(`I3 ${name} → 503 SERVICE_UNAVAILABLE`, async () => {
      const { service } = setup({ batch: () => Promise.reject(error) });
      await rejectsWithStatus(
        service.findMyEnrollments(LEARNER, 1),
        503,
        'SERVICE_UNAVAILABLE',
      );
    });
  }

  void test('Tenant outage cannot change stored deadline timezone', async () => {
    const { service, calls } = setup({
      tenant: () => Promise.reject(new TenantUnavailableError('down')),
    });
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.ok(!('organizationTimezone' in result));
    assert.equal(result.items[0].dueTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(result.items.length, 2);
    assert.equal(calls.tenant, 0);
  });

  void test('trang không có Required có hạn → không gọi tenant', async () => {
    const { service, calls } = setup({ rows: [OPTIONAL_ROW] });
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.equal(calls.tenant, 0);
    assert.ok(!('organizationTimezone' in result));
  });
});

void describe('ParsePagePipe (chép từ 5a)', () => {
  const pipe = new ParsePagePipe();

  void test('thiếu → 1; số nguyên ≥ 1 giữ nguyên, kể cả rất lớn', () => {
    assert.equal(pipe.transform(undefined), 1);
    assert.equal(pipe.transform(3), 3);
    assert.equal(pipe.transform(1e20), 1e20);
  });

  void test('0, âm, số lẻ, NaN → 400', () => {
    for (const value of [0, -1, 1.5, Number.NaN]) {
      assert.throws(() => pipe.transform(value), BadRequestException);
    }
  });
});

void describe('My enrollment filters', () => {
  void test('Normalizes accents, đ, Unicode forms, case and whitespace', () => {
    assert.equal(normalizeCourseName('Lập Trình'), 'lap trinh');
    assert.equal(normalizeCourseName('ĐẠI'), 'dai');
    assert.equal(
      normalizeCourseName('Lập Trình'.normalize('NFD')),
      'lap trinh',
    );
    assert.equal(normalizeCourseName('  Lập\t  Trình  '), 'lap trinh');
  });

  void test('Trims keyword, allows 200 characters and ignores whitespace', () => {
    const limit = 'đ'.repeat(200);
    assert.equal(
      parseMyEnrollmentFilters(` ${limit}\t`, undefined, undefined).q,
      limit,
    );
    assert.equal(
      parseMyEnrollmentFilters('  \t', undefined, undefined).q,
      undefined,
    );
  });

  void test('Rejects oversized, invalid and repeated filters with VALIDATION_ERROR', () => {
    const invalid = [
      ['a'.repeat(201), undefined, undefined],
      [undefined, 'required', undefined],
      [undefined, undefined, 'Withdrawn'],
      [['a', 'b'], undefined, undefined],
      [undefined, ['Required', 'Required'], undefined],
      [undefined, undefined, ['Halted', 'Completed']],
    ] as const;
    for (const [q, type, status] of invalid) {
      assert.throws(
        () => parseMyEnrollmentFilters(q, type, status),
        (error) => {
          assert.ok(error instanceof BadRequestException);
          assert.equal(
            (error.getResponse() as { code: string }).code,
            'VALIDATION_ERROR',
          );
          return true;
        },
      );
    }
  });

  void test('Shares the same request criteria and time between count and page', async () => {
    const { service, calls } = setup();
    await service.findMyEnrollments(LEARNER, 1, {
      type: 'Required',
      status: 'Overdue',
    });
    assert.equal(calls.criteria.length, 2);
    assert.strictEqual(calls.criteria[0].now, calls.criteria[1].now);
    assert.equal(calls.criteria[0].type, 'Required');
    assert.equal(calls.criteria[1].status, 'Overdue');
  });

  void test('Combines type, status and keyword and excludes missing course data', async () => {
    const rows = [
      REQUIRED_ROW,
      OPTIONAL_ROW,
      { ...REQUIRED_ROW, courseId: 'missing' },
    ];
    const { service, calls } = setup({
      rows,
      batch: async () => [{ ...batchItem(COURSE_1), name: 'Lập Trình' }],
    });
    const page = await service.findMyEnrollments(LEARNER, 1, {
      q: 'lap trinh',
      type: 'Required',
      status: 'Overdue',
    });
    assert.equal(calls.count, 0);
    assert.equal(calls.page, 0);
    assert.deepEqual(calls.batch, [[COURSE_1, 'missing']]);
    assert.equal(page.meta.total, 1);
    assert.deepEqual(
      page.items.map((item) => item.courseId),
      [COURSE_1],
    );
  });

  void test('Loads 101 course IDs in sequential batches and counts materials for page 2', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...OPTIONAL_ROW,
      id: `enrollment-${index}`,
      courseId: `course-${index}`,
    }));
    let active = 0;
    const { service, calls } = setup({
      rows,
      batch: async (ids) => {
        assert.equal(++active, 1);
        await Promise.resolve();
        active--;
        return ids.map(batchItem);
      },
    });
    const page = await service.findMyEnrollments(LEARNER, 2, { q: 'course' });
    assert.deepEqual(
      calls.batch.map((ids) => ids.length),
      [100, 1],
    );
    assert.equal(page.meta.total, 101);
    assert.deepEqual(calls.materialIds, [
      rows.slice(20, 40).map((row) => row.id),
    ]);
    assert.deepEqual(
      page.items.map((item) => item.enrollmentId),
      calls.materialIds[0],
    );
  });

  void test('Rejects a failed later batch without returning a partial count', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...OPTIONAL_ROW,
      id: `enrollment-${index}`,
      courseId: `course-${index}`,
    }));
    const { service, calls } = setup({
      rows,
      batch: async (ids) => {
        if (ids.length === 1)
          throw new CourseServiceUnavailableError('timeout');
        return ids.map(batchItem);
      },
    });
    await rejectsWithStatus(
      service.findMyEnrollments(LEARNER, 1, { q: 'course' }),
      503,
      'SERVICE_UNAVAILABLE',
    );
    assert.equal(calls.materials, 0);
  });
});
