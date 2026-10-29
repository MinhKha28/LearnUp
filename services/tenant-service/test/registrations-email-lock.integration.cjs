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

test('UC02 serializes registrations of the same email with an advisory lock', async (t) => {
  const prisma = new PrismaService({
    getOrThrow: () => process.env.DATABASE_URL,
  });
  await prisma.$connect();
  const emails = [];
  const identityCalls = [];
  let active = 0;
  let maxActive = 0;
  const identity = {
    timeoutMs: 3000,
    setCredentials: async (params) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      identityCalls.push(params.email);
      await new Promise((resolve) => setTimeout(resolve, 300));
      active -= 1;
    },
  };
  const service = new RegistrationsService(
    prisma,
    new RegistrationsRepository(prisma),
    {
      get: () => undefined,
      getOrThrow: (key) =>
        ({
          EMAIL_OTP_SECRET: 'integration-otp-secret-0123456789abcdef',
          FRONTEND_URL: 'http://localhost:3000',
        })[key],
    },
    new PlatformSettingsService(new PlatformSettingsRepository(prisma)),
    { enqueueEmail: async () => undefined },
    identity,
    {},
  );
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { isOffered: true },
  });
  assert.ok(plan, 'seed an offered subscription plan first (prisma:seed)');
  const dto = (email) => ({
    planId: plan.id,
    organization: {
      name: 'UC02 lock fixture',
      taxCode: '0102030405',
      address: 'Test',
      contactPhone: '0900000000',
    },
    organizer: { email, password: 'Matkhau@123', fullName: 'Lock Fixture' },
  });
  const newEmail = () => {
    const email = `uc02-lock-${randomUUID()}@lock.test`;
    emails.push(email);
    return email;
  };
  const rowsFor = async (email) => {
    const users = await prisma.user.findMany({ where: { email } });
    const registrations = await prisma.registration.findMany({
      where: { organizerUserId: { in: users.map((u) => u.id) } },
    });
    return { users, registrations };
  };

  try {
    await t.test(
      'two concurrent registrations of one email run one after the other',
      async () => {
        const email = newEmail();
        identityCalls.length = 0;
        maxActive = 0;
        const results = await Promise.all([
          service.create(dto(email)),
          service.create(dto(email)),
        ]);
        assert.ok(results.every((r) => r.email === email));
        assert.equal(
          maxActive,
          1,
          'identity calls for the same email overlapped',
        );
        assert.deepEqual(identityCalls, [email, email]);
        const { users, registrations } = await rowsFor(email);
        assert.equal(users.filter((u) => u.deletedAt === null).length, 1);
        assert.equal(users.filter((u) => u.deletedAt !== null).length, 1);
        assert.deepEqual(registrations.map((r) => r.status).sort(), [
          'Expired',
          'PendingPayment',
        ]);
      },
    );

    await t.test(
      'registrations of different emails do not wait for each other',
      async () => {
        identityCalls.length = 0;
        maxActive = 0;
        await Promise.all([
          service.create(dto(newEmail())),
          service.create(dto(newEmail())),
        ]);
        assert.equal(maxActive, 2);
      },
    );

    await t.test(
      'the email is soft-deleted and committed before identity is called again',
      async () => {
        const email = newEmail();
        await service.create(dto(email));
        const first = (await rowsFor(email)).users[0];
        identity.setCredentials = async () => {
          const seen = await prisma.user.findUnique({
            where: { id: first.id },
          });
          assert.ok(
            seen.deletedAt,
            'previous organizer not yet soft-deleted when identity is called',
          );
        };
        await service.create(dto(email));
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
