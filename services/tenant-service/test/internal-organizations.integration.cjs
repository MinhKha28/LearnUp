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
  InternalOrganizationsModule,
} = require('../dist/src/modules/internal-organizations/internal-organizations.module');
const {
  PrismaModule,
} = require('../dist/src/infrastructure/prisma/prisma.module');
const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');
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

test('internal organization access with isolated fixtures', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'org-access-integration-key-0123456789';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      InternalOrganizationsModule,
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

  const fixtures = {
    active: randomUUID(),
    grace: randomUUID(),
    suspended: randomUUID(),
    noSubscription: randomUUID(),
  };
  const ids = Object.values(fixtures);
  const cleanup = async () => {
    await db.subscription.deleteMany({
      where: { organizationId: { in: ids } },
    });
    await db.organization.deleteMany({ where: { id: { in: ids } } });
  };
  const suspendedAt = new Date('2026-10-10T00:00:00Z');

  try {
    await app.init();
    const plan = await db.subscriptionPlan.findFirst();
    assert.ok(plan, 'seed a subscription plan first (prisma:seed)');
    await db.organization.createMany({
      data: ids.map((id, index) => ({
        id,
        name: 'Access integration fixture',
        taxCode: `99000000${index}`,
        address: 'Test',
        contactPhone: '0900000000',
        status: id === fixtures.noSubscription ? 'Suspended' : 'Active',
        timezone: id === fixtures.grace ? 'Asia/Tokyo' : 'Asia/Ho_Chi_Minh',
      })),
    });
    const subscription = (organizationId, status, extra = {}) => ({
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
      startsAt: new Date('2026-09-01T00:00:00Z'),
      expiresAt: new Date('2026-10-01T00:00:00Z'),
      ...extra,
    });
    await db.subscription.createMany({
      data: [
        subscription(fixtures.active, 'Active'),
        subscription(fixtures.grace, 'Grace'),
        subscription(fixtures.suspended, 'Suspended', { suspendedAt }),
      ],
    });
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/internal/organizations`;
    const access = (
      id,
      { key = process.env.INTERNAL_SERVICE_KEY, org = id } = {},
    ) =>
      fetch(`${base}/${id}/access`, {
        headers: {
          ...(key ? { 'x-internal-key': key } : {}),
          ...(org ? { 'x-organization-id': org } : {}),
        },
      });
    const dataOf = async (response) => {
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.statusCode, 200);
      assert.equal(body.message, 'Organization access checked');
      return body.data;
    };

    for (const [name, id, expected] of [
      [
        'Active',
        fixtures.active,
        {
          organizationStatus: 'Active',
          subscriptionStatus: 'Active',
          readOnlyEndsAt: null,
          timezone: 'Asia/Ho_Chi_Minh',
        },
      ],
      [
        'Grace',
        fixtures.grace,
        {
          organizationStatus: 'Active',
          subscriptionStatus: 'Grace',
          readOnlyEndsAt: null,
          timezone: 'Asia/Tokyo',
        },
      ],
      [
        'Suspended (BR-24 read-only window)',
        fixtures.suspended,
        {
          organizationStatus: 'Active',
          subscriptionStatus: 'Suspended',
          readOnlyEndsAt: new Date(
            suspendedAt.getTime() + 30 * DAY_MS,
          ).toISOString(),
          timezone: 'Asia/Ho_Chi_Minh',
        },
      ],
      [
        'no current subscription',
        fixtures.noSubscription,
        {
          organizationStatus: 'Suspended',
          subscriptionStatus: 'Ended',
          readOnlyEndsAt: null,
          timezone: 'Asia/Ho_Chi_Minh',
        },
      ],
    ]) {
      await t.test(`access: ${name}`, async () => {
        assert.deepEqual(await dataOf(await access(id)), {
          organizationId: id,
          ...expected,
        });
      });
    }

    await t.test(
      'access: x-service-name is accepted for logging only',
      async () => {
        const response = await fetch(`${base}/${fixtures.active}/access`, {
          headers: {
            'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
            'x-organization-id': fixtures.active,
            'x-service-name': 'achievement-reporting-service',
          },
        });
        assert.equal((await dataOf(response)).subscriptionStatus, 'Active');
      },
    );

    for (const [name, options] of [
      ['missing x-organization-id', { org: null }],
      ['another organization in the header', { org: fixtures.grace }],
    ]) {
      await t.test(`access: 404 for ${name}`, async () => {
        const response = await access(fixtures.active, options);
        assert.equal(response.status, 404);
        assert.equal(
          (await response.json()).error.code,
          'ORGANIZATION_NOT_FOUND',
        );
      });
    }
    await t.test('access: 404 for an unknown organization', async () => {
      const unknown = randomUUID();
      const response = await access(unknown);
      assert.equal(response.status, 404);
      assert.equal(
        (await response.json()).error.code,
        'ORGANIZATION_NOT_FOUND',
      );
    });
    await t.test(
      'access: 401 without or with a wrong internal key',
      async () => {
        assert.equal(
          (await access(fixtures.active, { key: null })).status,
          401,
        );
        assert.equal(
          (await access(fixtures.active, { key: 'wrong-key' })).status,
          401,
        );
      },
    );
    await t.test('access: 400 for a non-UUID organization id', async () => {
      assert.equal(
        (await access('not-a-uuid', { org: 'not-a-uuid' })).status,
        400,
      );
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  }
});
