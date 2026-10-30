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
  IntegrationsModule,
} = require('../dist/src/infrastructure/clients/integrations.module');
const {
  SubscriptionsModule,
} = require('../dist/src/modules/subscriptions/subscriptions.module');
const {
  SubscriptionsRepository,
} = require('../dist/src/modules/subscriptions/subscriptions.repository');
const {
  SubscriptionUpgradesService,
} = require('../dist/src/modules/subscriptions/subscription-upgrades.service');
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

test('UC10.2 upgrade a Subscription', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'upgrade-integration-key-0123456789';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      IntegrationsModule,
      SubscriptionsModule,
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

  const tag = `Upgrade IT ${randomUUID().slice(0, 8)}`;
  const orgIds = [];
  const cleanup = async () => {
    await db.payment.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.subscription.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.subscriptionPlan.deleteMany({
      where: { name: { startsWith: tag } },
    });
  };

  try {
    await app.init();
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/subscriptions`;
    let planIndex = 0;
    const newPlan = (extra = {}) =>
      db.subscriptionPlan.create({
        data: {
          name: `${tag} ${(planIndex += 1)}`,
          price: 6000n,
          durationDays: 30,
          maxLearners: 100,
          maxInstructors: 10,
          maxCourseChains: 10,
          maxStorageBytes: 1000n,
          ...extra,
        },
      });
    const fixture = async (status = 'Active', { org = {} } = {}) => {
      const plan = await newPlan({ price: 3000n, maxLearners: 10 });
      const id = randomUUID();
      orgIds.push(id);
      await db.organization.create({
        data: {
          id,
          name: 'Upgrade fixture',
          taxCode: '9400000000',
          address: 'Test',
          contactPhone: '+84900000000',
          status: 'Active',
          ...org,
        },
      });
      const current = await db.subscription.create({
        data: {
          organizationId: id,
          planId: plan.id,
          source: 'Registration',
          status,
          price: 3000n,
          durationDays: 30,
          maxLearners: 10,
          maxInstructors: 5,
          maxCourseChains: 5,
          maxStorageBytes: 500n,
          startsAt: new Date(Date.now() - 20 * DAY_MS),
          expiresAt: new Date(Date.now() + 10 * DAY_MS),
        },
      });
      return { id, plan, current };
    };
    const headers = (org, role = 'ORGANIZER') => ({
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
      'x-user-id': randomUUID(),
      'x-user-role': role,
      'x-organization-id': org,
      'content-type': 'application/json',
    });
    const upgrade = (org, json, role) =>
      fetch(`${base}/upgrades`, {
        method: 'POST',
        headers: headers(org, role),
        body: JSON.stringify(json),
      });
    const options = (org, role) =>
      fetch(`${base}/upgrade-options`, { headers: headers(org, role) });
    const subscriptionsOf = (organizationId) =>
      db.subscription.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });
    const paymentsOf = (organizationId) =>
      db.payment.findMany({ where: { organizationId } });
    const errorCode = async (response) => (await response.json()).error.code;

    await t.test(
      'BR-18, BR-19: pays the prorated amount, new limits apply now, expiry unchanged',
      async () => {
        const { id, current } = await fixture();
        const target = await newPlan();
        const response = await upgrade(id, { planId: target.id });
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.paymentStatus, 'Succeeded');
        assert.equal(data.amount, 1000);
        assert.equal(data.subscription.planName, target.name);
        assert.equal(
          data.subscription.expiresAt,
          current.expiresAt.toISOString(),
        );
        const [old, created] = await subscriptionsOf(id);
        assert.equal(old.status, 'Ended');
        assert.equal(created.status, 'Active');
        assert.equal(created.source, 'Upgrade');
        assert.equal(created.planId, target.id);
        assert.equal(created.maxLearners, 100);
        assert.equal(created.price, 6000n);
        const [payment] = await paymentsOf(id);
        assert.equal(payment.kind, 'Upgrade');
        assert.equal(payment.status, 'Succeeded');
        assert.equal(payment.amount, 1000n);
        assert.equal(payment.subscriptionId, created.id);
      },
    );

    await t.test(
      'BR-19: a non-positive amount applies right away without a Payment',
      async () => {
        const { id } = await fixture();
        const target = await newPlan({ price: 3000n });
        const response = await upgrade(id, { planId: target.id });
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.paymentStatus, 'NotRequired');
        assert.equal(data.paymentId, null);
        assert.equal(data.amount, 0);
        assert.equal((await paymentsOf(id)).length, 0);
        const rows = await subscriptionsOf(id);
        assert.equal(rows[1].planId, target.id);
      },
    );

    await t.test(
      'a declined payment is stored as Failed and changes nothing',
      async () => {
        const { id, current } = await fixture();
        const target = await newPlan();
        const response = await upgrade(id, {
          planId: target.id,
          simulateFailure: true,
        });
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.paymentStatus, 'Failed');
        assert.equal(data.subscription, undefined);
        const [payment] = await paymentsOf(id);
        assert.equal(payment.status, 'Failed');
        const rows = await subscriptionsOf(id);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, current.id);
        assert.equal(rows[0].status, 'Active');
      },
    );

    for (const status of ['Grace', 'Suspended']) {
      await t.test(`BR-19: ${status} cannot upgrade`, async () => {
        const { id } = await fixture(status);
        const target = await newPlan();
        const response = await upgrade(id, { planId: target.id });
        assert.equal(response.status, 403);
        assert.equal(await errorCode(response), 'SUBSCRIPTION_NOT_ACTIVE');
        assert.equal((await paymentsOf(id)).length, 0);
        const view = (await (await options(id)).json()).data;
        assert.equal(view.blockedReason, 'SUBSCRIPTION_NOT_ACTIVE');
      });
    }

    await t.test('BR-20: a Scheduled term blocks the upgrade', async () => {
      const { id, plan, current } = await fixture();
      await db.subscription.create({
        data: {
          organizationId: id,
          planId: plan.id,
          source: 'Renewal',
          status: 'Scheduled',
          price: 3000n,
          durationDays: 30,
          maxLearners: 10,
          maxInstructors: 5,
          maxCourseChains: 5,
          maxStorageBytes: 500n,
          startsAt: current.expiresAt,
          expiresAt: new Date(current.expiresAt.getTime() + 30 * DAY_MS),
        },
      });
      const target = await newPlan();
      const response = await upgrade(id, { planId: target.id });
      assert.equal(response.status, 409);
      assert.equal(await errorCode(response), 'RENEWAL_ALREADY_SCHEDULED');
      assert.equal((await paymentsOf(id)).length, 0);
      const view = (await (await options(id)).json()).data;
      assert.equal(view.blockedReason, 'RENEWAL_ALREADY_SCHEDULED');
    });

    await t.test('BR-3: a discontinued target is rejected', async () => {
      const { id } = await fixture();
      const target = await newPlan({ isOffered: false });
      const response = await upgrade(id, { planId: target.id });
      assert.equal(response.status, 400);
      assert.equal(await errorCode(response), 'PLAN_NOT_AVAILABLE');
      const view = (await (await options(id)).json()).data;
      assert.ok(!view.options.some((option) => option.id === target.id));
    });

    await t.test(
      'the current plan and an unknown plan are rejected',
      async () => {
        const { id, plan } = await fixture();
        assert.equal((await upgrade(id, { planId: plan.id })).status, 400);
        assert.equal((await upgrade(id, { planId: randomUUID() })).status, 400);
        const view = (await (await options(id)).json()).data;
        assert.ok(!view.options.some((option) => option.id === plan.id));
      },
    );

    await t.test(
      'BR-21: a plan below a held limit is a downgrade, even above usage',
      async () => {
        const { id } = await fixture();
        const target = await newPlan({ maxInstructors: 4 });
        const response = await upgrade(id, { planId: target.id });
        assert.equal(response.status, 409);
        assert.equal(await errorCode(response), 'UPGRADE_LIMITS_TOO_LOW');
        const view = (await (await options(id)).json()).data;
        assert.deepEqual(
          view.options.find((option) => option.id === target.id).blockedBy,
          [{ limit: 'instructors', newLimit: 4, required: 5 }],
        );
      },
    );

    await t.test('BR-18: a plan below current usage is rejected', async () => {
      const { id } = await fixture();
      await db.user.createMany({
        data: Array.from({ length: 12 }, (_, index) => ({
          organizationId: id,
          email: `upgrade-${id}-${index}@example.test`,
          fullName: `Learner ${index}`,
          role: 'Learner',
          status: 'Active',
        })),
      });
      const target = await newPlan({ maxLearners: 11 });
      const response = await upgrade(id, { planId: target.id });
      assert.equal(response.status, 409);
      assert.equal(await errorCode(response), 'UPGRADE_LIMITS_TOO_LOW');
      assert.equal((await paymentsOf(id)).length, 0);
    });

    await t.test(
      'two concurrent upgrades: only one is charged and applied',
      async () => {
        const { id } = await fixture();
        const target = await newPlan();
        const responses = await Promise.all([
          upgrade(id, { planId: target.id }),
          upgrade(id, { planId: target.id }),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        assert.equal((await paymentsOf(id)).length, 1);
        assert.equal((await subscriptionsOf(id)).length, 2);
      },
    );

    await t.test('upgrade options show the amount per plan', async () => {
      const { id } = await fixture();
      const target = await newPlan();
      const response = await options(id);
      assert.equal(response.status, 200);
      const view = (await response.json()).data;
      assert.equal(view.blockedReason, null);
      assert.equal(view.remainingDays, 10);
      assert.equal(view.currentPrice, 3000);
      assert.equal(view.currentDurationDays, 30);
      const option = view.options.find((item) => item.id === target.id);
      assert.equal(option.amount, 1000);
      assert.deepEqual(option.blockedBy, []);
    });

    await t.test(
      'BR-18: usage that cannot be checked is 503, nothing charged',
      async () => {
        const { id } = await fixture();
        const target = await newPlan();
        const service = new SubscriptionUpgradesService(
          db,
          new SubscriptionsRepository(db),
          { getOrganizationUsage: () => Promise.reject(new Error('down')) },
          {
            charge: () => {
              throw new Error('must not charge');
            },
          },
        );
        await assert.rejects(
          service.upgrade(
            {
              userId: randomUUID(),
              role: 'ORGANIZER',
              organizationId: id,
              isAuthenticated: true,
            },
            { planId: target.id },
          ),
          (error) =>
            error.getStatus() === 503 &&
            error.getResponse().code === 'USAGE_UNAVAILABLE',
        );
        assert.equal((await paymentsOf(id)).length, 0);
      },
    );

    await t.test('an Organization suspended by the Admin is 403', async () => {
      const { id } = await fixture('Active', { org: { status: 'Suspended' } });
      const target = await newPlan();
      const response = await upgrade(id, { planId: target.id });
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), 'ORGANIZATION_NOT_ACTIVE');
    });

    for (const role of ['INSTRUCTOR', 'LEARNER']) {
      await t.test(`403 for ${role}`, async () => {
        const { id } = await fixture();
        const target = await newPlan();
        assert.equal(
          (await upgrade(id, { planId: target.id }, role)).status,
          403,
        );
        assert.equal((await options(id, role)).status, 403);
      });
    }

    await t.test('400 for a non-UUID plan and an unknown field', async () => {
      const { id } = await fixture();
      assert.equal((await upgrade(id, { planId: 'x' })).status, 400);
      assert.equal(
        (await upgrade(id, { planId: randomUUID(), amount: 1 })).status,
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
