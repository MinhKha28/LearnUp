import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { TenantLookupHttp } from '../../src/infrastructure/clients/tenant/tenant-lookup.http';
import { TenantUnavailableError } from '../../src/infrastructure/clients/tenant/tenant.client';

test('tenant HTTP lookup unwraps data.items, forwards batch, reports network and timeout errors', async () => {
  const id = '0199a000-0000-7000-8000-0b0000000001';
  const user = {
    organizationId: '0199a000-0000-7000-8000-0a0000000001',
  } as CurrentUser;
  const items = [
    {
      userId: id,
      role: 'Learner',
      status: 'Pending',
      activatedAt: null,
      deletedAt: null,
      fullName: 'Test',
      email: 'test@example.test',
    },
  ];
  let stall = false;
  let malformed = false;
  let received: unknown;
  let receivedOrganizationId: string | string[] | undefined;
  const server = createServer(async (req, res) => {
    if (stall) return;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    received = JSON.parse(Buffer.concat(chunks).toString());
    receivedOrganizationId = req.headers[HEADER_NAMES.ORGANIZATION_ID];
    assert.equal(req.url, '/api/v1/internal/users/lookup');
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify(
        malformed
          ? { items }
          : { statusCode: 200, message: 'OK', data: { items } },
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.deepEqual(
      await new TenantLookupHttp(url, 'test', 1000).lookupLearners(user, [id]),
      items,
    );
    assert.deepEqual(received, {
      organizationId: user.organizationId,
      userIds: [id],
    });
    assert.ok(receivedOrganizationId);
    assert.equal(
      receivedOrganizationId,
      (received as { organizationId: string }).organizationId,
    );
    malformed = true;
    await assert.rejects(
      new TenantLookupHttp(url, 'test').lookupLearners(user, [id]),
      /data.items/,
    );
    stall = true;
    await assert.rejects(
      new TenantLookupHttp(url, 'test', 25).lookupLearners(user, [id]),
      (e) =>
        e instanceof TenantUnavailableError && /quá thời gian/.test(e.message),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await assert.rejects(
    new TenantLookupHttp(url, 'test', 1000).lookupLearners(user, [id]),
    (e) => e instanceof TenantUnavailableError && /lỗi mạng/.test(e.message),
  );
  assert.throws(
    () => TenantLookupHttp.fromConfig(() => undefined),
    /TENANT_SERVICE_URL/,
  );
});
