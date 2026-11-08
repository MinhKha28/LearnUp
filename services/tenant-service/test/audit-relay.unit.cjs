const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const {
  AuditRelayService,
} = require('../dist/src/modules/outbox/audit-relay.service');

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const config = {
  getOrThrow: (key) => {
    assert.equal(key, 'INTERNAL_SERVICE_KEY');
    return 'unit-test-internal-key-0123456789abcdef';
  },
};
const service = new AuditRelayService({}, config, {});

const record = {
  organizationId: '0199a000-0000-7000-8000-0a0000000001',
  actorUserId: '0199a000-0000-7000-8000-0b00000000aa',
  actorRole: 'ORGANIZER',
  actionType: 'INSTRUCTOR_DEACTIVATED',
  targetResourceType: 'User',
  targetResourceId: '0199a000-0000-7000-8000-0c00000000bb',
  details: { reason: 'Vi phạm nội quy', receiverId: null, chainIds: [] },
  occurredAt: '2026-11-05T10:00:00.000Z',
};

async function sendOnce(status = 201) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 300, status };
  };
  const result = await service.deliver(
    'http://audit.test',
    'event-1',
    record,
    1000,
  );
  return { calls, result };
}

test('the audit body carries the time of the action, so a late retry is not dated by its delivery', async () => {
  const { calls, result } = await sendOnce();
  assert.equal(result, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://audit.test/api/v1/audit/logs');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.occurredAt, '2026-11-05T10:00:00.000Z');
  assert.equal(body.correlationId, 'event-1');
});

test('the rest of the body is what audit-service already reads: who, what, on what, reason', async () => {
  const { calls } = await sendOnce();
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.organizationId, record.organizationId);
  assert.equal(body.actorUserId, record.actorUserId);
  assert.equal(body.actorRole, 'ORGANIZER');
  assert.equal(body.actionType, 'INSTRUCTOR_DEACTIVATED');
  assert.equal(body.targetResourceType, 'User');
  assert.equal(body.targetResourceId, record.targetResourceId);
  const details = JSON.parse(body.details);
  assert.equal(details.reason, 'Vi phạm nội quy');
  assert.equal(details.occurredAt, '2026-11-05T10:00:00.000Z');
});

test('it speaks as a service: the internal key and no user context', async () => {
  const { calls } = await sendOnce();
  const headers = calls[0].init.headers;
  assert.equal(headers['x-internal-key'], 'unit-test-internal-key-0123456789abcdef');
  for (const name of ['X-User-ID', 'X-User-Role', 'X-Organization-ID', 'Authorization']) {
    assert.equal(headers[name], undefined, name);
  }
});

test('a refusal or a network failure becomes an error code, not an exception', async () => {
  assert.equal((await sendOnce(400)).result, 'HTTP_400');
  assert.equal((await sendOnce(503)).result, 'HTTP_503');
  global.fetch = async () => {
    throw Object.assign(new Error('down'), { name: 'TypeError' });
  };
  assert.equal(await service.deliver('http://audit.test', 'e', record, 1000), 'NETWORK');
  global.fetch = async () => {
    throw Object.assign(new Error('slow'), { name: 'TimeoutError' });
  };
  assert.equal(await service.deliver('http://audit.test', 'e', record, 1000), 'TIMEOUT');
});
