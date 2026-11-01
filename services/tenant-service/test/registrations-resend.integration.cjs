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
const HOUR_MS = 60 * 60 * 1000;

test('UC03.1 resend registration email against PostgreSQL', async (t) => {
  const prisma = new PrismaService({
    getOrThrow: () => process.env.DATABASE_URL,
  });
  await prisma.$connect();
  const emails = [];
  const sent = [];
  const repository = new RegistrationsRepository(prisma);
  const realOutbox = new OutboxService(new OutboxRepository(prisma));
  const outboxRow = (params, extra = {}) => ({
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    eventType: EMAIL_REQUESTED_EVENT,
    organizationId: params.organizationId,
    payload: { ...params.email },
    occurredAt: new Date(),
    publishedAt: new Date(),
    ...extra,
  });
  const service = new RegistrationsService(
    prisma,
    repository,
    {
      get: () => undefined,
      getOrThrow: (key) =>
        ({
          EMAIL_OTP_SECRET: 'resend-integration-otp-secret-0123456789',
          FRONTEND_URL: 'http://localhost:3000',
        })[key],
    },
    new PlatformSettingsService(new PlatformSettingsRepository(prisma)),
    {
      countResendEmails: (...args) => realOutbox.countResendEmails(...args),
      enqueueEmail: async (tx, params) => {
        sent.push(params.email);
        await tx.outboxEvent.create({ data: outboxRow(params) });
      },
    },
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

  const seedResends = async (email, count, age) => {
    const row = await registrationOf(email);
    for (let i = 0; i < count; i += 1) {
      await prisma.outboxEvent.create({
        data: outboxRow(
          {
            aggregateType: 'Organization',
            aggregateId: row.organizationId,
            organizationId: row.organizationId,
            email: {
              to: email,
              templateCode: 'REGISTRATION_REOPEN_LINK',
              countsTowardResendLimit: true,
              redacted: true,
            },
          },
          { createdAt: new Date(Date.now() - age) },
        ),
      });
    }
  };
  const registrationBody = (email) => ({
    planId: plan.id,
    organization: {
      name: 'UC03.1 fixture',
      taxCode: '0102030406',
      address: 'Test',
      contactPhone: '0900000000',
    },
    organizer: { email, password: 'Matkhau@123', fullName: 'Resend Fixture' },
  });
  const changedAfterRead = async (change, action) => {
    const original = repository.findPendingByOrganizer;
    repository.findPendingByOrganizer = async (...args) => {
      const row = await original.apply(repository, args);
      repository.findPendingByOrganizer = original;
      await change(row);
      return row;
    };
    try {
      await action();
    } finally {
      repository.findPendingByOrganizer = original;
    }
  };
  const payRow = (row) =>
    prisma.registration.update({
      where: { id: row.id },
      data: {
        status: 'Paid',
        emailVerifiedAt: row.emailVerifiedAt ?? new Date(),
        otpHash: null,
        otpExpiresAt: null,
      },
    });
  const assertNothingWritten = (after, snapshot) => {
    assert.deepEqual(after.reopenTokenHash, snapshot.reopenTokenHash);
    assert.deepEqual(after.otpHash, snapshot.otpHash);
    assert.deepEqual(after.otpExpiresAt, snapshot.otpExpiresAt);
  };

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
        await seedResends(email, settings.maxLinkResendsPer24h, HOUR_MS);
        const before = await registrationOf(email);

        assert.deepEqual(await service.resendEmail({ email }), neutral(email));

        assert.equal(sentCount(email), 1);
        const after = await registrationOf(email);
        assert.deepEqual(after.otpHash, before.otpHash);
      },
    );

    await t.test('mails older than 24 hours no longer count', async () => {
      const email = await register();
      await seedResends(
        email,
        settings.maxLinkResendsPer24h,
        DAY_MS + 60 * 1000,
      );
      await service.resendEmail({ email });
      assert.equal(sentCount(email), 2);
    });

    await t.test(
      'rolling window: quota returns only as the oldest mail leaves the 24 hours (BR-40)',
      async () => {
        const email = await register();
        await seedResends(email, 1, DAY_MS + 60 * 1000);
        await seedResends(
          email,
          settings.maxLinkResendsPer24h - 1,
          DAY_MS - 60 * 1000,
        );
        await service.resendEmail({ email });
        assert.equal(sentCount(email), 2);
        await service.resendEmail({ email });
        assert.equal(sentCount(email), 2);
      },
    );

    await t.test(
      'the first mail is free: first mail plus the limit, then nothing (BR-13)',
      async () => {
        const email = await register();
        for (let i = 0; i <= settings.maxLinkResendsPer24h; i += 1) {
          await service.resendEmail({ email });
        }
        assert.equal(sentCount(email), 1 + settings.maxLinkResendsPer24h);
      },
    );

    await t.test(
      'UC02 and UC03.1 share one limit, also across a replaced registration (BR-12)',
      async () => {
        const email = await register();
        await service.resendEmail({ email });
        for (let i = 1; i <= settings.maxLinkResendsPer24h; i += 1) {
          await service.create(registrationBody(email));
        }
        assert.equal(sentCount(email), 1 + settings.maxLinkResendsPer24h);
        const atLimit = await registrationOf(email);
        await service.resendEmail({ email });
        assert.equal(sentCount(email), 1 + settings.maxLinkResendsPer24h);
        assert.equal((await registrationOf(email)).id, atLimit.id);
      },
    );

    await t.test(
      'an unsent resend does not use up the limit',
      async () => {
        const email = await register();
        await changedAfterRead(payRow, () => service.resendEmail({ email }));
        const row = await registrationOf(email);
        const counted = await prisma.outboxEvent.count({
          where: {
            organizationId: row.organizationId,
            payload: { path: ['countsTowardResendLimit'], equals: true },
          },
        });
        assert.equal(counted, 0);
      },
    );

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
      },
    );

    await t.test(
      'paid after the read, unverified: no OTP restored and no mail (BR-40)',
      async () => {
        const email = await register();
        let snapshot;
        await changedAfterRead(
          async (row) => {
            snapshot = await payRow(row);
          },
          () => service.resendEmail({ email }),
        );
        assert.equal(sentCount(email), 1);
        const after = await registrationOf(email);
        assert.equal(after.status, 'Paid');
        assert.equal(after.otpHash, null);
        assertNothingWritten(after, snapshot);
      },
    );

    await t.test(
      'paid after the read, verified: the link is not rotated and no mail',
      async () => {
        const email = await register();
        await service.verifyEmailOtp({ email, otp: codeIn(lastSentTo(email)) });
        let snapshot;
        await changedAfterRead(
          async (row) => {
            snapshot = await payRow(row);
          },
          () => service.resendEmail({ email }),
        );
        assert.equal(sentCount(email), 1);
        assertNothingWritten(await registrationOf(email), snapshot);
      },
    );

    await t.test(
      'UC02 case B: paid after the read, the link is not rotated and no mail (BR-12)',
      async () => {
        const email = await register();
        await service.verifyEmailOtp({ email, otp: codeIn(lastSentTo(email)) });
        let snapshot;
        await changedAfterRead(
          async (row) => {
            snapshot = await payRow(row);
          },
          () => service.create(registrationBody(email)),
        );
        assert.equal(sentCount(email), 1);
        assertNothingWritten(await registrationOf(email), snapshot);
      },
    );

    await t.test(
      'verified after the read: a reopen link is sent, not a code (BR-13)',
      async () => {
        const email = await register();
        const code = codeIn(lastSentTo(email));
        await changedAfterRead(
          () => service.verifyEmailOtp({ email, otp: code }),
          () => service.resendEmail({ email }),
        );
        assert.equal(sentCount(email), 2);
        assert.equal(
          lastSentTo(email).templateCode,
          'REGISTRATION_REOPEN_LINK',
        );
        const after = await registrationOf(email);
        assert.equal(after.otpHash, null);
        assert.ok(after.emailVerifiedAt instanceof Date);
      },
    );

    await t.test(
      'expired after the read: nothing is written and no mail (BR-8)',
      async () => {
        const email = await register();
        let snapshot;
        await changedAfterRead(
          async (row) => {
            snapshot = await prisma.registration.update({
              where: { id: row.id },
              data: { expiresAt: new Date(Date.now() - 1000) },
            });
          },
          () => service.resendEmail({ email }),
        );
        assert.equal(sentCount(email), 1);
        assertNothingWritten(await registrationOf(email), snapshot);
      },
    );
  } finally {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
    });
    const organizationIds = [...new Set(users.map((u) => u.organizationId))];
    await prisma.outboxEvent.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
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
