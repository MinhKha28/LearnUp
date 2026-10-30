const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const {
  ConflictException,
  ServiceUnavailableException,
} = require('@nestjs/common');
const {
  RegistrationsService,
  REGISTRATION_LOCK_EXTRA_WAIT_MS,
} = require('../dist/src/modules/registrations/registrations.service');
const {
  RegistrationsRepository,
  REGISTRATION_EMAIL_LOCK_NAMESPACE,
} = require('../dist/src/modules/registrations/registrations.repository');
const {
  IdentityClient,
  DEFAULT_IDENTITY_TIMEOUT_MS,
} = require('../dist/src/infrastructure/clients/identity/identity.client');

const email = 'owner@lock.test';
const dto = {
  planId: '01900000-0000-7000-8000-00000000p001',
  organization: {
    name: 'Lock Test',
    taxCode: '0101010101',
    address: 'HN',
    contactPhone: '0900000000',
  },
  organizer: { email, password: 'Matkhau@123', fullName: 'Lock Owner' },
};
const settings = {
  emailOtpTtlMinutes: 10,
  maxLinkResendsPer24h: 5,
  pendingRegistrationTtlHours: 168,
};
const neutral = {
  email,
  otpTtlMinutes: 10,
  message: 'Nếu thông tin hợp lệ, mã xác thực đã được gửi tới email của bạn.',
};

const createService = ({ locks = [true], identity } = {}) => {
  const log = [];
  const transactions = [];
  const lockResults = [...locks];
  const repository = {
    tryLockRegistrationEmail: async (value, tx) => {
      log.push(['lock', value, tx.name]);
      return lockResults.length ? lockResults.shift() : false;
    },
    findPlanById: async () => {
      log.push(['plan']);
      return {
        id: dto.planId,
        isOffered: true,
        price: 1n,
        durationDays: 30,
        maxLearners: 1,
        maxInstructors: 1,
        maxCourseChains: 1,
        maxStorageBytes: 1n,
      };
    },
    findActiveUserByEmail: async (value) => {
      log.push(['findActiveUserByEmail', value]);
      return null;
    },
    createOrganization: async (data) => {
      log.push(['createOrganization']);
      return { ...data };
    },
    createOrganizer: async () => log.push(['createOrganizer']),
    createRegistration: async () => log.push(['createRegistration']),
    updateReopenToken: async () => log.push(['updateReopenToken']),
  };
  const prisma = {
    $transaction: async (fn, options) => {
      transactions.push(options);
      return fn({ name: `tx${transactions.length}` });
    },
  };
  const config = {
    get: () => undefined,
    getOrThrow: (key) =>
      ({
        EMAIL_OTP_SECRET: 'unit-test-otp-secret-0123456789abcdef',
        FRONTEND_URL: 'http://localhost:3000',
      })[key],
  };
  const identityClient = {
    timeoutMs: 50,
    setCredentials:
      identity ??
      (async (params) => {
        log.push(['setCredentials', params.email]);
      }),
  };
  const service = new RegistrationsService(
    prisma,
    repository,
    config,
    { get: async () => settings },
    { enqueueEmail: async (_tx, params) => log.push(['enqueueEmail', params]) },
    identityClient,
    {},
  );
  return { service, log, transactions };
};

const realNow = Date.now;
afterEach(() => {
  Date.now = realNow;
});

test('takes the email lock before reading the email, then registers inside it', async () => {
  const { service, log, transactions } = createService();
  assert.deepEqual(await service.create(dto), neutral);
  assert.deepEqual(
    log.map((entry) => entry[0]),
    [
      'lock',
      'plan',
      'findActiveUserByEmail',
      'setCredentials',
      'createOrganization',
      'createOrganizer',
      'createRegistration',
      'enqueueEmail',
    ],
  );
  assert.deepEqual(log[0], ['lock', email, 'tx1']);
  const lockTx = transactions[0];
  assert.equal(lockTx.maxWait, REGISTRATION_LOCK_EXTRA_WAIT_MS);
  assert.ok(lockTx.timeout > 50 + REGISTRATION_LOCK_EXTRA_WAIT_MS + 50);
});

test('the verification email expires together with its OTP (BR-13)', async () => {
  const { service, log } = createService();
  const before = Date.now();
  await service.create(dto);
  const after = Date.now();
  const { email: message } = log.find(
    (entry) => entry[0] === 'enqueueEmail',
  )[1];
  const ttl = settings.emailOtpTtlMinutes * 60_000;
  const expiresAt = Date.parse(message.expiresAt);
  assert.equal(message.templateCode, 'REGISTRATION_VERIFICATION_CODE');
  assert.equal(new Date(expiresAt).toISOString(), message.expiresAt);
  assert.ok(expiresAt >= before + ttl && expiresAt <= after + ttl);
});

test('the reopen-link email expires with the registration', async () => {
  const { service, log } = createService();
  const registrationExpiresAt = new Date('2026-11-05T00:00:00.000Z');
  await service.resendReopenLink(
    {
      id: 'r1',
      organizationId: 'o1',
      expiresAt: registrationExpiresAt,
      organization: { name: 'Lock Test' },
      organizer: { email, fullName: 'Lock Owner' },
    },
    { resendCount: 1, resendWindowStartedAt: new Date() },
  );
  const { email: message } = log.find(
    (entry) => entry[0] === 'enqueueEmail',
  )[1];
  assert.equal(message.templateCode, 'REGISTRATION_REOPEN_LINK');
  assert.equal(message.expiresAt, registrationExpiresAt.toISOString());
});

test('waits while another registration holds the same email lock', async () => {
  const { service, log } = createService({ locks: [false, false, true] });
  assert.deepEqual(await service.create(dto), neutral);
  assert.equal(log.filter((entry) => entry[0] === 'lock').length, 3);
  assert.ok(log.some((entry) => entry[0] === 'createRegistration'));
});

test('gives up with the neutral response when the lock is not released in time', async () => {
  let calls = 0;
  const start = realNow();
  Date.now = () => start + (calls++ === 0 ? 0 : 60_000);
  const { service, log } = createService({ locks: [] });
  assert.deepEqual(await service.create(dto), neutral);
  assert.deepEqual(
    log.map((entry) => entry[0]),
    ['lock'],
  );
});

test('an identity 409 (email held by an existing account) gives the neutral response and writes nothing', async () => {
  const { service, log } = createService({
    identity: async () => {
      throw new ConflictException({ code: 'IDENTITY_CREDENTIAL_CONFLICT' });
    },
  });
  assert.deepEqual(await service.create(dto), neutral);
  assert.ok(!log.some((entry) => entry[0].startsWith('create')));
});

test('identity unavailability is still reported as 503', async () => {
  const { service } = createService({
    identity: async () => {
      throw new ServiceUnavailableException({ code: 'IDENTITY_UNAVAILABLE' });
    },
  });
  await assert.rejects(
    service.create(dto),
    (error) => error.getStatus() === 503,
  );
});

test('the lock query uses a UC02 namespace and the lower-cased email', async () => {
  const queries = [];
  const repository = new RegistrationsRepository({});
  const tx = {
    $queryRaw: async (strings, ...values) => {
      queries.push({ sql: strings.join('?'), values });
      return [{ locked: true }];
    },
  };
  assert.equal(
    await repository.tryLockRegistrationEmail('Owner@Lock.Test', tx),
    true,
  );
  assert.match(
    queries[0].sql,
    /pg_try_advisory_xact_lock\(\?::int, hashtext\(lower\(\?\)\)\)/,
  );
  assert.deepEqual(queries[0].values, [
    REGISTRATION_EMAIL_LOCK_NAMESPACE,
    'Owner@Lock.Test',
  ]);
  tx.$queryRaw = async () => [{ locked: false }];
  assert.equal(await repository.tryLockRegistrationEmail(email, tx), false);
});

const identityClient = (env, response) => {
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  };
  const client = new IdentityClient({
    get: (key) =>
      ({ IDENTITY_SERVICE_URL: 'http://identity.test', ...env })[key],
    getOrThrow: () => 'unit-test-internal-key-0123456789abcdef',
  });
  return { client, requests };
};
const params = {
  userId: 'u1',
  password: 'p',
  email,
  fullName: 'n',
  role: 'Organizer',
  organizationId: 'o1',
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('IdentityClient maps 409 to a conflict and sends a bounded request', async () => {
  const { client, requests } = identityClient({}, { ok: false, status: 409 });
  await assert.rejects(
    client.setCredentials(params),
    (error) =>
      error instanceof ConflictException &&
      error.getResponse().code === 'IDENTITY_CREDENTIAL_CONFLICT',
  );
  assert.ok(requests[0].init.signal instanceof AbortSignal);
});

test('IdentityClient keeps 503 for other failures and timeouts', async () => {
  for (const response of [
    { ok: false, status: 500 },
    new DOMException('signal timed out', 'TimeoutError'),
  ]) {
    const { client } = identityClient({}, response);
    await assert.rejects(
      client.setCredentials(params),
      (error) => error.getStatus() === 503,
    );
  }
});

test('IdentityClient timeout comes from IDENTITY_SERVICE_TIMEOUT_MS, default for invalid values', () => {
  for (const [value, expected] of [
    ['3000', 3000],
    ['abc', DEFAULT_IDENTITY_TIMEOUT_MS],
    ['0', DEFAULT_IDENTITY_TIMEOUT_MS],
    [undefined, DEFAULT_IDENTITY_TIMEOUT_MS],
  ]) {
    const { client } = identityClient(
      { IDENTITY_SERVICE_TIMEOUT_MS: value },
      { ok: true, status: 200 },
    );
    assert.equal(client.timeoutMs, expected, String(value));
  }
});
