import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import {
  createTenantClient,
  FAKE_TENANT_CLIENT_WARNING,
} from '../../src/infrastructure/clients/tenant/create-tenant-client';

const USER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: '0199a000-0000-7000-8000-0a0000000001',
  role: 'LEARNER',
  isAuthenticated: true,
};

function create(env: Record<string, string | undefined>) {
  const warnings: unknown[] = [];
  const client = createTenantClient((key) => env[key], {
    warn: (message: unknown) => warnings.push(message),
  });
  return { client, warnings };
}

void describe('createTenantClient', () => {
  void test('thiếu TENANT_CLIENT_MODE → lỗi khởi động', () => {
    assert.throws(() => create({}), /Thiếu TENANT_CLIENT_MODE/);
  });

  void test('mode lạ → lỗi khởi động', () => {
    assert.throws(
      () => create({ TENANT_CLIENT_MODE: 'mock' }),
      /TENANT_CLIENT_MODE không hợp lệ: "mock"/,
    );
  });

  void test('fake + NODE_ENV=production → lỗi khởi động', () => {
    assert.throws(
      () =>
        create({
          TENANT_CLIENT_MODE: 'fake',
          TENANT_FAKE_TIMEZONE: 'Asia/Ho_Chi_Minh',
          NODE_ENV: 'production',
        }),
      /NODE_ENV=production/,
    );
  });

  void test('http requires valid configuration', () => {
    assert.throws(
      () => create({ TENANT_CLIENT_MODE: 'http' }),
      /TENANT_SERVICE_URL/,
    );
  });

  void test('fake thiếu TENANT_FAKE_TIMEZONE → lỗi khởi động', () => {
    assert.throws(
      () => create({ TENANT_CLIENT_MODE: 'fake' }),
      /Thiếu TENANT_FAKE_TIMEZONE/,
    );
  });

  void test('fake với múi giờ không hợp lệ → lỗi khởi động', () => {
    assert.throws(
      () =>
        create({
          TENANT_CLIENT_MODE: 'fake',
          TENANT_FAKE_TIMEZONE: 'Mars/Olympus',
        }),
      /không phải múi giờ IANA hợp lệ/,
    );
  });

  void test('fake: có cảnh báo lúc tạo và trả đúng hình dạng', async () => {
    const { client, warnings } = create({
      TENANT_CLIENT_MODE: 'fake',
      TENANT_FAKE_TIMEZONE: 'Asia/Ho_Chi_Minh',
    });
    assert.deepEqual(warnings, [FAKE_TENANT_CLIENT_WARNING]);
    assert.deepEqual(await client.getOrganizationAccess(USER), {
      subscriptionStatus: 'Active',
      organizationStatus: 'Active',
      readOnlyEndsAt: null,
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });
});
