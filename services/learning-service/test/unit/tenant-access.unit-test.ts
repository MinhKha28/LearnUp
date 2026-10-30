import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { Logger } from '@nestjs/common';
import { TenantAccessHttp } from '../../src/infrastructure/clients/tenant/tenant-access.http';
import {
  TenantOrganizationNotFoundError,
  TenantUnavailableError,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import { createTenantClient } from '../../src/infrastructure/clients/tenant/create-tenant-client';

const user: CurrentUser = {
  userId: '01900000-0000-7000-8000-00000000a010',
  organizationId: '01900000-0000-7000-8000-00000000a001',
  role: 'ORGANIZER',
  isAuthenticated: true,
};
const data = {
  organizationId: user.organizationId,
  organizationStatus: 'Active',
  subscriptionStatus: 'Active',
  readOnlyEndsAt: null,
  timezone: 'Asia/Ho_Chi_Minh',
};
async function withResponse(
  body: unknown,
  status: number,
  run: (client: TenantAccessHttp) => Promise<void>,
) {
  const fetchMock = mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
  try {
    await run(new TenantAccessHttp('http://tenant.test', 'synthetic-unit-key'));
  } finally {
    fetchMock.mock.restore();
  }
}

void test('access unwraps data, accepts mixed-case UUIDs and sends exactly the two trusted headers', async () => {
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    (url: unknown, init?: RequestInit) => {
      assert.equal(
        url,
        `http://tenant.test/api/v1/internal/organizations/${user.organizationId}/access`,
      );
      assert.equal(init?.method, 'GET');
      assert.deepEqual(init?.headers, {
        [HEADER_NAMES.INTERNAL_KEY]: 'synthetic-unit-key',
        [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId,
      });
      assert.equal(init?.body, undefined);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'OK',
            data: {
              ...data,
              organizationId: user.organizationId!.toUpperCase(),
            },
          }),
        ),
      );
    },
  );
  try {
    assert.deepEqual(
      await new TenantAccessHttp(
        'http://tenant.test',
        'synthetic-unit-key',
      ).getOrganizationAccess(user),
      {
        organizationStatus: 'Active',
        subscriptionStatus: 'Active',
        readOnlyEndsAt: null,
        timezone: new Intl.DateTimeFormat('en', {
          timeZone: data.timezone,
        }).resolvedOptions().timeZone,
      },
    );
  } finally {
    fetchMock.mock.restore();
  }
});

void test('access parses the ISO read-only end into a Date', async () => {
  const iso = '2026-10-30T12:34:56.123Z';
  await withResponse(
    { data: { ...data, subscriptionStatus: 'Suspended', readOnlyEndsAt: iso } },
    200,
    async (client) => {
      const result = await client.getOrganizationAccess(user);
      assert.ok(result.readOnlyEndsAt instanceof Date);
      assert.equal(result.readOnlyEndsAt.toISOString(), iso);
    },
  );
});
for (const organizationStatus of [
  'PendingPayment',
  'Active',
  'Suspended',
  'Cancelled',
])
  void test(`access accepts organization status ${organizationStatus}`, async () => {
    await withResponse(
      { data: { ...data, organizationStatus } },
      200,
      async (client) => {
        assert.equal(
          (await client.getOrganizationAccess(user)).organizationStatus,
          organizationStatus,
        );
      },
    );
  });
for (const subscriptionStatus of ['Active', 'Grace', 'Suspended', 'Ended'])
  void test(`access accepts subscription status ${subscriptionStatus}`, async () => {
    await withResponse(
      { data: { ...data, subscriptionStatus } },
      200,
      async (client) => {
        assert.equal(
          (await client.getOrganizationAccess(user)).subscriptionStatus,
          subscriptionStatus,
        );
      },
    );
  });
for (const [label, change] of [
  ['organization enum', { organizationStatus: 'Disabled' }],
  ['organization enum type', { organizationStatus: 1 }],
  ['subscription enum', { subscriptionStatus: 'Scheduled' }],
  ['subscription enum type', { subscriptionStatus: ['Active'] }],
  [
    'organization mismatch',
    { organizationId: '01900000-0000-7000-8000-00000000b001' },
  ],
  ['missing organization', { organizationId: undefined }],
  ['timezone', { timezone: 'Mars/Olympus' }],
  ['missing timezone', { timezone: undefined }],
  ['invalid read-only date', { readOnlyEndsAt: 'not-a-date' }],
  ['non-ISO date', { readOnlyEndsAt: 'October 30, 2026' }],
  ['numeric date', { readOnlyEndsAt: 123 }],
  ['missing read-only date', { readOnlyEndsAt: undefined }],
] as const)
  void test(`access fails closed for ${label}`, async () => {
    await withResponse(
      { data: { ...data, ...change } },
      200,
      async (client) => {
        await assert.rejects(
          client.getOrganizationAccess(user),
          TenantUnavailableError,
        );
      },
    );
  });
for (const body of [null, [], {}, { data: null }, { data: [] }, { ...data }])
  void test(`access rejects a missing or malformed data envelope: ${JSON.stringify(body)}`, async () => {
    await withResponse(body, 200, async (client) => {
      await assert.rejects(
        client.getOrganizationAccess(user),
        TenantUnavailableError,
      );
    });
  });
void test('only the recognized organization 404 blocks, logging organizationId', async () => {
  const logs: unknown[] = [];
  const logger = mock.method(Logger.prototype, 'error', (message: unknown) => {
    logs.push(message);
  });
  try {
    await withResponse(
      { statusCode: 404, error: { code: 'ORGANIZATION_NOT_FOUND' } },
      404,
      async (client) => {
        await assert.rejects(
          client.getOrganizationAccess(user),
          TenantOrganizationNotFoundError,
        );
      },
    );
    assert.equal(logs.length, 1);
    assert.ok(String(logs[0]).includes(user.organizationId!));
  } finally {
    logger.mock.restore();
  }
});
for (const status of [400, 401, 403, 404, 429, 500, 503])
  void test(`unrecognized HTTP ${status} is unavailable`, async () => {
    await withResponse(
      { error: { code: 'OTHER_ERROR' } },
      status,
      async (client) => {
        await assert.rejects(
          client.getOrganizationAccess(user),
          TenantUnavailableError,
        );
      },
    );
  });
void test('malformed JSON is unavailable', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response('not JSON')),
  );
  try {
    await assert.rejects(
      new TenantAccessHttp('http://tenant.test', 'test').getOrganizationAccess(
        user,
      ),
      TenantUnavailableError,
    );
  } finally {
    fetchMock.mock.restore();
  }
});
void test('missing caller organization fails closed without a request', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', () =>
    Promise.reject(new Error('must not fetch')),
  );
  try {
    await assert.rejects(
      new TenantAccessHttp('http://tenant.test', 'test').getOrganizationAccess({
        ...user,
        organizationId: undefined,
      }),
      TenantUnavailableError,
    );
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
  }
});
void test('real HTTP timeout and network failure are unavailable; startup does not call tenant', async () => {
  const server = createServer(() => undefined);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const config: Record<string, string> = {
    TENANT_CLIENT_MODE: 'http',
    TENANT_SERVICE_URL: url,
    INTERNAL_SERVICE_KEY: 'test',
    TENANT_SERVICE_TIMEOUT_MS: '25',
  };
  try {
    const client = createTenantClient((key) => config[key], {
      warn: () => undefined,
    });
    await assert.rejects(
      client.getOrganizationAccess(user),
      (e: unknown) =>
        e instanceof TenantUnavailableError && /timed out/.test(e.message),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  const client = createTenantClient((key) => config[key], {
    warn: () => undefined,
  });
  await assert.rejects(
    client.getOrganizationAccess(user),
    TenantUnavailableError,
  );
});
for (const change of [
  { TENANT_SERVICE_URL: undefined },
  { TENANT_SERVICE_URL: 'garbage' },
  { TENANT_SERVICE_URL: 'ftp://tenant.test' },
  { TENANT_SERVICE_URL: 'http://user:pass@tenant.test' },
  { TENANT_SERVICE_URL: 'http://tenant.test?key=x' },
  { TENANT_SERVICE_URL: 'http://tenant.test#x' },
  { INTERNAL_SERVICE_KEY: ' ' },
  { TENANT_SERVICE_TIMEOUT_MS: '0' },
  { TENANT_SERVICE_TIMEOUT_MS: '-1' },
  { TENANT_SERVICE_TIMEOUT_MS: '1.5' },
  { TENANT_SERVICE_TIMEOUT_MS: 'bad' },
])
  void test(`access validates startup configuration ${JSON.stringify(change)}`, () => {
    const config: Record<string, string | undefined> = {
      TENANT_SERVICE_URL: 'http://tenant.test',
      INTERNAL_SERVICE_KEY: 'test',
      ...change,
    };
    assert.throws(() => TenantAccessHttp.fromConfig((key) => config[key]));
  });

void test('access canonicalizes mixed-case tenant timezone identifiers', async () => {
  await withResponse(
    { data: { ...data, timezone: 'Asia/TOKYO' } },
    200,
    async (client) => {
      assert.equal(
        (await client.getOrganizationAccess(user)).timezone,
        'Asia/Tokyo',
      );
    },
  );
});
