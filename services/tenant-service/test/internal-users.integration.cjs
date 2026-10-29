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
const { Prisma } = require('../dist/generated/prisma/client');
const {
  InternalUsersModule,
} = require('../dist/src/modules/internal-users/internal-users.module');
const {
  lookupUsersQuery,
} = require('../dist/src/modules/internal-users/internal-users.repository');
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

test('internal lookup with isolated organization fixtures', async (t) => {
  const organizationId = '019a1111-2420-7000-8000-000000000001';
  const otherOrganizationId = '019a1111-2420-7000-8000-000000000002';
  const fixtureOrganizations = [organizationId, otherOrganizationId];
  process.env.INTERNAL_SERVICE_KEY = 'uc242-integration-key';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      InternalUsersModule,
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
  const cleanup = async () => {
    await db.user.deleteMany({
      where: { organizationId: { in: fixtureOrganizations } },
    });
    await db.organization.deleteMany({
      where: { id: { in: fixtureOrganizations } },
    });
  };
  try {
    await app.init();
    await cleanup();
    await db.organization.createMany({
      data: fixtureOrganizations.map((id, index) => ({
        id,
        name: 'UC24.2 integration fixture',
        taxCode: `242000000${index}`,
        address: 'Test',
        contactPhone: '0900000000',
        status: 'Active',
      })),
    });
    const activatedAt = new Date('2026-10-01T00:00:00Z');
    const cases = [
      {
        name: 'normal Learner',
        role: 'Learner',
        status: 'Active',
        activatedAt,
        deletedAt: null,
      },
      {
        name: 'unactivated Learner',
        role: 'Learner',
        status: 'Pending',
        activatedAt: null,
        deletedAt: null,
      },
      {
        name: 'deactivated Learner',
        role: 'Learner',
        status: 'Deactivated',
        activatedAt,
        deletedAt: null,
      },
      {
        name: 'deleted Learner',
        role: 'Learner',
        status: 'Active',
        activatedAt,
        deletedAt: activatedAt,
      },
      {
        name: 'Instructor',
        role: 'Instructor',
        status: 'Active',
        activatedAt,
        deletedAt: null,
      },
    ].map((item) => ({ ...item, id: randomUUID() }));
    const foreignId = randomUUID();
    const missingId = randomUUID();
    const fillerIds = Array.from({ length: 493 }, randomUUID);
    await db.user.createMany({
      data: [
        ...cases.map(({ name, ...item }) => ({
          ...item,
          organizationId,
          fullName: name,
          email: `${item.id}@uc242.test`,
        })),
        ...fillerIds.map((id) => ({
          id,
          organizationId,
          fullName: 'Fixture Learner',
          email: `${id}@uc242.test`,
          role: 'Learner',
          status: 'Pending',
        })),
        {
          id: foreignId,
          organizationId: otherOrganizationId,
          fullName: 'Other organization',
          email: `${foreignId}@uc242.test`,
          role: 'Learner',
          status: 'Active',
        },
      ],
    });
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/api/v1/internal/users/lookup`;
    const userIds = [
      ...cases.map(({ id }) => id),
      ...fillerIds,
      foreignId,
      missingId,
    ];
    const call = (key, headerOrganizationId) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(key ? { 'x-internal-key': key } : {}),
          ...(headerOrganizationId
            ? { 'x-organization-id': headerOrganizationId }
            : {}),
        },
        body: JSON.stringify({ organizationId, userIds }),
      });
    const response = await call(
      process.env.INTERNAL_SERVICE_KEY,
      organizationId,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.statusCode, 200);
    assert.equal(body.message, 'Users looked up');
    assert.equal(body.data.items.length, 498);
    for (const expected of cases) {
      await t.test(`returns ${expected.name} unchanged`, () => {
        assert.deepEqual(
          body.data.items.find((item) => item.userId === expected.id),
          {
            userId: expected.id,
            role: expected.role,
            status: expected.status,
            activatedAt: expected.activatedAt?.toISOString() ?? null,
            deletedAt: expected.deletedAt?.toISOString() ?? null,
            fullName: expected.name,
            email: `${expected.id}@uc242.test`,
          },
        );
      });
    }
    await t.test('omits user from other organization', () =>
      assert.ok(!body.data.items.some((item) => item.userId === foreignId)),
    );
    await t.test('omits nonexistent ID', () =>
      assert.ok(!body.data.items.some((item) => item.userId === missingId)),
    );
    await t.test('rejects missing internal key', async () =>
      assert.equal((await call()).status, 401),
    );
    await t.test('returns 404 when x-organization-id is missing', async () => {
      const missing = await call(process.env.INTERNAL_SERVICE_KEY);
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).error.code, 'ORGANIZATION_NOT_FOUND');
    });
    await t.test('returns 404 when x-organization-id differs', async () => {
      const mismatched = await call(
        process.env.INTERNAL_SERVICE_KEY,
        otherOrganizationId,
      );
      assert.equal(mismatched.status, 404);
      assert.equal(
        (await mismatched.json()).error.code,
        'ORGANIZATION_NOT_FOUND',
      );
    });
    const existence = (userId, key = process.env.INTERNAL_SERVICE_KEY) =>
      fetch(url.replace(/\/lookup$/, `/${userId}/existence`), {
        headers: key ? { 'x-internal-key': key } : {},
      });
    const pendingLearner = cases.find((c) => c.name === 'unactivated Learner');
    const deletedLearner = cases.find((c) => c.name === 'deleted Learner');
    for (const [name, userId, expected] of [
      ['an active user', cases[0].id, true],
      ['a Pending user', pendingLearner.id, true],
      ['a soft-deleted user', deletedLearner.id, false],
      ['a user that never existed', missingId, false],
    ]) {
      await t.test(`existence: ${name} -> exists=${expected}`, async () => {
        const response = await existence(userId);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.statusCode, 200);
        assert.equal(body.message, 'User existence checked');
        assert.deepEqual(body.data, { exists: expected });
      });
    }
    await t.test(
      'existence needs no x-organization-id but rejects a missing key',
      async () => {
        assert.equal((await existence(cases[0].id, null)).status, 401);
        assert.equal((await existence(cases[0].id, 'wrong-key')).status, 401);
      },
    );
    await t.test('existence rejects a non-UUID userId with 400', async () => {
      assert.equal((await existence('not-a-uuid')).status, 400);
    });
    await t.test('EXPLAIN ANALYZE with 500 IDs', async () => {
      const plan = await db.$queryRaw(
        Prisma.sql`EXPLAIN (ANALYZE, FORMAT JSON) ${lookupUsersQuery(organizationId, userIds)}`,
      );
      const result = plan[0]['QUERY PLAN'][0];
      const scans = [];
      const collectScans = (node) => {
        if (node['Node Type'].includes('Scan')) {
          scans.push({ type: node['Node Type'], index: node['Index Name'] });
        }
        for (const child of node.Plans ?? []) collectScans(child);
      };
      collectScans(result.Plan);
      console.log(
        'UC24.2 EXPLAIN ANALYZE:',
        JSON.stringify({
          inputIds: userIds.length,
          scans,
          actualRows: result.Plan['Actual Rows'],
          planningMs: result['Planning Time'],
          executionMs: result['Execution Time'],
        }),
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
