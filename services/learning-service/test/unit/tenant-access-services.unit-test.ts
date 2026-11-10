import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { HttpException, Logger } from '@nestjs/common';
import { AssignmentsService } from '../../src/modules/assignments/assignments.service';
import { AssignmentChangesService } from '../../src/modules/assignments/assignment-changes.service';
import {
  TenantOrganizationNotFoundError,
  TenantUnavailableError,
  type OrganizationAccess,
} from '../../src/infrastructure/clients/tenant/tenant.client';

const user = {
  organizationId: '01900000-0000-7000-8000-00000000a001',
  userId: 'actor',
  role: 'ORGANIZER',
  isAuthenticated: true,
} as CurrentUser;
for (const action of ['assign', 'extend', 'exempt'] as const) {
  for (const [label, access, status, code] of [
    [
      'Suspended with Active subscription',
      { organizationStatus: 'Suspended', subscriptionStatus: 'Active' },
      403,
      'ORGANIZATION_NOT_ACTIVE',
    ],
    [
      'PendingPayment before Grace',
      { organizationStatus: 'PendingPayment', subscriptionStatus: 'Grace' },
      403,
      'ORGANIZATION_NOT_ACTIVE',
    ],
    [
      'Cancelled organization',
      { organizationStatus: 'Cancelled', subscriptionStatus: 'Active' },
      403,
      'ORGANIZATION_NOT_ACTIVE',
    ],
    [
      'Active with Grace subscription',
      { organizationStatus: 'Active', subscriptionStatus: 'Grace' },
      403,
      'SUBSCRIPTION_NOT_ACTIVE',
    ],
    [
      'tenant down',
      new TenantUnavailableError('network'),
      503,
      'SERVICE_UNAVAILABLE',
    ],
    [
      'missing organization',
      new TenantOrganizationNotFoundError(),
      403,
      'ORGANIZATION_NOT_ACTIVE',
    ],
  ] as const)
    void test(`${action}: ${label}`, async () => {
      let downstreamCalls = 0;
      const downstream = () => {
        downstreamCalls++;
        throw new Error('must not write');
      };
      const tenant = {
        getOrganizationAccess: (): Promise<OrganizationAccess> => {
          if (access instanceof Error) return Promise.reject(access);
          return Promise.resolve({
            ...access,
            timezone: 'Asia/Ho_Chi_Minh',
            readOnlyEndsAt: null,
          });
        },
        lookupLearners: downstream,
      };
      const assignments = new AssignmentsService(
        { $transaction: downstream } as never,
        { findExisting: downstream } as never,
        tenant,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const changes = new AssignmentChangesService(
        { $transaction: downstream } as never,
        {} as never,
        {} as never,
        { resolveTimezoneName: downstream } as never,
        tenant,
      );
      const warn = mock.method(Logger.prototype, 'warn', () => undefined);
      try {
        const result =
          action === 'assign'
            ? assignments.assign(user, {
                courseId: 'course',
                learnerIds: ['learner'],
              })
            : action === 'extend'
              ? changes.extend(user, 'enrollment', { newDueDate: '2027-10-30' })
              : changes.exempt(user, 'enrollment', { reason: 'test' });
        await assert.rejects(result, (e: unknown) => {
          assert.ok(e instanceof HttpException);
          assert.equal(e.getStatus(), status);
          const body = e.getResponse() as { code: string; message: string };
          assert.equal(body.code, code);
          if (code === 'ORGANIZATION_NOT_ACTIVE')
            assert.equal(
              body.message,
              'Tổ chức hiện không hoạt động. Vui lòng liên hệ quản trị viên nền tảng.',
            );
          return true;
        });
        assert.equal(downstreamCalls, 0);
      } finally {
        warn.mock.restore();
      }
    });
}
