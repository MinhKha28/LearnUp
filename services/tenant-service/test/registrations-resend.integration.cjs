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

const DAY_MS = 24 * 60 * 60 * 1000;

test('UC03.1 resend registration email against PostgreSQL', async (t) => {
  const prisma = new PrismaService({
    getOrThrow: () => process.env.DATABASE_URL,
  });
  await prisma.$connect();
  const emails = [];
  const sent = [];
  const service = new RegistrationsService(
    prisma,
    new RegistrationsRepository(prisma),
    {
      get: () => undefined,
      getOrThrow: (key) =>
        ({
          EMAIL_OTP_SECRET: 'resend-integration-otp-secret-0123456789',
          FRONTEND_URL: 'http://localhost:3000',
        })[key],
    },
    new PlatformSettingsService(new PlatformSettingsRepository(prisma)),
    { enqueueEmail: async (_tx, params) => sent.push(params.email) },
    { timeoutMs: 3000, setCredentials: async () => undefined },
    {},
  );
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { isOffered: true },
  });
  assert.ok(plan, 'seed an offered subscription plan first (prisma:seed)');
  const settings = await new PlatformSettingsService(
    new PlatformSettingsRepository(prisma),
  ).get();

  const register = async () => {
    const email = `uc031-${randomUUID()}@resend.test`;
    emails.push(email);
    await service.create({
      planId: plan.id,
      organization: {
        name: 'UC03.1 fixture',
        taxCode: '0102030406',
        address: 'Test',
        contactPhone: '0900000000',
      },
      organizer: { email, password: 'Matkhau@123', fullName: 'Resend Fixture' },
    });
    return email;
  };
  const registrationOf = async (email) => {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    return prisma.registration.findFirst({
      where: { organizerUserId: user.id },
    });
  };
  const lastSentTo = (email) => sent.filter((m) => m.to === email).at(-1);
  const codeIn = (message) => message.body.match(/\b(\d{6})\b/)[1];
  const tokenIn = (message) => message.body.match(/token=([^"&\s<]+)/)[1];
  const sentCount = (email) => sent.filter((m) => m.to === email).length;
  const neutral = (email) => ({
    email,
    otpTtlMinutes: settings.emailOtpTtlMinutes,
    message:
      'Nếu email gắn với một đăng ký đang chờ thanh toán, thư đăng ký mới đã được gửi.',
  });

  try {
    await t.test(
      'unverified email: a new code and link replace the old ones (BR-13, BR-40)',
      async () => {
        const email = await register();
        const first = lastSentTo(email);
        const oldCode = codeIn(first);
        const oldToken = tokenIn(first);
        await prisma.registration.update({
          where: { id: (await registrationOf(email)).id },
          data: { otpFailedAttempts: 3 },
        });

        assert.deepEqual(await service.resendEmail({ email }), neutral(email));

        assert.equal(sentCount(email), 2);
        const second = lastSentTo(email);
        assert.equal(second.templateCode, 'REGISTRATION_VERIFICATION_CODE');
        const newCode = codeIn(second);
        const row = await registrationOf(email);
        assert.equal(second.expiresAt, row.otpExpiresAt.toISOString());
        assert.equal(row.otpFailedAttempts, 0);
        assert.equal(row.resendCount, 1);
        assert.ok(row.resendWindowStartedAt instanceof Date);
        assert.ok(row.otpExpiresAt.getTime() > Date.now());

        await assert.rejects(service.getByToken(oldToken), (error) => {
          assert.equal(error.getResponse().code, 'INVALID_LINK');
          return true;
        });
        if (oldCode !== newCode) {
          await assert.rejects(
            service.verifyEmailOtp({ email, otp: oldCode }),
            (error) => error.getResponse().code === 'OTP_INVALID',
          );
        }
        const verified = await service.verifyEmailOtp({ email, otp: newCode });
        assert.ok(verified.paymentToken);
      },
    );

    await t.test(
      'verified email: only a new reopen link is sent, the code stays cleared',
      async () => {
        const email = await register();
        await service.verifyEmailOtp({
          email,
          otp: codeIn(lastSentTo(email)),
        });
        const before = await registrationOf(email);

        assert.deepEqual(await service.resendEmail({ email }), neutral(email));

        const message = lastSentTo(email);
        assert.equal(message.templateCode, 'REGISTRATION_REOPEN_LINK');
        const after = await registrationOf(email);
        assert.equal(message.expiresAt, after.expiresAt.toISOString());
        assert.notDeepEqual(after.reopenTokenHash, before.reopenTokenHash);
        assert.equal(after.otpHash, null);
        const summary = await service.getByToken(tokenIn(message));
        assert.ok(summary);
      },
    );

    await t.test(
      'the 24-hour limit is shared with UC02: at the limit nothing is sent',
      async () => {
        const email = await register();
        await prisma.registration.update({
          where: { id: (await registrationOf(email)).id },
          data: {
            resendCount: settings.maxLinkResendsPer24h,
            resendWindowStartedAt: new Date(),
          },
        });
        const before = await registrationOf(email);

        assert.deepEqual(await service.resendEmail({ email }), neutral(email));

        assert.equal(sentCount(email), 1);
        const after = await registrationOf(email);
        assert.deepEqual(after.otpHash, before.otpHash);
        assert.equal(after.resendCount, settings.maxLinkResendsPer24h);
      },
    );

    await t.test('after 24 hours the counter restarts and sends', async () => {
      const email = await register();
      await prisma.registration.update({
        where: { id: (await registrationOf(email)).id },
        data: {
          resendCount: settings.maxLinkResendsPer24h,
          resendWindowStartedAt: new Date(Date.now() - DAY_MS - 1000),
        },
      });
      await service.resendEmail({ email });
      assert.equal(sentCount(email), 2);
      assert.equal((await registrationOf(email)).resendCount, 1);
    });

    await t.test(
      'an expired registration is cancelled and nothing is sent (BR-8)',
      async () => {
        const email = await register();
        const row = await registrationOf(email);
        await prisma.registration.update({
          where: { id: row.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });

        assert.deepEqual(await service.resendEmail({ email }), neutral(email));

        assert.equal(sentCount(email), 1);
        const expired = await prisma.registration.findUnique({
          where: { id: row.id },
        });
        assert.equal(expired.status, 'Expired');
      },
    );

    await t.test(
      'a paid registration and an unknown email get the same response, nothing sent',
      async () => {
        const paidEmail = await register();
        await prisma.registration.update({
          where: { id: (await registrationOf(paidEmail)).id },
          data: { status: 'Paid' },
        });
        const unknown = `uc031-unknown-${randomUUID()}@resend.test`;

        assert.deepEqual(
          await service.resendEmail({ email: paidEmail }),
          neutral(paidEmail),
        );
        assert.deepEqual(
          await service.resendEmail({ email: unknown }),
          neutral(unknown),
        );
        assert.equal(sentCount(paidEmail), 1);
        assert.equal(sentCount(unknown), 0);
      },
    );

    await t.test(
      'concurrent resends for one email are serialised and counted once each',
      async () => {
        const email = await register();
        await Promise.all([
          service.resendEmail({ email }),
          service.resendEmail({ email }),
        ]);
        assert.equal(sentCount(email), 3);
        assert.equal((await registrationOf(email)).resendCount, 2);
      },
    );
  } finally {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
    });
    const organizationIds = [...new Set(users.map((u) => u.organizationId))];
    await prisma.registration.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
    await prisma.$disconnect();
  }
});
