const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { test } = require('node:test');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Database integration tests must not run in production.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

process.env.NODE_PATH = require('node:path').resolve(__dirname, '../dist');
require('node:module').Module._initPaths();

const { Module, ValidationPipe, VersioningType } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { APP_GUARD, NestFactory, Reflector } = require('@nestjs/core');
const {
  PrismaModule,
} = require('../dist/src/infrastructure/prisma/prisma.module');
const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');
const {
  IntegrationsModule,
} = require('../dist/src/infrastructure/clients/integrations.module');
const { OutboxModule } = require('../dist/src/modules/outbox/outbox.module');
const { UsersModule } = require('../dist/src/modules/users/users.module');
const {
  InternalAuthGuard,
} = require('../dist/src/common/guards/internal-auth.guard');
const {
  TransformInterceptor,
} = require('../dist/src/common/interceptors/transform.interceptor');
const {
  HttpExceptionFilter,
} = require('../dist/src/common/filters/http-exception.filter');

const DAY_MS = 24 * 60 * 60 * 1000;

test('UC12.7 / UC13.7 re-invitation with isolated fixtures', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'reinvite-integration-key-0123456789';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      OutboxModule,
      IntegrationsModule,
      UsersModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: InternalAuthGuard }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  const db = app.get(PrismaService);

  const orgs = {
    active: randomUUID(),
    grace: randomUUID(),
    suspended: randomUUID(),
    other: randomUUID(),
  };
  const orgIds = Object.values(orgs);
  const organizer = randomUUID();
  const tag = randomUUID().slice(0, 8);
  const email = (name) => `reinvite-${tag}-${name}@example.test`;
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.accountToken.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.subscription.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  };

  try {
    await app.init();
    const plan = await db.subscriptionPlan.findFirst();
    assert.ok(plan, 'seed a subscription plan first (prisma:seed)');
    const settings = await db.platformSetting.findFirst();
    assert.ok(settings, 'seed platform settings first (prisma:seed)');
    const ttlDays = settings.invitationLinkTtlDays;

    await db.organization.createMany({
      data: orgIds.map((id, index) => ({
        id,
        name: `Reinvite fixture ${index}`,
        taxCode: `98000000${index}`,
        address: 'Test',
        contactPhone: '0900000000',
        status: 'Active',
      })),
    });
    const subscription = (organizationId, status) => ({
      organizationId,
      planId: plan.id,
      source: 'Registration',
      status,
      price: plan.price,
      durationDays: plan.durationDays,
      maxLearners: plan.maxLearners,
      maxInstructors: plan.maxInstructors,
      maxCourseChains: plan.maxCourseChains,
      maxStorageBytes: plan.maxStorageBytes,
      startsAt: new Date(Date.now() - 10 * DAY_MS),
      expiresAt: new Date(Date.now() + 20 * DAY_MS),
    });
    await db.subscription.createMany({
      data: [
        subscription(orgs.active, 'Active'),
        subscription(orgs.grace, 'Grace'),
        subscription(orgs.suspended, 'Suspended'),
        subscription(orgs.other, 'Active'),
      ],
    });

    const createUser = (organizationId, name, role, extra = {}) =>
      db.user.create({
        data: {
          organizationId,
          email: email(name),
          fullName: `Fixture ${name}`,
          role,
          status: 'Pending',
          ...extra,
        },
      });
    const token = (user, extra = {}) =>
      db.accountToken.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          purpose: 'Invitation',
          tokenHash: randomBytes(32),
          expiresAt: new Date(Date.now() - DAY_MS),
          ...extra,
        },
      });

    const expiredLearner = await createUser(orgs.active, 'l1', 'Learner');
    const expiredToken = await token(expiredLearner);
    const validInstructor = await createUser(orgs.active, 'i1', 'Instructor');
    const validToken = await token(validInstructor, {
      expiresAt: new Date(Date.now() + 3 * DAY_MS),
    });
    const activeLearner = await createUser(orgs.active, 'l2', 'Learner', {
      status: 'Active',
      activatedAt: new Date(),
    });
    const deactivatedLearner = await createUser(orgs.active, 'l3', 'Learner', {
      status: 'Deactivated',
    });
    const graceLearner = await createUser(orgs.grace, 'l4', 'Learner');
    const suspendedLearner = await createUser(orgs.suspended, 'l5', 'Learner');
    const otherOrgLearner = await createUser(orgs.other, 'l6', 'Learner');

    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/users`;
    const reinvite = (
      path,
      id,
      {
        org = orgs.active,
        role = 'ORGANIZER',
        key = process.env.INTERNAL_SERVICE_KEY,
      } = {},
    ) =>
      fetch(`${base}/${path}/${id}/invitations`, {
        method: 'POST',
        headers: {
          ...(key ? { 'x-internal-key': key } : {}),
          'x-user-id': organizer,
          'x-user-role': role,
          'x-organization-id': org,
        },
      });
    const errorCode = async (response) => (await response.json()).error.code;
    const openTokens = (userId) =>
      db.accountToken.findMany({
        where: { userId, consumedAt: null, revokedAt: null },
      });
    const emailsTo = (to) =>
      db.outboxEvent.findMany({
        where: {
          organizationId: { in: orgIds },
          payload: { path: ['to'], equals: to },
        },
      });

    await t.test(
      'UC13.7: a Learner whose invitation expired gets a new link and email',
      async () => {
        const before = Date.now();
        const response = await reinvite('learners', expiredLearner.id);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.message, 'Đã gửi lại lời mời Learner');
        assert.equal(body.data.id, expiredLearner.id);
        assert.equal(body.data.status, 'Pending');
        assert.equal(body.data.invitationExpired, false);
        assert.deepEqual(Object.keys(body.data).sort(), [
          'id',
          'invitation',
          'invitationExpired',
          'status',
        ]);
        const expiresAt = Date.parse(body.data.invitation.expiresAt);
        assert.ok(
          Math.abs(expiresAt - (before + ttlDays * DAY_MS)) < 60_000,
          'expiry is the configured invitation TTL',
        );

        const old = await db.accountToken.findUnique({
          where: { id: expiredToken.id },
        });
        assert.ok(old.revokedAt instanceof Date, 'old link is revoked');
        const open = await openTokens(expiredLearner.id);
        assert.equal(open.length, 1);
        assert.equal(open[0].expiresAt.getTime(), expiresAt);

        const emails = await emailsTo(expiredLearner.email);
        assert.equal(emails.length, 1);
        assert.equal(emails[0].payload.templateCode, 'LEARNER_INVITATION');
        assert.match(emails[0].payload.body, /\/activate\//);
        assert.match(
          emails[0].payload.body,
          new RegExp(new Date(expiresAt).toISOString()),
        );
      },
    );

    await t.test(
      'UC12.7: a Pending Instructor with a still-valid link is re-invited and the old link stops working',
      async () => {
        const response = await reinvite('instructors', validInstructor.id);
        assert.equal(response.status, 200);
        assert.equal(
          (await response.json()).message,
          'Đã gửi lại lời mời Instructor',
        );
        const old = await db.accountToken.findUnique({
          where: { id: validToken.id },
        });
        assert.ok(old.revokedAt instanceof Date);
        assert.equal((await openTokens(validInstructor.id)).length, 1);
        const [sent] = await emailsTo(validInstructor.email);
        assert.equal(sent.payload.templateCode, 'INSTRUCTOR_INVITATION');
      },
    );

    await t.test('re-inviting twice keeps exactly one open link', async () => {
      assert.equal((await reinvite('learners', expiredLearner.id)).status, 200);
      assert.equal((await openTokens(expiredLearner.id)).length, 1);
      assert.equal((await emailsTo(expiredLearner.email)).length, 2);
    });

    await t.test('Grace still allows re-invitation', async () => {
      const response = await reinvite('learners', graceLearner.id, {
        org: orgs.grace,
      });
      assert.equal(response.status, 200);
    });

    for (const [name, id, expected] of [
      ['an activated account', activeLearner.id, 'ACCOUNT_NOT_PENDING'],
      [
        'a deactivated, never activated account',
        deactivatedLearner.id,
        'ACCOUNT_NOT_PENDING',
      ],
    ]) {
      await t.test(`409 for ${name}, nothing sent`, async () => {
        const response = await reinvite('learners', id);
        assert.equal(response.status, 409);
        assert.equal(await errorCode(response), expected);
        assert.equal((await openTokens(id)).length, 0);
      });
    }

    for (const [name, path, id, options] of [
      ['a Learner of another organization', 'learners', otherOrgLearner.id, {}],
      [
        'an Instructor id on the Learner route',
        'learners',
        validInstructor.id,
        {},
      ],
      ['an unknown id', 'learners', randomUUID(), {}],
    ]) {
      await t.test(`404 for ${name}`, async () => {
        const response = await reinvite(path, id, options);
        assert.equal(response.status, 404);
        assert.equal(await errorCode(response), 'LEARNER_NOT_FOUND');
      });
    }

    await t.test(
      '403 when the Subscription is Suspended (view only)',
      async () => {
        const response = await reinvite('learners', suspendedLearner.id, {
          org: orgs.suspended,
        });
        assert.equal(response.status, 403);
        assert.equal(await errorCode(response), 'SUBSCRIPTION_NOT_ACTIVE');
        assert.equal((await openTokens(suspendedLearner.id)).length, 0);
      },
    );

    await t.test('403 for a role other than Organizer', async () => {
      const response = await reinvite('learners', expiredLearner.id, {
        role: 'LEARNER',
      });
      assert.equal(response.status, 403);
    });

    await t.test(
      '401 without the internal key, 400 for a non-UUID id',
      async () => {
        assert.equal(
          (await reinvite('learners', expiredLearner.id, { key: null })).status,
          401,
        );
        assert.equal((await reinvite('learners', 'not-a-uuid')).status, 400);
      },
    );
  } finally {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  }
});
