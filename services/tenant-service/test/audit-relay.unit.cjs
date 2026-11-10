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

// A refusal (400: a time before 2020 or more than five minutes ahead) is not a reason to block the rows behind it, nor to try for ever.
function relayOf(rows, status) {
  const failures = new Map();
  const published = [];
  const outbox = {
    claimNextUnpublished: async (_type, excludeIds) => {
      const row = rows.find(
        (r) => !r.failedAt && !r.publishedAt && !excludeIds.includes(r.id) && (!r.nextAttemptAt || r.nextAttemptAt <= new Date()),
      );
      return row ? { id: row.id, payload: row.payload, attempts: row.attempts } : null;
    },
    recordFailure: async (id, state) => {
      failures.set(id, state);
      Object.assign(rows.find((r) => r.id === id), state);
    },
    markPublished: async (id) => {
      published.push(id);
      rows.find((r) => r.id === id).publishedAt = new Date();
    },
  };
  const prisma = { $transaction: async (fn) => fn({}) };
  const relay = new AuditRelayService(outbox, { ...config, get: () => 'http://audit.test' }, prisma);
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    return { ok: status(body) < 300, status: status(body) };
  };
  return { relay, failures, published };
}

const row = (id, occurredAt, attempts = 0) => ({
  id,
  attempts,
  payload: { ...record, occurredAt },
  failedAt: null,
  publishedAt: null,
  nextAttemptAt: null,
});

test('a row audit-service refuses with 400 is scheduled for a later try and the rows behind it are still sent', async () => {
  const rows = [row('bad', '1970-01-01T00:00:00.000Z'), row('good', '2026-11-05T10:00:00.000Z')];
  const { relay, failures, published } = relayOf(rows, (body) => (body.occurredAt.startsWith('1970') ? 400 : 201));
  await relay.runRound();
  assert.deepEqual(published, ['good']);
  const bad = failures.get('bad');
  assert.equal(bad.lastErrorCode, 'HTTP_400');
  assert.equal(bad.attempts, 1);
  assert.equal(bad.failedAt, null);
  assert.ok(bad.nextAttemptAt > new Date());
  // not due yet: the next round neither resends it nor is blocked by it
  rows.push(row('later', '2026-11-05T11:00:00.000Z'));
  await relay.runRound();
  assert.deepEqual(published, ['good', 'later']);
  assert.equal(failures.get('bad').attempts, 1);
});

test('after the last attempt the row is marked failed for good and is never taken again', async () => {
  const rows = [row('bad', '1970-01-01T00:00:00.000Z', 7), row('good', '2026-11-05T10:00:00.000Z')];
  const { relay, failures, published } = relayOf(rows, (body) => (body.occurredAt.startsWith('1970') ? 400 : 201));
  await relay.runRound();
  assert.deepEqual(published, ['good']);
  assert.equal(failures.get('bad').attempts, 8);
  assert.ok(failures.get('bad').failedAt instanceof Date);
  assert.equal(failures.get('bad').nextAttemptAt, null);
  await relay.runRound();
  assert.equal(failures.size, 1);
  assert.equal(failures.get('bad').attempts, 8);
});
