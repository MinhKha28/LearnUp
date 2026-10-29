import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { AssignmentReadsService } from '../../src/modules/assignments/assignment-reads.service';
import { OrganizationTimezoneService } from '../../src/infrastructure/clients/tenant/organization-timezone.service';

const user: CurrentUser = {
  userId: 'organizer',
  organizationId: 'organization',
  role: 'ORGANIZER',
  isAuthenticated: true,
};

function setup(fail = false, empty = false) {
  let calls = 0;
  const timezone = new OrganizationTimezoneService({
    getOrganizationAccess: async () => {
      calls++;
      if (fail) throw new Error('Tenant unavailable');
      return {
        subscriptionStatus: 'Active',
        organizationStatus: 'Active',
        readOnlyEndsAt: null,
        timezone: 'Asia/Ho_Chi_Minh',
      };
    },
  });
  const row = {
    enrollmentId: 'enrollment',
    learnerId: 'learner',
    courseId: 'course',
    dueAt: new Date(),
    extensionSeconds: 0n,
  };
  const service = new AssignmentReadsService(
    {
      count: async () => (empty ? 0 : 1),
      page: async () => [row],
      detail: async () => row,
      intervals: async () => [],
    } as never,
    { countRequiredMaterials: async () => new Map() } as never,
    { lookupLearners: async () => [] } as never,
    { getCoursesBatch: async () => [] } as never,
    timezone,
  );
  return { service, calls: () => calls };
}

describe('UC24 organization timezone', () => {
  test('list and detail reuse the UC26 organization cache', async () => {
    const { service, calls } = setup();
    assert.equal(
      (await service.list(user, 1)).organizationTimezone,
      'Asia/Ho_Chi_Minh',
    );
    assert.equal(
      (await service.detail(user, 'enrollment')).organizationTimezone,
      'Asia/Ho_Chi_Minh',
    );
    assert.equal(calls(), 1);
  });
  test('tenant failure returns null without caching the failure', async () => {
    const { service, calls } = setup(true);
    assert.equal((await service.list(user, 1)).organizationTimezone, null);
    assert.equal(
      (await service.detail(user, 'enrollment')).organizationTimezone,
      null,
    );
    assert.equal(calls(), 2);
  });
  for (const knownTimezone of ['America/New_York', null]) {
    test(`known timezone ${knownTimezone} avoids tenant access`, async () => {
      const { service, calls } = setup();
      assert.equal(
        (await service.detail(user, 'enrollment', knownTimezone))
          .organizationTimezone,
        knownTimezone,
      );
      assert.equal(calls(), 0);
    });
  }
  test('empty and overflow pages include null without tenant access', async () => {
    const { service, calls } = setup(false, true);
    for (const page of [1, 2]) {
      const result = await service.list(user, page);
      assert.deepEqual(result.items, []);
      assert.equal(result.organizationTimezone, null);
    }
    assert.equal(calls(), 0);
  });
});
