import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { AssignmentReadsService } from '../../src/modules/assignments/assignment-reads.service';

const user: CurrentUser = {
  userId: 'organizer',
  organizationId: 'organization',
  role: 'ORGANIZER',
  isAuthenticated: true,
};
function setup(
  empty = false,
  dueTimezone: string | null = 'Asia/Ho_Chi_Minh',
  organizationTimezone: string | null = null,
) {
  let accessCalls = 0;
  const row = {
    enrollmentId: 'enrollment',
    learnerId: 'learner',
    courseId: 'course',
    dueAt: dueTimezone ? new Date('2026-10-29T17:00:00Z') : null,
    dueTimezone,
    extensionSeconds: 0n,
  };
  const service = new AssignmentReadsService(
    {
      count: () => Promise.resolve(empty ? 0 : 1),
      page: () => Promise.resolve([row]),
      detail: () => Promise.resolve(row),
      intervals: () => Promise.resolve([]),
    } as never,
    { countRequiredMaterials: () => Promise.resolve(new Map()) } as never,
    {
      lookupLearners: () => Promise.resolve([]),
      getOrganizationAccess: () => {
        accessCalls++;
        return organizationTimezone
          ? Promise.resolve({
              timezone: organizationTimezone,
              organizationStatus: 'Active',
              subscriptionStatus: 'Active',
              readOnlyEndsAt: null,
            })
          : Promise.reject(new Error('Tenant unavailable'));
      },
    },
    { getCoursesBatch: () => Promise.resolve([]) } as never,
  );
  return { service, calls: () => accessCalls };
}
void describe('UC24 frozen deadline timezone', () => {
  for (const zone of ['Asia/Ho_Chi_Minh', 'Pacific/Auckland', null]) {
    void test(`list and detail return stored zone ${zone} with graceful Tenant access`, async () => {
      const { service, calls } = setup(false, zone);
      const page = await service.list(user, 1);
      assert.equal(calls(), 0);
      const detail = await service.detail(user, 'enrollment');
      assert.equal(page.items[0].dueTimezone, zone);
      assert.equal(detail.dueTimezone, zone);
      assert.ok(!('organizationTimezone' in page));
      assert.equal(detail.organizationTimezone, null);
      assert.equal(calls(), 1);
    });
  }
  void test('empty and overflow pages omit the response timezone', async () => {
    const { service, calls } = setup(true);
    for (const page of [1, 2]) {
      assert.deepEqual(await service.list(user, page), {
        items: [],
        page,
        pageSize: 20,
        total: 0,
      });
    }
    assert.equal(calls(), 0);
  });
});

void test('detail returns live organization zone without changing the frozen deadline', async () => {
  const { service } = setup(false, 'Asia/Ho_Chi_Minh', 'Pacific/Auckland');
  const detail = await service.detail(user, 'enrollment');
  assert.equal(detail.organizationTimezone, 'Pacific/Auckland');
  assert.equal(detail.dueTimezone, 'Asia/Ho_Chi_Minh');
});
void test('detail warns and degrades to null on tenant failure', async () => {
  const warn = mock.method(Logger.prototype, 'warn', () => undefined);
  try {
    const { service } = setup();
    assert.equal(
      (await service.detail(user, 'enrollment')).organizationTimezone,
      null,
    );
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), /tenant access/);
  } finally {
    warn.mock.restore();
  }
});
