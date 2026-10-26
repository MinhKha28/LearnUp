const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');
const { Logger } = require('@nestjs/common');
const {
  EmailRelayService,
  RELAY_BATCH_SIZE,
} = require('../dist/src/modules/outbox/email-relay.service');
const {
  OutboxRepository,
} = require('../dist/src/modules/outbox/outbox.repository');

const secretBody =
  'Mã xác thực của bạn là 482913. Liên kết: https://app.test/r?token=secret-token';
const email = {
  to: 'guest@example.test',
  subject: 'Xác thực email',
  body: secretBody,
  templateCode: 'REGISTRATION_OTP',
};

const logs = [];
const originalFetch = global.fetch;
beforeEach(() => {
  logs.length = 0;
  const capture = (level) => (message) =>
    logs.push({ level, message: String(message) });
  Logger.overrideLogger({
    log: capture('log'),
    warn: capture('warn'),
    error: capture('error'),
    debug: capture('debug'),
    verbose: capture('verbose'),
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

const createRelay = ({ env = {}, events = [], fail = {} } = {}) => {
  const pending = events.map((id) => ({ id, payload: { ...email } }));
  const published = [];
  const transactions = [];
  const repository = {
    claimNextUnpublished: async (eventType, excludeIds) => {
      assert.equal(eventType, 'EmailRequested');
      if (fail.claim) throw new Error('database unavailable');
      return pending.find((event) => !excludeIds.includes(event.id)) ?? null;
    },
    markPublished: async (id, payload) => {
      published.push({ id, payload });
      const index = pending.findIndex((event) => event.id === id);
      pending.splice(index, 1);
    },
  };
  const config = {
    get: (key) =>
      ({
        NOTIFICATION_SERVICE_URL: 'http://notification.test',
        INTERNAL_SERVICE_KEY: 'relay-unit-test-key',
        ...env,
      })[key],
    getOrThrow: (key) => config.get(key),
  };
  const prisma = {
    $transaction: async (fn, options) => {
      transactions.push(options);
      return fn({});
    },
  };
  const relay = new EmailRelayService(repository, config, prisma);
  return { relay, published, pending, transactions };
};

const respondWith = (status, data = { status: 'SENT' }) => {
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, init });
    return {
      ok: status < 400,
      status,
      json: async () => ({ success: true, data }),
    };
  };
  return requests;
};

const loggedText = () => logs.map((entry) => entry.message).join('\n');

test('sends an email, then stores only the redacted payload', async () => {
  const requests = respondWith(201);
  const { relay, published, transactions } = createRelay({ events: ['e1'] });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    'http://notification.test/api/notifications/email/send',
  );
  assert.equal(
    requests[0].init.headers['x-internal-key'],
    'relay-unit-test-key',
  );
  assert.ok(requests[0].init.signal instanceof AbortSignal);
  assert.deepEqual(published, [
    {
      id: 'e1',
      payload: {
        to: email.to,
        templateCode: email.templateCode,
        redacted: true,
      },
    },
  ]);
  assert.ok(transactions[0].timeout > transactions[0].maxWait);
});

for (const [name, setup] of [
  ['an HTTP error', () => respondWith(503)],
  [
    'an SMTP failure',
    () => respondWith(201, { status: 'FAILED', errorMessage: 'mailbox full' }),
  ],
  [
    'a timeout',
    () => {
      global.fetch = async () => {
        throw new DOMException(
          'The operation was aborted due to timeout',
          'TimeoutError',
        );
      };
    },
  ],
]) {
  test(`keeps the email pending after ${name}, without logging its body`, async () => {
    setup();
    const { relay, published, pending } = createRelay({ events: ['e1'] });
    await relay.relayPendingEmails();
    assert.equal(published.length, 0);
    assert.equal(pending.length, 1);
    assert.match(loggedText(), /e1/);
    assert.doesNotMatch(loggedText(), /482913|secret-token/);
  });
}

test('tries each pending email once per round, so a failing one does not block the others', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, status: 500, json: async () => ({}) }
      : {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { status: 'SENT' } }),
        };
  };
  const { relay, published, pending } = createRelay({
    events: ['e1', 'e2', 'e3'],
  });
  await relay.relayPendingEmails();
  assert.equal(calls, 3);
  assert.deepEqual(
    published.map((item) => item.id),
    ['e2', 'e3'],
  );
  assert.deepEqual(
    pending.map((item) => item.id),
    ['e1'],
  );
});

test(`sends at most ${RELAY_BATCH_SIZE} emails per round`, async () => {
  const requests = respondWith(201);
  const ids = Array.from(
    { length: RELAY_BATCH_SIZE + 5 },
    (_, index) => `e${index}`,
  );
  const { relay, pending } = createRelay({ events: ids });
  await relay.relayPendingEmails();
  assert.equal(requests.length, RELAY_BATCH_SIZE);
  assert.equal(pending.length, 5);
});

for (const nodeEnv of [undefined, 'production', 'test']) {
  test(`without NOTIFICATION_SERVICE_URL and NODE_ENV=${nodeEnv}, keeps emails pending and never logs them`, async () => {
    const requests = respondWith(201);
    const { relay, published, pending } = createRelay({
      env: { NOTIFICATION_SERVICE_URL: '  ', NODE_ENV: nodeEnv },
      events: ['e1'],
    });
    await relay.relayPendingEmails();
    await relay.relayPendingEmails();
    assert.equal(requests.length, 0);
    assert.equal(published.length, 0);
    assert.equal(pending.length, 1);
    assert.equal(logs.filter((entry) => entry.level === 'error').length, 1);
    assert.doesNotMatch(loggedText(), /482913|secret-token|guest@example/);
  });
}

test('in development without NOTIFICATION_SERVICE_URL, prints the email to the log instead of sending', async () => {
  const requests = respondWith(201);
  const { relay, published } = createRelay({
    env: { NOTIFICATION_SERVICE_URL: '', NODE_ENV: 'development' },
    events: ['e1'],
  });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 0);
  assert.equal(published.length, 1);
  assert.match(loggedText(), /\[DEV EMAIL\][\s\S]*482913/);
});

test('stops the round when the outbox cannot be read', async () => {
  const requests = respondWith(201);
  const { relay } = createRelay({ events: ['e1'], fail: { claim: true } });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 0);
  assert.match(loggedText(), /database unavailable/);
});

test('skips a round while the previous one is still running', async () => {
  let release;
  global.fetch = () =>
    new Promise((resolve) => {
      release = () =>
        resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { status: 'SENT' } }),
        });
    });
  const { relay, published } = createRelay({ events: ['e1'] });
  const first = relay.relayPendingEmails();
  await new Promise((resolve) => setImmediate(resolve));
  await relay.relayPendingEmails();
  release();
  await first;
  assert.equal(published.length, 1);
});

test('uses the configured timeout, falling back to 5000 ms for invalid values', async () => {
  respondWith(201);
  for (const [value, expected] of [
    ['2500', 2500],
    ['abc', 5000],
    ['0', 5000],
    [undefined, 5000],
  ]) {
    const { relay, transactions } = createRelay({
      env: { NOTIFICATION_SERVICE_TIMEOUT_MS: value },
      events: ['e1'],
    });
    await relay.relayPendingEmails();
    assert.equal(transactions[0].maxWait, expected, String(value));
  }
});

test('claims with FOR UPDATE SKIP LOCKED, excluding emails already tried', async () => {
  const queries = [];
  const repository = new OutboxRepository({});
  const tx = {
    $queryRaw: async (strings, ...values) => {
      queries.push({ sql: strings.join('?'), values });
      return [];
    },
  };
  assert.equal(
    await repository.claimNextUnpublished('EmailRequested', ['e1'], tx),
    null,
  );
  const sql = queries[0].sql.replace(/\s+/g, ' ');
  assert.match(sql, /published_at IS NULL/);
  assert.match(sql, /NOT \(id = ANY\(\?::uuid\[\]\)\)/);
  assert.match(sql, /ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(queries[0].values, ['EmailRequested', ['e1']]);
});
