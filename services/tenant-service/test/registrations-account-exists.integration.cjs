const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Database integration tests must not run in production.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

process.env.NODE_PATH = require('node:path').resolve(__dirname, '../dist');
require('node:module').Module._initPaths();

const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');
const {
  RegistrationsService,
} = require('../dist/src/modules/registrations/registrations.service');
const {
  RegistrationsRepository,
} = require('../dist/src/modules/registrations/registrations.repository');
const {
  PlatformSettingsRepository,
} = require('../dist/src/modules/platform-settings/platform-settings.repository');
const {
  PlatformSettingsService,
} = require('../dist/src/modules/platform-settings/platform-settings.service');
const {
  OutboxRepository,
} = require('../dist/src/modules/outbox/outbox.repository');
const {
  OutboxService,
  EMAIL_REQUESTED_EVENT,
} = require('../dist/src/modules/outbox/outbox.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const TEMPLATE = 'REGISTRATION_ACCOUNT_EXISTS';

test('UC02 with an email that already has an account, against PostgreSQL', async (t) => {
  const prisma = new PrismaService({
    getOrThrow: () => process.env.DATABASE_URL,
  });
  await prisma.$connect();
  const organizationIds = [];
  const identityCalls = [];
  const realOutbox = new OutboxService(new OutboxRepository(prisma));
  const settings = await new PlatformSettingsService(
    new PlatformSettingsRepository(prisma),
  ).get();
  const limit = settings.maxLinkResendsPer24h;
  const service = new RegistrationsService(
    prisma,
    new RegistrationsRepository(prisma),
    {
      get: () => undefined,
      getOrThrow: (key) =>
        ({
          EMAIL_OTP_SECRET: 'account-exists-integration-otp-secret-0123',
          FRONTEND_URL: 'http://localhost:3000',
        })[key],
    },
    new PlatformSettingsService(new PlatformSettingsRepository(prisma)),
    {
      countResendEmails: (...args) => realOutbox.countResendEmails(...args),
      enqueueEmail: async (tx, params) => {
        await tx.outboxEvent.create({
          data: {
            aggregateType: params.aggregateType,
            aggregateId: params.aggregateId,
            eventType: EMAIL_REQUESTED_EVENT,
            organizationId: params.organizationId,
            payload: { ...params.email },
            occurredAt: new Date(),
            publishedAt: new Date(),
          },
        });
      },
    },
    {
      timeoutMs: 3000,
      setCredentials: async (params) => identityCalls.push(params.email),
    },
    {},
  );
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { isOffered: true },
  });
  assert.ok(plan, 'seed an offered subscription plan first (prisma:seed)');

  const seedAccount = async ({
    role = 'Organizer',
    status = 'Active',
  } = {}) => {
    const organization = await prisma.organization.create({
      data: {
        name: 'UC02 account exists fixture',
        taxCode: '0102030407',
        address: 'Test',
        contactPhone: '0900000000',
        status: 'Active',
      },
    });
    organizationIds.push(organization.id);
    return prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `uc02-exists-${randomUUID()}@exists.test`,
        fullName: 'Existing Account',
        role,
        status,
      },
    });
  };
  const register = (email) =>
    service.create({
      planId: plan.id,
      organization: {
        name: 'Someone else',
        taxCode: '0102030408',
        address: 'Test',
        contactPhone: '0900000001',
      },
      organizer: { email, password: 'Matkhau@123', fullName: 'Someone Else' },
    });
  const neutral = (email) => ({
    email,
    otpTtlMinutes: settings.emailOtpTtlMinutes,
    message: 'Nếu thông tin hợp lệ, mã xác thực đã được gửi tới email của bạn.',
  });
  const mailsTo = (email) =>
    prisma.outboxEvent.findMany({
      where: {
        eventType: EMAIL_REQUESTED_EVENT,
        payload: { path: ['to'], equals: email },
      },
      orderBy: { createdAt: 'asc' },
    });
  const seedCountedMails = async (user, count, ageMs) => {
    for (let i = 0; i < count; i += 1) {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: 'User',
          aggregateId: user.id,
          eventType: EMAIL_REQUESTED_EVENT,
          organizationId: user.organizationId,
          payload: {
            to: user.email,
            templateCode: 'REGISTRATION_REOPEN_LINK',
            countsTowardResendLimit: true,
            redacted: true,
          },
          occurredAt: new Date(),
          publishedAt: new Date(),
          createdAt: new Date(Date.now() - ageMs),
        },
      });
    }
  };
  const snapshot = async (user) => ({
    users: await prisma.user.count({ where: { email: user.email } }),
    organizations: await prisma.organization.count({
      where: { taxCode: '0102030408' },
    }),
    registrations: await prisma.registration.count({
      where: { organizerUserId: user.id },
    }),
  });

  try {
    await t.test(
      'active Organizer: 202 body, nothing created, identity not called, one counted email',
      async () => {
        const user = await seedAccount();
        const before = await snapshot(user);

        assert.deepEqual(await register(user.email), neutral(user.email));

        assert.deepEqual(await snapshot(user), before);
        assert.ok(!identityCalls.includes(user.email));
        const mails = await mailsTo(user.email);
        assert.equal(mails.length, 1);
        assert.equal(mails[0].aggregateType, 'User');
        assert.equal(mails[0].aggregateId, user.id);
        assert.equal(mails[0].organizationId, user.organizationId);
        assert.equal(mails[0].payload.templateCode, TEMPLATE);
        assert.equal(mails[0].payload.countsTowardResendLimit, true);
        assert.equal(
          await realOutbox.countResendEmails(
            user.email,
            new Date(Date.now() - DAY_MS),
          ),
          1,
        );
      },
    );

    for (const [label, account] of [
      ['deactivated Learner', { role: 'Learner', status: 'Deactivated' }],
      [
        'invited Instructor not activated',
        { role: 'Instructor', status: 'Pending' },
      ],
      ['active Instructor', { role: 'Instructor', status: 'Active' }],
    ]) {
      await t.test(`${label}: neutral response and the email`, async () => {
        const user = await seedAccount(account);
        const before = await snapshot(user);

        assert.deepEqual(await register(user.email), neutral(user.email));

        assert.deepEqual(await snapshot(user), before);
        const mails = await mailsTo(user.email);
        assert.equal(mails.length, 1);
        assert.equal(mails[0].payload.templateCode, TEMPLATE);
      });
    }

    await t.test(
      'limit reached: neutral response and no email (BR-40)',
      async () => {
        const user = await seedAccount();
        await seedCountedMails(user, limit, 60 * 60 * 1000);

        assert.deepEqual(await register(user.email), neutral(user.email));

        const mails = await mailsTo(user.email);
        assert.equal(mails.length, limit);
        assert.ok(mails.every((m) => m.payload.templateCode !== TEMPLATE));
      },
    );

    await t.test('emails older than 24 hours do not count', async () => {
      const user = await seedAccount();
      await seedCountedMails(user, limit, DAY_MS + 60 * 1000);

      await register(user.email);

      const mails = await mailsTo(user.email);
      assert.equal(
        mails.filter((m) => m.payload.templateCode === TEMPLATE).length,
        1,
      );
    });

    await t.test(
      'two requests at the same time with one email left: only one is sent (email lock)',
      async () => {
        const user = await seedAccount();
        await seedCountedMails(user, limit - 1, 60 * 60 * 1000);

        const results = await Promise.all([
          register(user.email),
          register(user.email),
        ]);

        for (const result of results) {
          assert.deepEqual(result, neutral(user.email));
        }
        const mails = await mailsTo(user.email);
        assert.equal(
          mails.filter((m) => m.payload.templateCode === TEMPLATE).length,
          1,
        );
      },
    );

    await t.test('repeated requests stop at the limit', async () => {
      const user = await seedAccount();
      for (let i = 0; i < limit + 2; i += 1) {
        assert.deepEqual(await register(user.email), neutral(user.email));
      }
      const mails = await mailsTo(user.email);
      assert.equal(mails.length, limit);
    });
  } finally {
    await prisma.outboxEvent.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
    await prisma.$disconnect();
  }
});
