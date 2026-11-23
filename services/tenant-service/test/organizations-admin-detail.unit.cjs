// UC44.1 - chi tiết Organization của Admin, không cần database: course-service lỗi, Subscription
// không có, trùng mã số thuế, và route /admin/organizations/:organizationId.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const {
  Logger,
  Module,
  ValidationPipe,
  VersioningType,
} = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { APP_GUARD, NestFactory, Reflector } = require('@nestjs/core');
const {
  OrganizationsService,
} = require('../dist/src/modules/organizations/organizations.service');
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

Logger.overrideLogger(false);

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const plan = { id: randomUUID(), name: 'Business' };

const detailRow = (overrides = {}) => ({
  id: randomUUID(),
  name: 'Org',
  taxCode: '0101234567',
  address: 'Hà Nội',
  contactPhone: '+84900000000',
  contactEmail: null,
  logoFileKey: null,
  timezone: 'Asia/Ho_Chi_Minh',
  status: 'Active',
  createdAt: new Date(NOW - 90 * DAY_MS),
  subscriptions: [
    {
      status: 'Active',
      startsAt: new Date(NOW - 10 * DAY_MS),
      expiresAt: new Date(NOW + 20 * DAY_MS),
      graceEndsAt: null,
      readOnlyEndsAt: null,
      maxLearners: 10,
      maxInstructors: 5,
      maxCourseChains: 4,
      maxStorageBytes: 1024n,
      plan,
    },
  ],
  registrations: [],
  users: [],
  suspensions: [],
  ...overrides,
});

/** Service với repository, settings và course-service giả. */
const serviceFor = (row, { course, duplicates = { rows: [], total: 0 } } = {}) => {
  const courseCalls = [];
  const repository = {
    findAdminDetail: async () => row,
    findDuplicateTaxCodes: async () => duplicates,
    countSeats: async (_id, role) => (role === 'Learner' ? 7 : 2),
  };
  const settings = { get: async () => ({ usageWarningThresholdPercent: 80 }) };
  const courseClient = {
    getOrganizationUsageById: async (id) => {
      courseCalls.push(id);
      if (course instanceof Error) throw course;
      return course ?? { courseChains: 4, storageBytes: 100 };
    },
  };
  return {
    service: new OrganizationsService({}, repository, {}, settings, courseClient),
    courseCalls,
  };
};

test('UC44.1: usage on the four limits, with the platform warning threshold', async () => {
  const { service } = serviceFor(detailRow());
  const { usage } = await service.findOneForAdmin(randomUUID());
  assert.equal(usage.courseUsageAvailable, true);
  assert.deepEqual(usage.learners, { used: 7, limit: 10, percent: 70, warning: false });
  assert.deepEqual(usage.instructors, { used: 2, limit: 5, percent: 40, warning: false });
  assert.deepEqual(usage.courses, { used: 4, limit: 4, percent: 100, warning: true });
  assert.deepEqual(usage.storageBytes, { used: 100, limit: 1024, percent: 10, warning: false });
});

test('UC44.1: a course-service failure gives courseUsageAvailable: false and keeps the rest', async () => {
  const { service } = serviceFor(detailRow(), { course: new Error('ECONNREFUSED') });
  const detail = await service.findOneForAdmin(randomUUID());
  assert.equal(detail.usage.courseUsageAvailable, false);
  assert.deepEqual(detail.usage.courses, { used: null, limit: 4, percent: null, warning: false });
  assert.equal(detail.usage.storageBytes.used, null);
  assert.equal(detail.usage.learners.used, 7, 'tenant counts are still returned');
  assert.equal(detail.subscription.plan.id, plan.id);
});

test('UC44.1: without a current Subscription there is no usage and course-service is not called', async () => {
  const { service, courseCalls } = serviceFor(
    detailRow({
      status: 'PendingPayment',
      subscriptions: [],
      registrations: [
        { status: 'PendingPayment', expiresAt: new Date(NOW + DAY_MS), plan },
      ],
    }),
  );
  const detail = await service.findOneForAdmin(randomUUID());
  assert.equal(detail.usage, null);
  assert.equal(detail.subscription, null);
  assert.equal(detail.status, 'PendingPayment');
  assert.deepEqual(detail.plan, plan);
  assert.deepEqual(courseCalls, []);
});

test('UC44.1 (BR-50): the open invitation of a Pending Organizer is shown, flagged when expired', async () => {
  const organizer = (expiresAt) => ({
    id: randomUUID(),
    fullName: 'New Organizer',
    email: 'new@example.test',
    status: 'Pending',
    activatedAt: null,
    accountTokens: [{ createdAt: new Date(NOW - 8 * DAY_MS), expiresAt }],
  });
  const open = serviceFor(detailRow({ users: [organizer(new Date(NOW + DAY_MS))] }));
  assert.equal(
    (await open.service.findOneForAdmin(randomUUID())).organizer.invitation.expired,
    false,
  );
  const lapsed = serviceFor(detailRow({ users: [organizer(new Date(NOW - DAY_MS))] }));
  assert.equal(
    (await lapsed.service.findOneForAdmin(randomUUID())).organizer.invitation.expired,
    true,
  );
});

test('UC44.1 (BR-54): the duplicate count comes from the total, beyond the 10 listed rows', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: randomUUID(),
    name: `Dup ${i}`,
    status: i === 0 ? 'PendingPayment' : 'Active',
    registrations:
      i === 0
        ? [{ status: 'PendingPayment', expiresAt: new Date(NOW - DAY_MS), plan }]
        : [],
  }));
  const { service } = serviceFor(detailRow(), { duplicates: { rows, total: 13 } });
  const { duplicateTaxCode } = await service.findOneForAdmin(randomUUID());
  assert.equal(duplicateTaxCode.count, 13);
  assert.equal(duplicateTaxCode.organizations.length, 10);
  assert.equal(duplicateTaxCode.organizations[0].status, 'Cancelled', 'BR-8 applies to duplicates too');
});

test('UC44.1: an unknown Organization answers 404', async () => {
  const { service } = serviceFor(null);
  await assert.rejects(service.findOneForAdmin(randomUUID()), (error) => {
    assert.equal(error.getStatus(), 404);
    return true;
  });
});

test('UC44.1 HTTP: /admin/organizations/:organizationId is ADMIN only and validates the id', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'admin-org-detail-unit-key-0123456789abcdef';
  const received = [];
  const fakeService = {
    findOneForAdmin: async (id) => {
      received.push(id);
      return { id };
    },
    getMine: async () => ({ id: 'mine' }),
  };
  class TestModule {}
  Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
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
    const id = randomUUID();

    await t.test('an Admin gets 200 and the id reaches the service', async () => {
      const response = await get(`/admin/organizations/${id}`);
      assert.equal(response.status, 200);
      assert.deepEqual(received, [id]);
    });

    for (const bad of ['not-a-uuid', 'me']) {
      await t.test(`400 for "${bad}"`, async () => {
        assert.equal((await get(`/admin/organizations/${bad}`)).status, 400);
        assert.equal(received.length, 1, 'the service is not called');
      });
    }

    await t.test('403 for an Organizer', async () => {
      const response = await get(`/admin/organizations/${id}`, {
        'x-user-id': randomUUID(),
        'x-user-role': 'ORGANIZER',
        'x-organization-id': id,
      });
      assert.equal(response.status, 403);
    });

    await t.test('the old shared /organizations/:id route is gone', async () => {
      assert.equal((await get(`/organizations/${id}`)).status, 404);
    });

    await t.test('UC11 /organizations/me still reaches the Organizer controller', async () => {
      const response = await get('/organizations/me', {
        'x-user-id': randomUUID(),
        'x-user-role': 'ORGANIZER',
        'x-organization-id': id,
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, { id: 'mine' });
    });
  } finally {
    await app.close();
  }
});
