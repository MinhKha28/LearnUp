import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { ParsePagePipe } from '../../src/common/pipes/parse-page.pipe';
import type { MyEnrollmentRow } from '../../src/enrollments/enrollments.repository';
import {
  EnrollmentsService,
  MY_ENROLLMENTS_PAGE_SIZE,
} from '../../src/enrollments/enrollments.service';
import {
  CourseServiceContractError,
  CourseServiceUnavailableError,
} from '../../src/integrations/course-service/course-service.errors';
import type { CourseBatchItem } from '../../src/integrations/course-service/course-service.types';
import { OrganizationTimezoneService } from '../../src/integrations/tenant/organization-timezone.service';
import {
  TenantUnavailableError,
  type OrganizationAccess,
} from '../../src/integrations/tenant/tenant.client';

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
};
const OPTIONAL_ROW: MyEnrollmentRow = {
  id: ENROLLMENT_2,
  courseId: COURSE_2,
  enrollmentType: 'Optional',
  status: 'NotStarted',
  dueAt: null,
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
    page: 0,
    materials: 0,
    batch: [] as string[][],
    tenant: 0,
  };

  const enrollments = {
    countMine: () => {
      calls.count += 1;
      return Promise.resolve(options.total ?? rows.length);
    },
    findMinePage: (
      _learnerId: string,
      _organizationId: string,
      limit: number,
      offset: number,
    ) => {
      calls.page += 1;
      assert.equal(limit, MY_ENROLLMENTS_PAGE_SIZE);
      return Promise.resolve(rows.slice(offset, offset + limit));
    },
    countRequiredMaterials: (ids: string[]) => {
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
  const organizationTimezone = new OrganizationTimezoneService(tenant);

  const service = new EnrollmentsService(
    {} as never,
    enrollments as never,
    {} as never,
    {} as never,
    courseService as never,
    tenant,
    organizationTimezone,
  );
  const loggerError = mock.method(
    (service as unknown as { logger: Logger }).logger,
    'error',
    () => undefined,
  );
  const timezoneLoggerError = mock.method(
    (organizationTimezone as unknown as { logger: Logger }).logger,
    'error',
    () => undefined,
  );
  return { service, calls, loggerError, timezoneLoggerError };
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
      organizationTimezone: null,
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

  void test('header không phải UUID → rỗng, không chạm database', async () => {
    const { service, calls } = setup();
    const result = await service.findMyEnrollments(
      { ...LEARNER, organizationId: 'abc' },
      1,
    );
    assert.equal(result.meta.total, 0);
    assert.equal(calls.count, 0);
  });

  void test('đủ dữ liệu → đúng dạng từng phần tử; I3 gọi một lần cho các courseId của trang', async () => {
    const { service, calls } = setup();
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.deepEqual(calls.batch, [[COURSE_1, COURSE_2]]);
    assert.deepEqual(Object.keys(result).sort(), [
      'items',
      'meta',
      'organizationTimezone',
    ]);
    assert.equal(result.organizationTimezone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual(result.items[0], {
      enrollmentId: ENROLLMENT_1,
      courseId: COURSE_1,
      enrollmentType: 'Required',
      status: 'Overdue',
      dueAt: '2026-09-29T17:00:00.000Z',
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

  void test('tenant lỗi → organizationTimezone null + logger.error, vẫn trả danh sách', async () => {
    const { service, timezoneLoggerError } = setup({
      tenant: () => Promise.reject(new TenantUnavailableError('down')),
    });
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.equal(result.organizationTimezone, null);
    assert.equal(result.items.length, 2);
    assert.equal(timezoneLoggerError.mock.callCount(), 1);
  });

  void test('trang không có Required có hạn → không gọi tenant', async () => {
    const { service, calls } = setup({ rows: [OPTIONAL_ROW] });
    const result = await service.findMyEnrollments(LEARNER, 1);
    assert.equal(calls.tenant, 0);
    assert.equal(result.organizationTimezone, null);
  });
});

void describe('OrganizationTimezoneService (D24)', () => {
  void test('cache theo organizationId, TTL 5 phút; lần lỗi không được cache (đồng hồ giả)', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 0 });
    let fail = false;
    let calls = 0;
    const service = new OrganizationTimezoneService({
      getOrganizationAccess: () => {
        calls += 1;
        return fail
          ? Promise.reject(new TenantUnavailableError('down'))
          : Promise.resolve(ACCESS);
      },
    });
    mock.method(
      (service as unknown as { logger: Logger }).logger,
      'error',
      () => undefined,
    );

    assert.equal(await service.getTimezone(LEARNER), 'Asia/Ho_Chi_Minh');
    t.mock.timers.tick(5 * 60 * 1000 - 1);
    assert.equal(await service.getTimezone(LEARNER), 'Asia/Ho_Chi_Minh');
    assert.equal(calls, 1, 'trong TTL không gọi lại tenant');

    t.mock.timers.tick(1);
    fail = true;
    assert.equal(await service.getTimezone(LEARNER), null);
    assert.equal(calls, 2, 'hết TTL thì gọi lại');

    fail = false;
    assert.equal(await service.getTimezone(LEARNER), 'Asia/Ho_Chi_Minh');
    assert.equal(calls, 3, 'lần lỗi không được cache');

    const otherOrg = { ...LEARNER, organizationId: COURSE_1 };
    await service.getTimezone(otherOrg);
    assert.equal(calls, 4, 'tổ chức khác có cache riêng');
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
