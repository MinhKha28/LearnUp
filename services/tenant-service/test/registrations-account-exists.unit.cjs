const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  RegistrationsService,
} = require('../dist/src/modules/registrations/registrations.service');
const {
  renderAccountExistsEmail,
} = require('../dist/src/common/email-templates/registration-emails');

const dto = (email) => ({
  planId: '01900000-0000-7000-8000-00000000p001',
  organization: {
    name: 'Account Exists',
    taxCode: '0101010101',
    address: 'HN',
    contactPhone: '0900000000',
  },
  organizer: { email, password: 'Matkhau@123', fullName: 'Someone Else' },
});
const settings = {
  emailOtpTtlMinutes: 10,
  maxLinkResendsPer24h: 5,
  pendingRegistrationTtlHours: 168,
};
const neutral = (email) => ({
  email,
  otpTtlMinutes: 10,
  message: 'Nếu thông tin hợp lệ, mã xác thực đã được gửi tới email của bạn.',
});
const accountOf = (overrides = {}) => ({
  id: '01900000-0000-7000-8000-0000000000a1',
  organizationId: '01900000-0000-7000-8000-0000000000b1',
  email: 'owner@exists.test',
  fullName: 'Chủ Tài Khoản',
  role: 'Organizer',
  status: 'Active',
  deletedAt: null,
  ...overrides,
});

const createService = ({ account = null, sentIn24h = 0 } = {}) => {
  const log = [];
  const emails = [];
  const counts = [];
  const repository = {
    tryLockRegistrationEmail: async () => {
      log.push('lock');
      return true;
    },
    findPlanById: async () => ({
      id: dto('x').planId,
      isOffered: true,
      price: 1n,
      durationDays: 30,
      maxLearners: 1,
      maxInstructors: 1,
      maxCourseChains: 1,
      maxStorageBytes: 1n,
    }),
    findActiveUserByEmail: async () => {
      log.push('findActiveUserByEmail');
      return account;
    },
    findPendingByOrganizer: async () => {
      log.push('findPendingByOrganizer');
      return null;
    },
    createOrganization: async (data) => {
      log.push('createOrganization');
      return { ...data };
    },
    createOrganizer: async () => log.push('createOrganizer'),
    createRegistration: async () => log.push('createRegistration'),
  };
  const prisma = { $transaction: async (fn) => fn({}) };
  const values = {
    EMAIL_OTP_SECRET: 'unit-test-otp-secret-0123456789abcdef',
    FRONTEND_URL: 'https://app.learnup.test',
  };
  const config = {
    get: (key) => values[key],
    getOrThrow: (key) => values[key],
  };
  const outbox = {
    countResendEmails: async (email, since) => {
      counts.push({ email, since });
      return sentIn24h;
    },
    enqueueEmail: async (_tx, params) => {
      log.push('enqueueEmail');
      emails.push(params);
    },
  };
  const identity = {
    timeoutMs: 50,
    setCredentials: async () => log.push('setCredentials'),
  };
  const service = new RegistrationsService(
    prisma,
    repository,
    config,
    { get: async () => settings },
    outbox,
    identity,
    {},
  );
  return { service, log, emails, counts };
};

const assertNothingCreated = (log) => {
  for (const step of [
    'setCredentials',
    'createOrganization',
    'createOrganizer',
    'createRegistration',
  ]) {
    assert.ok(!log.includes(step), `${step} must not run`);
  }
};

test('an existing account gets the same response as a new email, and nothing is created (BR-12)', async () => {
  const account = accountOf();
  const existing = createService({ account });
  const fresh = createService();

  const forExisting = await existing.service.create(dto(account.email));
  const forFresh = await fresh.service.create(dto(account.email));

  assert.deepEqual(forExisting, neutral(account.email));
  assert.deepEqual(forExisting, forFresh);
  assertNothingCreated(existing.log);
  assert.ok(fresh.log.includes('setCredentials'));
});

test('the owner of the email gets one account-exists email that counts toward the limit (BR-40)', async () => {
  const account = accountOf();
  const { service, log, emails, counts } = createService({ account });

  await service.create(dto(account.email));

  assert.deepEqual(log.slice(0, 3), [
    'lock',
    'findActiveUserByEmail',
    'findPendingByOrganizer',
  ]);
  assert.equal(emails.length, 1);
  const [params] = emails;
  assert.equal(params.aggregateType, 'User');
  assert.equal(params.aggregateId, account.id);
  assert.equal(params.organizationId, account.organizationId);
  assert.equal(params.email.to, account.email);
  assert.equal(params.email.templateCode, 'REGISTRATION_ACCOUNT_EXISTS');
  assert.equal(params.email.countsTowardResendLimit, true);
  assert.equal(params.email.expiresAt, undefined);
  assert.match(params.email.body, /href="https:\/\/app\.learnup\.test\/login"/);
  assert.match(
    params.email.body,
    /href="https:\/\/app\.learnup\.test\/forgot-password"/,
  );
  assert.equal(counts.length, 1);
  assert.equal(counts[0].email, account.email);
  const windowMs = Date.now() - counts[0].since.getTime();
  assert.ok(
    windowMs >= 24 * 60 * 60 * 1000 && windowMs < 24 * 60 * 60 * 1000 + 5000,
  );
});

for (const [label, overrides] of [
  ['a deactivated account', { status: 'Deactivated' }],
  ['a Learner', { role: 'Learner' }],
  ['an Instructor', { role: 'Instructor' }],
  [
    'an invited Instructor who has not activated',
    { role: 'Instructor', status: 'Pending' },
  ],
  ['an account without an Organization', { organizationId: null }],
]) {
  test(`${label}: neutral response and the account-exists email`, async () => {
    const account = accountOf(overrides);
    const { service, log, emails } = createService({ account });

    assert.deepEqual(
      await service.create(dto(account.email)),
      neutral(account.email),
    );
    assertNothingCreated(log);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].email.templateCode, 'REGISTRATION_ACCOUNT_EXISTS');
    assert.equal(emails[0].organizationId, account.organizationId);
  });
}

test('limit reached: neutral response, no email, nothing created (BR-40)', async () => {
  const account = accountOf();
  const { service, log, emails } = createService({
    account,
    sentIn24h: settings.maxLinkResendsPer24h,
  });

  assert.deepEqual(
    await service.create(dto(account.email)),
    neutral(account.email),
  );
  assert.equal(emails.length, 0);
  assertNothingCreated(log);
});

test('one below the limit still sends the email', async () => {
  const account = accountOf();
  const { service, emails } = createService({
    account,
    sentIn24h: settings.maxLinkResendsPer24h - 1,
  });

  await service.create(dto(account.email));
  assert.equal(emails.length, 1);
});

test('the account-exists email escapes the name and points invited users to their invitation', () => {
  const email = renderAccountExistsEmail({
    fullName: '<b>Tên</b>',
    loginUrl: 'https://app.learnup.test/login',
    forgotPasswordUrl: 'https://app.learnup.test/forgot-password?a=1&b=2',
  });

  assert.equal(email.templateCode, 'REGISTRATION_ACCOUNT_EXISTS');
  assert.equal(email.subject, 'LearnUP - Email của bạn đã có tài khoản');
  assert.ok(!email.html.includes('<b>Tên</b>'));
  assert.ok(email.html.includes('&lt;b&gt;Tên&lt;/b&gt;'));
  assert.ok(email.html.includes('forgot-password?a=1&amp;b=2'));
  assert.match(email.html, /thư mời/);
  assert.match(email.html, /bỏ qua thư/);
});
