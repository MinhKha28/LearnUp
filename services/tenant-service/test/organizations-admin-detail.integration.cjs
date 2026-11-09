// UC44.1 - chi tiết Organization của Admin trên PostgreSQL thật: các trạng thái, lịch sử tạm khóa,
// Organizer hiện tại sau khi thay (BR-50), course-service lỗi, trùng mã số thuế (BR-54).
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

const {
  Global,
  Module,
  ValidationPipe,
  VersioningType,
} = require('@nestjs/common');
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
  CourseServiceClient,
} = require('../dist/src/infrastructure/clients/course/course-service.client');
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

test('UC44.1 Admin organization detail (PostgreSQL)', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'admin-org-detail-integration-key-0123456789';
  for (const key of [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]) {
    delete process.env[key];
  }

  // course-service giả: tổ chức nằm trong `failing` thì ném lỗi như khi course-service sập.
  const failing = new Set();
  const courseCalls = [];
  const courseClient = {
    getOrganizationUsageById: async (organizationId) => {
      courseCalls.push(organizationId);
      if (failing.has(organizationId)) throw new Error('course-service down');
      return { courseChains: 3, storageBytes: 512 };
    },
  };
  class FakeClientsModule {}
  Global()(FakeClientsModule);
  Module({
    providers: [{ provide: CourseServiceClient, useValue: courseClient }],
    exports: [CourseServiceClient],
  })(FakeClientsModule);

  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      FakeClientsModule,
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

  const tag = `IT UC44.1 ${randomUUID().slice(0, 8)}`;
  // Mã số thuế riêng cho lượt chạy này, để đếm trùng không lẫn dữ liệu seed.
  const taxCode = `9${String(Date.now()).slice(-9)}`;
  const orgIds = [];
  const cleanup = async () => {
    const where = { organizationId: { in: orgIds } };
    await db.accountToken.deleteMany({ where });
    await db.organizationSuspension.deleteMany({ where });
    await db.subscription.deleteMany({ where });
    await db.registration.deleteMany({ where });
    await db.user.deleteMany({ where });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.subscriptionPlan.deleteMany({ where: { name: { startsWith: tag } } });
  };

  try {
    await app.init();
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/api/v1`;
    const admin = { 'x-user-id': randomUUID(), 'x-user-role': 'ADMIN' };
    const detail = async (id, headers = admin) => {
      const response = await fetch(`${url}/admin/organizations/${id}`, {
        headers: { 'x-internal-key': process.env.INTERNAL_SERVICE_KEY, ...headers },
      });
      return { status: response.status, body: await response.json() };
    };

    const limits = {
      price: 1000n,
      durationDays: 30,
      maxLearners: 10,
      maxInstructors: 5,
      maxCourseChains: 4,
      maxStorageBytes: 1024n,
    };
    const plan = await db.subscriptionPlan.create({
      data: { name: `${tag} Plan`, ...limits },
    });

    let order = 0;
    const organization = async (status, extra = {}) => {
      const id = randomUUID();
      orgIds.push(id);
      await db.organization.create({
        data: {
          id,
          name: `${tag} ${status} ${(order += 1)}`,
          taxCode,
          address: 'Test',
          contactPhone: '+84900000000',
          status,
          createdAt: new Date(Date.now() - (100 - order) * DAY_MS),
          ...extra,
        },
      });
      return id;
    };
    const user = (organizationId, role, status, extra = {}) => {
      const id = randomUUID();
      return db.user
        .create({
          data: {
            id,
            organizationId,
            email: `${id}@example.test`,
            fullName: `${tag} ${role}`,
            role,
            status,
            ...extra,
          },
        })
        .then(() => id);
    };
    const subscription = (organizationId, status = 'Active') =>
      db.subscription.create({
        data: {
          organizationId,
          planId: plan.id,
          source: 'Registration',
          status,
          ...limits,
          startsAt: new Date(Date.now() - 10 * DAY_MS),
          expiresAt: new Date(Date.now() + 20 * DAY_MS),
        },
      });
    const registration = (organizationId, organizerUserId, status, expiresAt) =>
      db.registration.create({
        data: {
          organizationId,
          organizerUserId,
          planId: plan.id,
          status,
          expiresAt,
          ...limits,
        },
      });
    const invitation = (organizationId, userId, extra = {}) =>
      db.accountToken.create({
        data: {
          organizationId,
          userId,
          purpose: 'Invitation',
          tokenHash: randomBytes(32),
          expiresAt: new Date(Date.now() + 7 * DAY_MS),
          ...extra,
        },
      });

    // Active: Organizer đã kích hoạt, 2 Learner (1 Deactivated vẫn giữ chỗ - BR-45), 1 Learner đã xóa (BR-46).
    const active = await organization('Active');
    await user(active, 'Organizer', 'Active', { activatedAt: new Date() });
    await user(active, 'Learner', 'Active');
    await user(active, 'Learner', 'Deactivated');
    await user(active, 'Learner', 'Active', { deletedAt: new Date() });
    await user(active, 'Instructor', 'Pending');
    await subscription(active);

    await t.test('Active: organization info, current Subscription and usage on the four limits', async () => {
      const { status, body } = await detail(active);
      assert.equal(status, 200);
      const data = body.data;
      assert.equal(data.status, 'Active');
      assert.equal(data.taxCode, taxCode);
      assert.equal(data.plan.id, plan.id);
      assert.equal(data.subscription.status, 'Active');
      assert.ok(data.subscription.daysRemaining >= 19);
      assert.equal(data.organizer.status, 'Active');
      assert.equal(data.organizer.invitation, null);
      assert.equal(data.usage.courseUsageAvailable, true);
      assert.deepEqual(
        [data.usage.learners.used, data.usage.instructors.used],
        [2, 1],
      );
      assert.deepEqual(
        [data.usage.courses.used, data.usage.storageBytes.used],
        [3, 512],
      );
      assert.equal(data.usage.courses.limit, 4);
      assert.equal(data.usage.courses.percent, 75);
      assert.equal(
        data.usage.courses.warning,
        75 >= data.usageWarningThresholdPercent,
        'warning follows the platform threshold',
      );
      assert.deepEqual(data.suspensions, []);
    });

    // Suspended: một lượt đã gỡ và một lượt đang khóa; Subscription vẫn chạy (BR-60).
    const suspended = await organization('Suspended');
    await user(suspended, 'Organizer', 'Active', { activatedAt: new Date() });
    await subscription(suspended, 'Grace');
    await db.organizationSuspension.create({
      data: {
        organizationId: suspended,
        startedAt: new Date(Date.now() - 30 * DAY_MS),
        endedAt: new Date(Date.now() - 20 * DAY_MS),
        reason: 'First, lifted',
      },
    });
    await db.organizationSuspension.create({
      data: {
        organizationId: suspended,
        startedAt: new Date(Date.now() - DAY_MS),
        reason: 'Second, current',
      },
    });

    await t.test('Suspended: lifted and current suspensions, newest first, Subscription status kept', async () => {
      const { status, body } = await detail(suspended);
      assert.equal(status, 200);
      assert.equal(body.data.status, 'Suspended');
      assert.equal(body.data.subscription.status, 'Grace');
      assert.deepEqual(
        body.data.suspensions.map((s) => [s.reason, s.endedAt === null]),
        [
          ['Second, current', true],
          ['First, lifted', false],
        ],
      );
    });

    // PendingPayment còn hạn: Organizer Pending lúc đăng ký, chưa có lời mời (BR-6).
    const pending = await organization('PendingPayment');
    const pendingOrganizer = await user(pending, 'Organizer', 'Pending');
    const due = new Date(Date.now() + 2 * DAY_MS);
    await registration(pending, pendingOrganizer, 'PendingPayment', due);

    await t.test('PendingPayment: payment due date, registered plan, no usage', async () => {
      const { body } = await detail(pending);
      assert.equal(body.data.status, 'PendingPayment');
      assert.equal(new Date(body.data.paymentDueAt).getTime(), due.getTime());
      assert.equal(body.data.plan.id, plan.id);
      assert.equal(body.data.subscription, null);
      assert.equal(body.data.usage, null);
      assert.equal(body.data.organizer.status, 'Pending');
      assert.equal(body.data.organizer.invitation, null);
      assert.ok(!courseCalls.includes(pending), 'no Subscription, no course-service call');
    });

    // Cancelled: lưu là Cancelled, và PendingPayment đã quá hạn (BR-8).
    const cancelled = await organization('Cancelled');
    const cancelledOrganizer = await user(cancelled, 'Organizer', 'Pending');
    await registration(cancelled, cancelledOrganizer, 'Expired', new Date(Date.now() - DAY_MS));
    const expired = await organization('PendingPayment');
    const expiredOrganizer = await user(expired, 'Organizer', 'Pending');
    await registration(expired, expiredOrganizer, 'PendingPayment', new Date(Date.now() - DAY_MS));

    await t.test('Cancelled: stored Cancelled and an expired PendingPayment both read as Cancelled', async () => {
      for (const id of [cancelled, expired]) {
        const { status, body } = await detail(id);
        assert.equal(status, 200);
        assert.equal(body.data.status, 'Cancelled');
        assert.equal(body.data.paymentDueAt, null);
        assert.equal(body.data.plan.id, plan.id);
      }
      const stored = await db.organization.findUnique({
        where: { id: expired },
        select: { status: true },
      });
      assert.equal(stored.status, 'PendingPayment', 'the GET writes nothing');
    });

    // BR-50: Admin thay Organizer: Organizer cũ Deactivated, Organizer mới Pending với lời mời đang mở.
    const replaced = await organization('Active');
    const oldOrganizer = await user(replaced, 'Organizer', 'Deactivated', {
      activatedAt: new Date(Date.now() - 50 * DAY_MS),
    });
    await invitation(replaced, oldOrganizer, {
      consumedAt: new Date(Date.now() - 50 * DAY_MS),
    });
    const newOrganizer = await user(replaced, 'Organizer', 'Pending');
    await invitation(replaced, newOrganizer, {
      revokedAt: new Date(Date.now() - DAY_MS),
      createdAt: new Date(Date.now() - 3 * DAY_MS),
    });
    const open = await invitation(replaced, newOrganizer);
    await subscription(replaced);

    await t.test('replaced Organizer: the Pending new Organizer and their open invitation are shown, not the old one', async () => {
      const { body } = await detail(replaced);
      assert.equal(body.data.organizer.id, newOrganizer);
      assert.equal(body.data.organizer.status, 'Pending');
      assert.equal(
        new Date(body.data.organizer.invitation.expiresAt).getTime(),
        open.expiresAt.getTime(),
      );
      assert.equal(body.data.organizer.invitation.expired, false);
    });

    // course-service lỗi: trang vẫn trả 200, Learner/Instructor vẫn đếm.
    const offline = await organization('Active');
    await user(offline, 'Learner', 'Active');
    await subscription(offline);
    failing.add(offline);

    await t.test('a course-service failure gives courseUsageAvailable: false and still answers 200', async () => {
      const { status, body } = await detail(offline);
      assert.equal(status, 200);
      const usage = body.data.usage;
      assert.equal(usage.courseUsageAvailable, false);
      assert.equal(usage.courses.used, null);
      assert.equal(usage.storageBytes.used, null);
      assert.equal(usage.courses.limit, 4);
      assert.equal(usage.learners.used, 1);
    });

    // Trùng mã số thuế: đến đây có 7 tổ chức cùng mã; thêm 6 nữa để vượt giới hạn 10.
    for (let i = 0; i < 6; i += 1) await organization('Cancelled');

    await t.test('the duplicate tax code list excludes the Organization itself and the count stays right above 10', async () => {
      const { body } = await detail(active);
      const duplicates = body.data.duplicateTaxCode;
      assert.equal(duplicates.count, orgIds.length - 1);
      assert.ok(duplicates.count > 10);
      assert.equal(duplicates.organizations.length, 10);
      assert.ok(!duplicates.organizations.some((org) => org.id === active));
      const listed = duplicates.organizations.map((org) => org.id);
      const newestOthers = orgIds.filter((id) => id !== active).reverse().slice(0, 10);
      assert.deepEqual(listed, newestOthers, 'newest first');
      const expiredRow = duplicates.organizations.find((org) => org.id === expired);
      if (expiredRow) assert.equal(expiredRow.status, 'Cancelled');
    });

    await t.test('400 for a bad id or "me", 404 for an unknown id, 403 for an Organizer', async () => {
      assert.equal((await detail('not-a-uuid')).status, 400);
      assert.equal((await detail('me')).status, 400);
      assert.equal((await detail(randomUUID())).status, 404);
      assert.equal(
        (
          await detail(active, {
            'x-user-id': randomUUID(),
            'x-user-role': 'ORGANIZER',
            'x-organization-id': active,
          })
        ).status,
        403,
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
