// UC44 - Admin xem danh sách Organization: trạng thái Cancelled suy ra lúc đọc, bộ lọc mặc định,
// phân trang, nguồn của gói, quyền ADMIN và kiểm tra query. Không cần database.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { Module, ValidationPipe, VersioningType } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { APP_GUARD, NestFactory, Reflector } = require('@nestjs/core');
const {
  OrganizationsService,
} = require('../dist/src/modules/organizations/organizations.service');
const {
  OrganizationsRepository,
} = require('../dist/src/modules/organizations/organizations.repository');
const {
  AdminOrganizationsController,
} = require('../dist/src/modules/organizations/admin-organizations.controller');
const {
  OrganizationsController,
} = require('../dist/src/modules/organizations/organizations.controller');
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
const NOW = Date.now();
const future = new Date(NOW + DAY_MS);
const past = new Date(NOW - DAY_MS);
const starter = { id: randomUUID(), name: 'Starter' };
const business = { id: randomUUID(), name: 'Business' };

const row = ({
  status,
  subscription = null,
  registration = null,
  createdAt = new Date(NOW - 10 * DAY_MS),
}) => ({
  id: randomUUID(),
  name: `Org ${status}`,
  contactEmail: 'org@example.test',
  status,
  createdAt,
  subscriptions: subscription ? [subscription] : [],
  registrations: registration ? [registration] : [],
});

const activeSubscription = (plan, status = 'Active') => ({
  status,
  startsAt: new Date(NOW - 30 * DAY_MS),
  expiresAt: new Date(NOW + 30 * DAY_MS),
  graceEndsAt: null,
  plan,
});

/** Service với repository giả: trả đúng các dòng cho trước, ghi lại tham số nhận được. */
const serviceReturning = (rows, total = rows.length) => {
  const calls = [];
  const repository = {
    findAdminPage: async (params) => {
      calls.push(params);
      return { rows, total };
    },
  };
  return {
    service: new OrganizationsService({}, repository, {}),
    calls,
  };
};

const defaultQuery = { page: 1, pageSize: 10, includeCancelled: false };

test('UC44: PendingPayment within its deadline stays PendingPayment with the payment due date', async () => {
  const { service } = serviceReturning([
    row({
      status: 'PendingPayment',
      registration: { status: 'PendingPayment', expiresAt: future, plan: starter },
    }),
  ]);
  const [item] = (await service.findAllForAdmin(defaultQuery)).items;
  assert.equal(item.status, 'PendingPayment');
  assert.deepEqual(item.paymentDueAt, future);
  assert.deepEqual(item.plan, starter);
  assert.equal(item.subscription, null);
});

test('UC44 (BR-8): PendingPayment past its deadline, or whose registration expired, reads as Cancelled', async () => {
  const { service } = serviceReturning([
    row({
      status: 'PendingPayment',
      registration: { status: 'PendingPayment', expiresAt: past, plan: starter },
    }),
    row({
      status: 'PendingPayment',
      registration: { status: 'Expired', expiresAt: future, plan: starter },
    }),
    row({ status: 'PendingPayment' }),
  ]);
  const items = (await service.findAllForAdmin(defaultQuery)).items;
  assert.deepEqual(
    items.map((item) => item.status),
    ['Cancelled', 'Cancelled', 'Cancelled'],
  );
  for (const item of items) assert.equal(item.paymentDueAt, null);
});

test('UC44: stored Cancelled is shown as Cancelled with the plan it registered for', async () => {
  const { service } = serviceReturning([
    row({
      status: 'Cancelled',
      registration: { status: 'Expired', expiresAt: past, plan: starter },
    }),
  ]);
  const [item] = (await service.findAllForAdmin(defaultQuery)).items;
  assert.equal(item.status, 'Cancelled');
  assert.deepEqual(item.plan, starter);
  assert.equal(item.paymentDueAt, null);
});

test('UC44: the plan comes from the current Subscription, or from the registration when there is none', async () => {
  const { service } = serviceReturning([
    // Đã đăng ký Starter nhưng Subscription hiện hành là Business: lấy gói của Subscription.
    row({
      status: 'Active',
      subscription: activeSubscription(business),
      registration: { status: 'Paid', expiresAt: past, plan: starter },
    }),
    // Chưa có Subscription: lấy gói của đăng ký.
    row({
      status: 'PendingPayment',
      registration: { status: 'PendingPayment', expiresAt: future, plan: starter },
    }),
    // Đã từng hoạt động nhưng không còn Subscription hiện hành: không đoán gói từ đăng ký cũ.
    row({
      status: 'Active',
      registration: { status: 'Paid', expiresAt: past, plan: starter },
    }),
  ]);
  const items = (await service.findAllForAdmin(defaultQuery)).items;
  assert.deepEqual(items[0].plan, business);
  assert.deepEqual(items[1].plan, starter);
  assert.equal(items[2].plan, null);
});

test('UC44 (BR-60): a Suspended Organization keeps its own Subscription status', async () => {
  const { service } = serviceReturning([
    row({ status: 'Suspended', subscription: activeSubscription(business, 'Grace') }),
  ]);
  const [item] = (await service.findAllForAdmin(defaultQuery)).items;
  assert.equal(item.status, 'Suspended');
  assert.equal(item.subscription.status, 'Grace');
});

test('UC44: page and pageSize become skip/take, and total comes from the repository', async () => {
  const { service, calls } = serviceReturning([], 47);
  const page = await service.findAllForAdmin({
    page: 3,
    pageSize: 20,
    includeCancelled: true,
  });
  assert.equal(calls[0].skip, 40);
  assert.equal(calls[0].take, 20);
  assert.equal(calls[0].includeCancelled, true);
  assert.deepEqual(page.meta, { current: 3, pageSize: 20, pages: 3, total: 47 });
});

/** Prisma giả: ghi lại tham số của count và findMany. */
const fakePrisma = () => {
  const seen = {};
  return {
    seen,
    organization: {
      count: async (args) => {
        seen.count = args;
        return 0;
      },
      findMany: async (args) => {
        seen.findMany = args;
        return [];
      },
    },
    $transaction: (operations) => Promise.all(operations),
  };
};

test('UC44 (BR-8, BR-12): the default filter hides Cancelled and expired PendingPayment, and count uses the same filter', async () => {
  const prisma = fakePrisma();
  const now = new Date(NOW);
  await new OrganizationsRepository(prisma).findAdminPage({
    includeCancelled: false,
    now,
    skip: 10,
    take: 10,
  });
  const where = prisma.seen.findMany.where;
  assert.deepEqual(where, {
    OR: [
      { status: { in: ['Active', 'Suspended'] } },
      {
        status: 'PendingPayment',
        registrations: {
          some: { status: 'PendingPayment', expiresAt: { gt: now } },
        },
      },
    ],
  });
  assert.equal(prisma.seen.count.where, where, 'total follows the filter');
  assert.equal(prisma.seen.findMany.skip, 10);
  assert.equal(prisma.seen.findMany.take, 10);
  assert.deepEqual(prisma.seen.findMany.orderBy, [
    { createdAt: 'desc' },
    { id: 'desc' },
  ]);
});

test('UC44: includeCancelled=true lists every Organization', async () => {
  const prisma = fakePrisma();
  await new OrganizationsRepository(prisma).findAdminPage({
    includeCancelled: true,
    now: new Date(NOW),
    skip: 0,
    take: 10,
  });
  assert.deepEqual(prisma.seen.findMany.where, {});
  assert.deepEqual(prisma.seen.count.where, {});
});

test('UC44 HTTP: /admin/organizations is ADMIN only, validates the query, and does not depend on controller order', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'admin-org-list-unit-key-0123456789abcdef';
  const received = [];
  const fakeService = {
    findAllForAdmin: async (query) => {
      received.push({ ...query });
      return { meta: { current: 1, pageSize: 10, pages: 0, total: 0 }, items: [] };
    },
    getMine: async () => ({ id: 'mine' }),
  };
  class TestModule {}
  Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
    // Admin đăng ký TRƯỚC UC11: trước đây thứ tự này làm /organizations/me bị nuốt.
    controllers: [AdminOrganizationsController, OrganizationsController],
    providers: [
      { provide: OrganizationsService, useValue: fakeService },
      { provide: APP_GUARD, useClass: InternalAuthGuard },
    ],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  try {
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/api/v1`;
    const admin = { 'x-user-id': randomUUID(), 'x-user-role': 'ADMIN' };
    const get = (path, headers = admin) =>
      fetch(`${url}${path}`, {
        headers: { 'x-internal-key': process.env.INTERNAL_SERVICE_KEY, ...headers },
      });

    await t.test('an Admin without an organization gets 200 with the defaults', async () => {
      const response = await get('/admin/organizations');
      assert.equal(response.status, 200);
      assert.deepEqual(received.at(-1), {
        page: 1,
        pageSize: 10,
        includeCancelled: false,
      });
    });

    await t.test('includeCancelled=true reaches the service as a boolean', async () => {
      assert.equal(
        (await get('/admin/organizations?includeCancelled=true&pageSize=50&page=2')).status,
        200,
      );
      assert.deepEqual(received.at(-1), {
        page: 2,
        pageSize: 50,
        includeCancelled: true,
      });
    });

    for (const role of ['ORGANIZER', 'INSTRUCTOR', 'LEARNER']) {
      await t.test(`403 for ${role}`, async () => {
        const response = await get('/admin/organizations', {
          'x-user-id': randomUUID(),
          'x-user-role': role,
          'x-organization-id': randomUUID(),
        });
        assert.equal(response.status, 403);
      });
    }

    for (const query of [
      'pageSize=15',
      'pageSize=abc',
      'page=0',
      'includeCancelled=yes',
      'includeCancelled=1',
      'unknown=1',
    ]) {
      await t.test(`400 for ${query}`, async () => {
        const before = received.length;
        assert.equal((await get(`/admin/organizations?${query}`)).status, 400);
        assert.equal(received.length, before, 'the service is not called');
      });
    }

    await t.test('the old shared /organizations route is gone', async () => {
      assert.equal((await get('/organizations')).status, 404);
    });

    await t.test('UC11 /organizations/me still reaches the Organizer controller', async () => {
      const response = await get('/organizations/me', {
        'x-user-id': randomUUID(),
        'x-user-role': 'ORGANIZER',
        'x-organization-id': randomUUID(),
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, { id: 'mine' });
    });
  } finally {
    await app.close();
  }
});
