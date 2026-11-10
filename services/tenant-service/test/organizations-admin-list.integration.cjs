// UC44 - danh sách Organization của Admin trên PostgreSQL thật: bộ lọc mặc định,
// includeCancelled, total và phân trang, nguồn của gói, quyền ADMIN.
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
  OrganizationsModule,
} = require('../dist/src/modules/organizations/organizations.module');
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
const YEAR_MS = 365 * DAY_MS;

test('UC44 Admin organization list (PostgreSQL)', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'admin-org-list-integration-key-0123456789';
  for (const key of [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]) {
    delete process.env[key];
  }
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      OrganizationsModule,
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

  const tag = `IT UC44 ${randomUUID().slice(0, 8)}`;
  const orgIds = [];
  const userIds = [];
  const cleanup = async () => {
    await db.subscription.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.registration.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.subscriptionPlan.deleteMany({ where: { name: { startsWith: tag } } });
  };

  try {
    await app.init();
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/api/v1`;
    const admin = { 'x-user-id': randomUUID(), 'x-user-role': 'ADMIN' };
    const list = async (query = '', headers = admin) => {
      const response = await fetch(`${url}/admin/organizations${query}`, {
        headers: { 'x-internal-key': process.env.INTERNAL_SERVICE_KEY, ...headers },
      });
      return { status: response.status, body: await response.json() };
    };

    // Tổng trước khi thêm fixture, để không phụ thuộc dữ liệu seed đang có trong database.
    const baseline = {
      hidden: (await list()).body.data.meta.total,
      all: (await list('?includeCancelled=true')).body.data.meta.total,
    };

    const limits = {
      price: 1000n,
      durationDays: 30,
      maxLearners: 10,
      maxInstructors: 5,
      maxCourseChains: 5,
      maxStorageBytes: 10n ** 9n,
    };
    const [starter, business] = await Promise.all(
      ['Starter', 'Business'].map((name) =>
        db.subscriptionPlan.create({ data: { name: `${tag} ${name}`, ...limits } }),
      ),
    );

    // createdAt ở tương lai xa và giảm dần theo thứ tự tạo, để fixture đứng đầu danh sách (mới nhất trước).
    let rank = 10;
    const fixture = async (status, { subscription, registration } = {}) => {
      const id = randomUUID();
      orgIds.push(id);
      await db.organization.create({
        data: {
          id,
          name: `${tag} ${status} ${rank}`,
          taxCode: '9500000000',
          address: 'Test',
          contactPhone: '+84900000000',
          contactEmail: `${id}@example.test`,
          status,
          createdAt: new Date(Date.now() + 100 * YEAR_MS + (rank -= 1) * DAY_MS),
        },
      });
      if (registration) {
        const organizerId = randomUUID();
        userIds.push(organizerId);
        await db.user.create({
          data: {
            id: organizerId,
            organizationId: id,
            email: `${organizerId}@example.test`,
            fullName: 'UC44 Organizer',
            role: 'Organizer',
            status: 'Pending',
          },
        });
        await db.registration.create({
          data: {
            organizationId: id,
            organizerUserId: organizerId,
            planId: registration.plan.id,
            status: registration.status,
            expiresAt: registration.expiresAt,
            ...limits,
          },
        });
      }
      if (subscription) {
        await db.subscription.create({
          data: {
            organizationId: id,
            planId: subscription.plan.id,
            source: 'Registration',
            status: subscription.status,
            ...limits,
            startsAt: new Date(Date.now() - 10 * DAY_MS),
            expiresAt: new Date(Date.now() + 20 * DAY_MS),
          },
        });
      }
      return id;
    };

    const future = new Date(Date.now() + DAY_MS);
    const past = new Date(Date.now() - DAY_MS);
    const active = await fixture('Active', {
      subscription: { plan: business, status: 'Active' },
      registration: { plan: starter, status: 'Paid', expiresAt: past },
    });
    const suspended = await fixture('Suspended', {
      subscription: { plan: business, status: 'Grace' },
    });
    const pendingOpen = await fixture('PendingPayment', {
      registration: { plan: starter, status: 'PendingPayment', expiresAt: future },
    });
    const pendingExpired = await fixture('PendingPayment', {
      registration: { plan: starter, status: 'PendingPayment', expiresAt: past },
    });
    const cancelled = await fixture('Cancelled', {
      registration: { plan: starter, status: 'Expired', expiresAt: past },
    });

    await t.test(
      'the default list hides stored Cancelled and PendingPayment past its deadline, and keeps PendingPayment within its deadline',
      async () => {
        const { status, body } = await list();
        assert.equal(status, 200);
        const ids = body.data.items.slice(0, 3).map((item) => item.id);
        assert.deepEqual(ids, [active, suspended, pendingOpen]);
        const all = body.data.items.map((item) => item.id);
        assert.ok(!all.includes(pendingExpired));
        assert.ok(!all.includes(cancelled));
        assert.equal(body.data.meta.total, baseline.hidden + 3, 'total follows the filter');
      },
    );

    await t.test('includeCancelled=true shows them with Cancelled as the status', async () => {
      const { body } = await list('?includeCancelled=true');
      const items = body.data.items.slice(0, 5);
      assert.deepEqual(
        items.map((item) => item.id),
        [active, suspended, pendingOpen, pendingExpired, cancelled],
      );
      assert.deepEqual(
        items.map((item) => item.status),
        ['Active', 'Suspended', 'PendingPayment', 'Cancelled', 'Cancelled'],
      );
      assert.equal(body.data.meta.total, baseline.all + 5);
    });

    await t.test('the GET writes nothing: the expired PendingPayment is still stored as PendingPayment', async () => {
      const stored = await db.organization.findUnique({
        where: { id: pendingExpired },
        select: { status: true },
      });
      assert.equal(stored.status, 'PendingPayment');
    });

    await t.test('paging follows the filter', async () => {
      const first = (await list('?pageSize=10&page=1')).body.data;
      const total = first.meta.total;
      assert.equal(first.meta.pages, Math.ceil(total / 10));
      const last = (await list(`?pageSize=10&page=${first.meta.pages}`)).body.data;
      assert.equal(last.items.length, total - (first.meta.pages - 1) * 10);
      const beyond = (await list(`?pageSize=10&page=${first.meta.pages + 1}`)).body.data;
      assert.deepEqual(beyond.items, []);
      assert.equal(beyond.meta.total, total);
    });

    await t.test('the plan comes from the current Subscription, or from the registration when there is none', async () => {
      const items = new Map(
        (await list('?includeCancelled=true')).body.data.items.map((item) => [item.id, item]),
      );
      assert.equal(items.get(active).plan.id, business.id);
      assert.equal(items.get(suspended).plan.id, business.id);
      assert.equal(items.get(suspended).subscription.status, 'Grace');
      assert.equal(items.get(pendingOpen).plan.id, starter.id);
      assert.ok(items.get(pendingOpen).paymentDueAt);
      assert.equal(items.get(cancelled).plan.id, starter.id);
      assert.equal(items.get(cancelled).paymentDueAt, null);
    });

    await t.test('an Organizer gets 403, and a bad query gets 400', async () => {
      const organizer = {
        'x-user-id': randomUUID(),
        'x-user-role': 'ORGANIZER',
        'x-organization-id': active,
      };
      assert.equal((await list('', organizer)).status, 403);
      assert.equal((await list('?pageSize=15')).status, 400);
      assert.equal((await list('?includeCancelled=yes')).status, 400);
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  }
});
