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
const {
  OUTBOX_MAX_ATTEMPTS,
  isEmailExpired,
  nextRetryState,
} = require('../dist/src/modules/outbox/outbox-retry.policy');

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
  const rows = events.map((event) =>
    typeof event === 'string'
      ? { id: event, attempts: 0, nextAttemptAt: null, failedAt: null }
      : { attempts: 0, nextAttemptAt: null, failedAt: null, ...event },
  );
  rows.forEach(
    (row) =>
      (row.payload = {
        ...email,
        ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
      }),
  );
  const published = [];
  const failures = [];
  const expired = [];
  const transactions = [];
  const due = (row) =>
    !row.publishedAt &&
    !row.failedAt &&
    (!row.nextAttemptAt || row.nextAttemptAt <= new Date());
  const repository = {
    claimNextUnpublished: async (eventType, excludeIds) => {
      assert.equal(eventType, 'EmailRequested');
      if (fail.claim) throw new Error('connection refused to db.internal:5432');
      const row = rows.find(
        (item) => due(item) && !excludeIds.includes(item.id),
      );
      return row
        ? { id: row.id, payload: row.payload, attempts: row.attempts }
        : null;
    },
    markPublished: async (id, payload) => {
      if (fail.markPublished) throw new Error('write failed');
      published.push({ id, payload });
      rows.find((item) => item.id === id).publishedAt = new Date();
    },
    markExpired: async (id, payload, now) => {
      expired.push({ id, payload, now });
      Object.assign(
        rows.find((item) => item.id === id),
        { failedAt: now, lastErrorCode: 'EXPIRED', payload },
      );
    },
    recordFailure: async (id, state) => {
      failures.push({ id, ...state });
      Object.assign(
        rows.find((item) => item.id === id),
        state,
      );
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
  const pending = () => rows.filter((row) => !row.publishedAt);
  return { relay, rows, published, failures, expired, pending, transactions };
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
  const { relay, published, failures, transactions } = createRelay({
    events: ['e1'],
  });
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
  assert.equal(failures.length, 0);
  assert.ok(transactions[0].timeout > transactions[0].maxWait);
});

for (const [name, setup, code] of [
  ['an HTTP error', () => respondWith(503), 'HTTP_503'],
  [
    'an SMTP failure',
    () =>
      respondWith(201, {
        status: 'FAILED',
        errorMessage: 'mailbox guest@example.test full',
      }),
    'SMTP_FAILED',
  ],
  [
    'a timeout',
    () => {
      global.fetch = async () => {
        throw new DOMException('signal timed out', 'TimeoutError');
      };
    },
    'TIMEOUT',
  ],
  [
    'a network error',
    () => {
      global.fetch = async () => {
        throw new TypeError('fetch failed: getaddrinfo notification.test');
      };
    },
    'NETWORK',
  ],
  [
    'an invalid response body',
    () => {
      global.fetch = async () => ({
        ok: true,
        status: 201,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      });
    },
    'INVALID_RESPONSE',
  ],
]) {
  test(`records ${code} after ${name} and logs only the event id and code`, async () => {
    setup();
    const { relay, published, failures } = createRelay({ events: ['e1'] });
    const before = Date.now();
    await relay.relayPendingEmails();
    assert.equal(published.length, 0);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].attempts, 1);
    assert.equal(failures[0].lastErrorCode, code);
    assert.equal(failures[0].failedAt, null);
    assert.ok(failures[0].nextAttemptAt.getTime() >= before + 5000);
    assert.match(loggedText(), new RegExp(`e1.*${code}`));
    assert.doesNotMatch(
      loggedText(),
      /482913|secret-token|guest@example|getaddrinfo|Unexpected token/,
    );
  });
}

test('backoff doubles from 5 s, and the 8th failure is permanent', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  const delays = [];
  for (let previous = 0; previous < OUTBOX_MAX_ATTEMPTS - 1; previous++) {
    const state = nextRetryState(previous, 'HTTP_503', now);
    assert.equal(state.attempts, previous + 1);
    assert.equal(state.failedAt, null);
    delays.push(state.nextAttemptAt.getTime() - now.getTime());
  }
  assert.deepEqual(
    delays,
    [5, 10, 20, 40, 80, 160, 320].map((s) => s * 1000),
  );
  const last = nextRetryState(OUTBOX_MAX_ATTEMPTS - 1, 'SMTP_FAILED', now);
  assert.deepEqual(last, {
    attempts: OUTBOX_MAX_ATTEMPTS,
    lastErrorCode: 'SMTP_FAILED',
    nextAttemptAt: null,
    failedAt: now,
  });
});

test('backoff never exceeds 10 minutes', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  const state = nextRetryState(5, 'TIMEOUT', now);
  assert.ok(state.nextAttemptAt.getTime() - now.getTime() <= 10 * 60 * 1000);
});

test('the last failure marks the email failed and logs it as an error', async () => {
  respondWith(503);
  const { relay, failures } = createRelay({
    events: [{ id: 'e1', attempts: OUTBOX_MAX_ATTEMPTS - 1 }],
  });
  await relay.relayPendingEmails();
  assert.equal(failures[0].attempts, OUTBOX_MAX_ATTEMPTS);
  assert.ok(failures[0].failedAt instanceof Date);
  assert.equal(failures[0].nextAttemptAt, null);
  const errors = logs.filter((entry) => entry.level === 'error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /e1 failed permanently \(HTTP_503\)/);
});

test(`${RELAY_BATCH_SIZE} failing emails no longer block a newer one`, async () => {
  let calls = 0;
  global.fetch = async (_url, init) => {
    calls += 1;
    const ok = JSON.parse(init.body).subject === 'new';
    return {
      ok,
      status: ok ? 201 : 500,
      json: async () => ({ success: true, data: { status: 'SENT' } }),
    };
  };
  const failing = Array.from({ length: RELAY_BATCH_SIZE }, (_, i) => `f${i}`);
  const { relay, rows, published } = createRelay({
    events: [...failing, 'new'],
  });
  rows.find((row) => row.id === 'new').payload.subject = 'new';
  await relay.relayPendingEmails();
  assert.equal(calls, RELAY_BATCH_SIZE);
  assert.equal(published.length, 0);
  await relay.relayPendingEmails();
  assert.deepEqual(
    published.map((item) => item.id),
    ['new'],
  );
  assert.equal(calls, RELAY_BATCH_SIZE + 1);
});

test('emails waiting for their next attempt or already failed are skipped', async () => {
  const requests = respondWith(201);
  const { relay, published } = createRelay({
    events: [
      { id: 'later', nextAttemptAt: new Date(Date.now() + 60_000) },
      { id: 'dead', failedAt: new Date() },
      { id: 'due', attempts: 2, nextAttemptAt: new Date(Date.now() - 1000) },
    ],
  });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 1);
  assert.deepEqual(
    published.map((item) => item.id),
    ['due'],
  );
});

test(`sends at most ${RELAY_BATCH_SIZE} emails per round`, async () => {
  const requests = respondWith(201);
  const ids = Array.from({ length: RELAY_BATCH_SIZE + 5 }, (_, i) => `e${i}`);
  const { relay, pending } = createRelay({ events: ids });
  await relay.relayPendingEmails();
  assert.equal(requests.length, RELAY_BATCH_SIZE);
  assert.equal(pending().length, 5);
});

for (const nodeEnv of [undefined, 'production', 'test']) {
  test(`without NOTIFICATION_SERVICE_URL and NODE_ENV=${nodeEnv}, keeps emails pending and never logs them`, async () => {
    const requests = respondWith(201);
    const { relay, published, failures, pending } = createRelay({
      env: { NOTIFICATION_SERVICE_URL: '  ', NODE_ENV: nodeEnv },
      events: ['e1'],
    });
    await relay.relayPendingEmails();
    await relay.relayPendingEmails();
    assert.equal(requests.length, 0);
    assert.equal(published.length, 0);
    assert.equal(failures.length, 0);
    assert.equal(pending().length, 1);
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

test('stops the round when the outbox cannot be read, logging a fixed code only', async () => {
  const requests = respondWith(201);
  const { relay } = createRelay({ events: ['e1'], fail: { claim: true } });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 0);
  assert.match(loggedText(), /DATABASE_ERROR/);
  assert.doesNotMatch(loggedText(), /db\.internal/);
});

test('a database error after sending keeps the email pending without counting an attempt', async () => {
  respondWith(201);
  const { relay, failures, pending } = createRelay({
    events: ['e1'],
    fail: { markPublished: true },
  });
  await relay.relayPendingEmails();
  assert.equal(failures.length, 0);
  assert.equal(pending().length, 1);
  assert.match(loggedText(), /e1.*DATABASE_ERROR/);
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

test('on shutdown, waits for the running round and starts no new one', async () => {
  let release;
  const requests = [];
  global.fetch = (url) =>
    new Promise((resolve) => {
      requests.push(url);
      release = () =>
        resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { status: 'SENT' } }),
        });
    });
  const { relay, published } = createRelay({ events: ['e1', 'e2'] });
  const round = relay.relayPendingEmails();
  await new Promise((resolve) => setImmediate(resolve));
  let destroyed = false;
  const destroy = relay.onModuleDestroy().then(() => (destroyed = true));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(destroyed, false);
  release();
  await Promise.all([round, destroy]);
  assert.equal(destroyed, true);
  assert.deepEqual(
    published.map((item) => item.id),
    ['e1'],
  );
  await relay.relayPendingEmails();
  assert.equal(requests.length, 1);
});

test('on shutdown, stops waiting after the timeout when a round hangs', async () => {
  global.fetch = () => new Promise(() => {});
  const { relay } = createRelay({
    env: { NOTIFICATION_SERVICE_TIMEOUT_MS: '1' },
    events: ['e1'],
  });
  void relay.relayPendingEmails();
  await new Promise((resolve) => setImmediate(resolve));
  const started = Date.now();
  await relay.onModuleDestroy();
  assert.ok(Date.now() - started < 10_000);
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

test('an expired email is not sent: it stops as EXPIRED, redacted, without counting an attempt', async () => {
  const requests = respondWith(201);
  const past = new Date(Date.now() - 1000).toISOString();
  const { relay, published, failures, expired, rows } = createRelay({
    events: [{ id: 'old', attempts: 3, expiresAt: past }, 'fresh'],
  });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].init.body).subject, email.subject);
  assert.deepEqual(
    published.map((item) => item.id),
    ['fresh'],
  );
  assert.equal(failures.length, 0);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].id, 'old');
  assert.ok(expired[0].now instanceof Date);
  assert.deepEqual(expired[0].payload, {
    to: email.to,
    templateCode: email.templateCode,
    expiresAt: past,
    redacted: true,
  });
  assert.equal(rows.find((row) => row.id === 'old').attempts, 3);
  const warnings = logs.filter((entry) => entry.level === 'warn');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /Email old skipped \(EXPIRED\)/);
  assert.doesNotMatch(loggedText(), /482913|secret-token|guest@example/);
  await relay.relayPendingEmails();
  assert.equal(requests.length, 1);
});

test('an email before its expiry is sent and keeps the expiry in the redacted payload', async () => {
  const requests = respondWith(201);
  const future = new Date(Date.now() + 60_000).toISOString();
  const { relay, published, expired } = createRelay({
    events: [{ id: 'e1', expiresAt: future }],
  });
  await relay.relayPendingEmails();
  assert.equal(requests.length, 1);
  assert.equal(expired.length, 0);
  assert.deepEqual(published[0].payload, {
    to: email.to,
    templateCode: email.templateCode,
    expiresAt: future,
    redacted: true,
  });
});

test('in development, an expired email is not printed to the log', async () => {
  respondWith(201);
  const { relay, published, expired } = createRelay({
    env: { NOTIFICATION_SERVICE_URL: '', NODE_ENV: 'development' },
    events: [{ id: 'e1', expiresAt: new Date(Date.now() - 1).toISOString() }],
  });
  await relay.relayPendingEmails();
  assert.equal(published.length, 0);
  assert.equal(expired.length, 1);
  assert.doesNotMatch(loggedText(), /DEV EMAIL|482913/);
});

test('isEmailExpired: expired at the exact instant; missing or invalid expiry is sent', () => {
  const now = new Date('2026-10-30T00:00:00.000Z');
  assert.equal(isEmailExpired({ expiresAt: now.toISOString() }, now), true);
  assert.equal(
    isEmailExpired({ expiresAt: '2026-10-30T00:00:00.001Z' }, now),
    false,
  );
  for (const expiresAt of [undefined, null, 1, 'not-a-date', ''])
    assert.equal(isEmailExpired({ expiresAt }, now), false, String(expiresAt));
});

test('markExpired sets failed_at and EXPIRED without touching attempts', async () => {
  const updates = [];
  const repository = new OutboxRepository({});
  const now = new Date('2026-10-30T00:00:00Z');
  const tx = {
    outboxEvent: { update: async (args) => updates.push(args) },
  };
  await repository.markExpired('e1', { redacted: true }, now, tx);
  assert.deepEqual(updates, [
    {
      where: { id: 'e1' },
      data: {
        failedAt: now,
        nextAttemptAt: null,
        lastErrorCode: 'EXPIRED',
        payload: { redacted: true },
      },
    },
  ]);
});

test('claims only due, non-failed emails with FOR UPDATE SKIP LOCKED', async () => {
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
  assert.match(sql, /SELECT id, payload, attempts/);
  assert.match(sql, /published_at IS NULL AND failed_at IS NULL/);
  assert.match(
    sql,
    /\(next_attempt_at IS NULL OR next_attempt_at <= now\(\)\)/,
  );
  assert.match(sql, /NOT \(id = ANY\(\?::uuid\[\]\)\)/);
  assert.match(sql, /ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(queries[0].values, ['EmailRequested', ['e1']]);
});
