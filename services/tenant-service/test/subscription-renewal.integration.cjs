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
  SubscriptionActivationService,
} = require('../dist/src/modules/subscriptions/subscription-activation.service');
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

test('UC10.1 renew a Subscription', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'renewal-integration-key-0123456789';
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

  const tag = `Renew IT ${randomUUID().slice(0, 8)}`;
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
          price: 1000n,
          durationDays: 30,
          maxLearners: 100,
          maxInstructors: 10,
          maxCourseChains: 1000,
          maxStorageBytes: 10n ** 15n,
          ...extra,
        },
      });
    const fixture = async (status, { plan, expiresAt, org = {} } = {}) => {
      const usedPlan = plan ?? (await newPlan());
      const id = randomUUID();
      orgIds.push(id);
      await db.organization.create({
        data: {
          id,
          name: 'Renew fixture',
          taxCode: '9500000000',
          address: 'Test',
          contactPhone: '+84900000000',
          status: 'Active',
          ...org,
        },
      });
      const current = await db.subscription.create({
        data: {
          organizationId: id,
          planId: usedPlan.id,
          source: 'Registration',
          status,
          price: 500n,
          durationDays: 30,
          maxLearners: 5,
          maxInstructors: 5,
          maxCourseChains: 5,
          maxStorageBytes: 5n,
          startsAt: new Date(Date.now() - 40 * DAY_MS),
          expiresAt: expiresAt ?? new Date(Date.now() + 10 * DAY_MS),
        },
      });
      return { id, plan: usedPlan, current };
    };
    const headers = (org, role = 'ORGANIZER') => ({
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
      'x-user-id': randomUUID(),
      'x-user-role': role,
      'x-organization-id': org,
      'content-type': 'application/json',
    });
    const renew = (org, json = {}, role) =>
      fetch(`${base}/renewals`, {
        method: 'POST',
        headers: headers(org, role),
        body: JSON.stringify(json),
      });
    const quote = (org, role) =>
      fetch(`${base}/renewal-quote`, { headers: headers(org, role) });
    const subscriptionsOf = (organizationId) =>
      db.subscription.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });
    const paymentsOf = (organizationId) =>
      db.payment.findMany({ where: { organizationId } });
    const errorCode = async (response) => (await response.json()).error.code;

    await t.test(
      'BR-17: Active renews early, a Scheduled term starts at the current expiry',
      async () => {
        const { id, current, plan } = await fixture('Active');
        const response = await renew(id);
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.paymentStatus, 'Succeeded');
        assert.equal(data.subscription.status, 'Scheduled');
        assert.equal(
          data.subscription.startsAt,
          current.expiresAt.toISOString(),
        );
        assert.equal(
          data.subscription.expiresAt,
          new Date(current.expiresAt.getTime() + 30 * DAY_MS).toISOString(),
        );
        const rows = await subscriptionsOf(id);
        assert.deepEqual(
          rows.map((row) => row.status),
          ['Active', 'Scheduled'],
        );
        const [payment] = await paymentsOf(id);
        assert.equal(payment.kind, 'Renewal');
        assert.equal(payment.status, 'Succeeded');
        assert.equal(payment.amount, plan.price);
        assert.equal(payment.subscriptionId, rows[1].id);
        assert.ok(payment.providerReference);
      },
    );

    await t.test(
      'BR-17: a second early renewal is 409 before any payment',
      async () => {
        const { id } = await fixture('Active');
        assert.equal((await renew(id)).status, 200);
        const response = await renew(id);
        assert.equal(response.status, 409);
        assert.equal(await errorCode(response), 'RENEWAL_ALREADY_SCHEDULED');
        assert.equal((await paymentsOf(id)).length, 1);
        assert.equal((await subscriptionsOf(id)).length, 2);
      },
    );

    await t.test(
      'BR-15: Grace counts from the old expiry and ends the old term',
      async () => {
        const expiresAt = new Date(Date.now() - 3 * DAY_MS);
        const { id } = await fixture('Grace', { expiresAt });
        const response = await renew(id);
        assert.equal(response.status, 200);
        const { subscription } = (await response.json()).data;
        assert.equal(subscription.status, 'Active');
        assert.equal(subscription.startsAt, expiresAt.toISOString());
        const rows = await subscriptionsOf(id);
        assert.deepEqual(
          rows.map((row) => row.status),
          ['Ended', 'Active'],
        );
        assert.ok(rows[0].endedAt instanceof Date);
      },
    );

    await t.test(
      'BR-16: Suspended counts from the payment date and lifts the suspension',
      async () => {
        const { id } = await fixture('Suspended', {
          expiresAt: new Date(Date.now() - 20 * DAY_MS),
        });
        const before = Date.now();
        const response = await renew(id);
        assert.equal(response.status, 200);
        const { subscription } = (await response.json()).data;
        assert.equal(subscription.status, 'Active');
        const startsAt = Date.parse(subscription.startsAt);
        assert.ok(startsAt >= before && startsAt <= Date.now());
        assert.deepEqual(
          (await subscriptionsOf(id)).map((row) => row.status),
          ['Ended', 'Active'],
        );
      },
    );

    await t.test(
      'BR-3, BR-4: a discontinued plan still renews, at its current price and limits',
      async () => {
        const plan = await newPlan({
          isOffered: false,
          price: 7777n,
          maxLearners: 42,
        });
        const { id } = await fixture('Grace', {
          plan,
          expiresAt: new Date(Date.now() - DAY_MS),
        });
        assert.equal((await renew(id)).status, 200);
        const [, renewed] = await subscriptionsOf(id);
        assert.equal(renewed.price, 7777n);
        assert.equal(renewed.maxLearners, 42);
        const [payment] = await paymentsOf(id);
        assert.equal(payment.amount, 7777n);
      },
    );

    await t.test(
      'a declined payment is stored as Failed and changes nothing',
      async () => {
        const { id } = await fixture('Grace', {
          expiresAt: new Date(Date.now() - DAY_MS),
        });
        const response = await renew(id, { simulateFailure: true });
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.paymentStatus, 'Failed');
        assert.ok(data.failureReason);
        assert.equal(data.subscription, undefined);
        const [payment] = await paymentsOf(id);
        assert.equal(payment.status, 'Failed');
        assert.deepEqual(
          (await subscriptionsOf(id)).map((row) => row.status),
          ['Grace'],
        );
      },
    );

    await t.test(
      'two concurrent renewals: only one is charged and applied',
      async () => {
        const { id } = await fixture('Active');
        const responses = await Promise.all([renew(id), renew(id)]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        assert.equal((await paymentsOf(id)).length, 1);
        assert.equal((await subscriptionsOf(id)).length, 2);
      },
    );

    await t.test(
      'BR-4: the quote shows current plan values and any exceeded limit',
      async () => {
        const plan = await newPlan({ price: 2500n, maxLearners: 1 });
        const { id, current } = await fixture('Active', { plan });
        await db.user.createMany({
          data: ['a', 'b'].map((name) => ({
            organizationId: id,
            email: `renew-${id}-${name}@example.test`,
            fullName: name,
            role: 'Learner',
            status: 'Active',
          })),
        });
        const response = await quote(id);
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.planName, plan.name);
        assert.equal(data.price, 2500);
        assert.equal(data.currentStatus, 'Active');
        assert.equal(data.startsAt, current.expiresAt.toISOString());
        assert.equal(data.scheduledRenewal, null);
        assert.deepEqual(
          data.exceededLimits.find((item) => item.limit === 'learners'),
          { limit: 'learners', used: 2, newLimit: 1 },
        );
        assert.equal(
          (await subscriptionsOf(id)).length,
          1,
          'a quote changes nothing',
        );
      },
    );

    await t.test('the quote reports an existing Scheduled term', async () => {
      const { id } = await fixture('Active');
      await renew(id);
      const data = (await (await quote(id)).json()).data;
      assert.ok(data.scheduledRenewal);
    });

    await t.test('403 for an Organization suspended by the Admin', async () => {
      const { id } = await fixture('Active', { org: { status: 'Suspended' } });
      const response = await renew(id);
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), 'ORGANIZATION_NOT_ACTIVE');
      assert.equal((await paymentsOf(id)).length, 0);
    });

    await t.test('403 when there is no current Subscription', async () => {
      const { id } = await fixture('Ended');
      const response = await renew(id);
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), 'SUBSCRIPTION_NOT_FOUND');
    });

    for (const role of ['INSTRUCTOR', 'LEARNER']) {
      await t.test(`403 for ${role}`, async () => {
        const { id } = await fixture('Active');
        assert.equal((await renew(id, {}, role)).status, 403);
        assert.equal((await quote(id, role)).status, 403);
        assert.equal((await paymentsOf(id)).length, 0);
      });
    }

    await t.test('400 for an unknown field', async () => {
      const { id } = await fixture('Active');
      assert.equal((await renew(id, { amount: 1 })).status, 400);
    });

    const job = app.get(SubscriptionActivationService);
    await t.test(
      'the job activates a due Scheduled term and ends the current one',
      async () => {
        const { id } = await fixture('Active');
        await renew(id);
        const [, scheduled] = await subscriptionsOf(id);
        await db.subscription.update({
          where: { id: scheduled.id },
          data: { startsAt: new Date(Date.now() - 1000) },
        });
        await job.activateDue();
        const rows = await subscriptionsOf(id);
        assert.deepEqual(
          rows.map((row) => row.status),
          ['Ended', 'Active'],
        );
        assert.ok(rows[0].endedAt instanceof Date);
      },
    );

    await t.test(
      'the job leaves a Scheduled term before its start',
      async () => {
        const { id } = await fixture('Active');
        await renew(id);
        await job.activateDue();
        assert.deepEqual(
          (await subscriptionsOf(id)).map((row) => row.status),
          ['Active', 'Scheduled'],
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
