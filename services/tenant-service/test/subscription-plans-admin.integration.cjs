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
  SubscriptionPlansModule,
} = require('../dist/src/modules/subscription-plans/subscription-plans.module');
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

test('UC43 / UC43.1 Admin subscription plans', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'admin-plans-integration-key-0123456789';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      SubscriptionPlansModule,
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

  const tag = `IT ${randomUUID().slice(0, 8)}`;
  const orgIds = [randomUUID(), randomUUID(), randomUUID()];
  const cleanup = async () => {
    await db.subscription.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.subscriptionPlan.deleteMany({
      where: { name: { startsWith: tag } },
    });
  };

  const body = (name, extra = {}) => ({
    name,
    price: 4990000,
    durationDays: 180,
    maxLearners: 500,
    maxInstructors: 25,
    maxCourseChains: 50,
    maxStorageBytes: 120 * 1024 ** 3,
    ...extra,
  });

  try {
    await app.init();
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/api/v1`;
    const admin = { 'x-user-id': randomUUID(), 'x-user-role': 'ADMIN' };
    const call = (
      method,
      path,
      { headers = admin, json, key = process.env.INTERNAL_SERVICE_KEY } = {},
    ) =>
      fetch(`${url}${path}`, {
        method,
        headers: {
          ...(key ? { 'x-internal-key': key } : {}),
          ...headers,
          ...(json ? { 'content-type': 'application/json' } : {}),
        },
        body: json ? JSON.stringify(json) : undefined,
      });
    const errorCode = async (response) => (await response.json()).error.code;

    let created;
    await t.test(
      'UC43.1: an Admin without an organization creates an offered plan',
      async () => {
        const response = await call('POST', '/admin/subscription-plans', {
          json: body(`  ${tag}   Growth `),
        });
        assert.equal(response.status, 201);
        const payload = await response.json();
        assert.equal(payload.message, 'Tạo Subscription Plan thành công');
        created = payload.data;
        assert.equal(created.name, `${tag} Growth`);
        assert.equal(created.isOffered, true);
        assert.equal(created.organizationCount, 0);
        assert.equal(created.price, 4990000);
        assert.equal(created.maxStorageBytes, 120 * 1024 ** 3);
        const row = await db.subscriptionPlan.findUnique({
          where: { id: created.id },
        });
        assert.equal(row.price, 4990000n);
        assert.equal(row.maxStorageBytes, BigInt(120 * 1024 ** 3));
      },
    );

    await t.test(
      'UC01: the new plan is offered to Guests right away',
      async () => {
        const response = await fetch(`${url}/subscription-plans`, {
          headers: { 'x-internal-key': process.env.INTERNAL_SERVICE_KEY },
        });
        assert.equal(response.status, 200);
        const ids = (await response.json()).data.map((plan) => plan.id);
        assert.ok(ids.includes(created.id));
      },
    );

    await t.test(
      '409 for a name already used, ignoring case and extra spaces',
      async () => {
        const response = await call('POST', '/admin/subscription-plans', {
          json: body(`${tag.toLowerCase()}  GROWTH`),
        });
        assert.equal(response.status, 409);
        assert.equal(await errorCode(response), 'PLAN_NAME_TAKEN');
      },
    );

    await t.test(
      'two concurrent creates with one name: exactly one succeeds',
      async () => {
        const responses = await Promise.all([
          call('POST', '/admin/subscription-plans', {
            json: body(`${tag} Race`),
          }),
          call('POST', '/admin/subscription-plans', {
            json: body(`${tag} race`),
          }),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      },
    );

    for (const [name, json] of [
      ['a negative price', body(`${tag} A`, { price: -1 })],
      ['a decimal price', body(`${tag} B`, { price: 10.5 })],
      ['a zero duration', body(`${tag} C`, { durationDays: 0 })],
      ['zero learners', body(`${tag} D`, { maxLearners: 0 })],
      ['a string limit', body(`${tag} E`, { maxCourseChains: '50' })],
      ['a blank name', body('   ')],
      ['a name over 100 characters', body(`${tag} ${'x'.repeat(100)}`)],
      ['an unknown field', body(`${tag} F`, { isOffered: false })],
      ['a missing field', { name: `${tag} G`, price: 1 }],
    ]) {
      await t.test(`400 for ${name}`, async () => {
        const response = await call('POST', '/admin/subscription-plans', {
          json,
        });
        assert.equal(response.status, 400);
      });
    }

    await t.test(
      'UC43: lists every plan with offering state and organizations currently using it',
      async () => {
        const stopped = await db.subscriptionPlan.create({
          data: {
            name: `${tag} Legacy`,
            price: 1n,
            durationDays: 30,
            maxLearners: 1,
            maxInstructors: 1,
            maxCourseChains: 1,
            maxStorageBytes: 1n,
            isOffered: false,
          },
        });
        await db.organization.createMany({
          data: orgIds.map((id, index) => ({
            id,
            name: `Plan count fixture ${index}`,
            taxCode: `97000000${index}`,
            address: 'Test',
            contactPhone: '0900000000',
            status: 'Active',
          })),
        });
        const subscription = (organizationId, planId, status) => ({
          organizationId,
          planId,
          source: 'Registration',
          status,
          price: 1n,
          durationDays: 30,
          maxLearners: 1,
          maxInstructors: 1,
          maxCourseChains: 1,
          maxStorageBytes: 1n,
          startsAt: new Date(Date.now() - DAY_MS),
          expiresAt: new Date(Date.now() + DAY_MS),
        });
        await db.subscription.createMany({
          data: [
            subscription(orgIds[0], created.id, 'Active'),
            subscription(orgIds[1], created.id, 'Grace'),
            subscription(orgIds[2], created.id, 'Ended'),
            subscription(orgIds[0], created.id, 'Scheduled'),
            subscription(orgIds[2], stopped.id, 'Suspended'),
          ],
        });

        const response = await call('GET', '/admin/subscription-plans');
        assert.equal(response.status, 200);
        const plans = (await response.json()).data;
        const byId = new Map(plans.map((plan) => [plan.id, plan]));
        assert.equal(byId.get(created.id).organizationCount, 2);
        assert.equal(byId.get(stopped.id).isOffered, false);
        assert.equal(byId.get(stopped.id).organizationCount, 1);
        const firstStopped = plans.findIndex((plan) => !plan.isOffered);
        assert.ok(
          plans.slice(firstStopped).every((plan) => !plan.isOffered),
          'offered plans come first',
        );

        const offered = await fetch(`${url}/subscription-plans`, {
          headers: { 'x-internal-key': process.env.INTERNAL_SERVICE_KEY },
        });
        const offeredIds = (await offered.json()).data.map((plan) => plan.id);
        assert.ok(!offeredIds.includes(stopped.id), 'UC01 hides it (BR-3)');
      },
    );

    for (const role of ['ORGANIZER', 'INSTRUCTOR', 'LEARNER']) {
      await t.test(`403 for ${role}`, async () => {
        const headers = {
          'x-user-id': randomUUID(),
          'x-user-role': role,
          'x-organization-id': orgIds[0],
        };
        assert.equal(
          (await call('GET', '/admin/subscription-plans', { headers })).status,
          403,
        );
        assert.equal(
          (
            await call('POST', '/admin/subscription-plans', {
              headers,
              json: body(`${tag} ${role}`),
            })
          ).status,
          403,
        );
      });
    }

    await t.test(
      '401 without the internal key or without a user, and for an Organizer without an organization',
      async () => {
        assert.equal(
          (await call('GET', '/admin/subscription-plans', { key: null }))
            .status,
          401,
        );
        assert.equal(
          (await call('GET', '/admin/subscription-plans', { headers: {} }))
            .status,
          401,
        );
        assert.equal(
          (
            await call('GET', '/admin/subscription-plans', {
              headers: {
                'x-user-id': randomUUID(),
                'x-user-role': 'ORGANIZER',
              },
            })
          ).status,
          401,
        );
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
