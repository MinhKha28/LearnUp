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
  OrganizationsService,
} = require('../dist/src/modules/organizations/organizations.service');
const {
  OrganizationsRepository,
} = require('../dist/src/modules/organizations/organizations.repository');
const {
  InternalOrganizationsModule,
} = require('../dist/src/modules/internal-organizations/internal-organizations.module');
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
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 2),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(32),
]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)]);

test('UC11 / UC11.1 organization profile', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'org-profile-integration-key-0123456789';
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

  const orgs = {
    active: randomUUID(),
    grace: randomUUID(),
    suspended: randomUUID(),
    cancelled: randomUUID(),
  };
  const orgIds = Object.values(orgs);
  const cleanup = async () => {
    await db.subscription.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  };

  try {
    await app.init();
    const plan = await db.subscriptionPlan.findFirst();
    assert.ok(plan, 'seed a subscription plan first (prisma:seed)');
    await db.organization.createMany({
      data: orgIds.map((id, index) => ({
        id,
        name: `Profile fixture ${index}`,
        taxCode: `960000000${index}`,
        address: 'Old address',
        contactPhone: '+84900000000',
        contactEmail: 'old@example.test',
        status: id === orgs.cancelled ? 'Cancelled' : 'Active',
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
      startsAt: new Date(Date.now() - DAY_MS),
      expiresAt: new Date(Date.now() + DAY_MS),
    });
    await db.subscription.createMany({
      data: [
        subscription(orgs.active, 'Active'),
        subscription(orgs.grace, 'Grace'),
        subscription(orgs.suspended, 'Suspended'),
        subscription(orgs.cancelled, 'Active'),
      ],
    });

    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const headersFor = (org, role = 'ORGANIZER') => ({
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
      'x-user-id': randomUUID(),
      'x-user-role': role,
      'x-organization-id': org,
    });
    const patch = (org, json, role) =>
      fetch(`${base}/organizations/me`, {
        method: 'PATCH',
        headers: {
          ...headersFor(org, role),
          'content-type': 'application/json',
        },
        body: JSON.stringify(json),
      });
    const uploadLogo = (org, buffer, type, name = 'logo.png') => {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type }), name);
      return fetch(`${base}/organizations/me/logo`, {
        method: 'PUT',
        headers: headersFor(org),
        body: form,
      });
    };
    const errorCode = async (response) => (await response.json()).error.code;

    await t.test(
      'UC11: the Organizer sees the organization profile',
      async () => {
        const response = await fetch(`${base}/organizations/me`, {
          headers: headersFor(orgs.active),
        });
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.id, orgs.active);
        assert.equal(data.name, 'Profile fixture 0');
        assert.equal(data.contactEmail, 'old@example.test');
        assert.equal(data.logoUrl, null);
        assert.equal(data.timezone, 'Asia/Ho_Chi_Minh');
        assert.equal('logoFileKey' in data, false);
      },
    );

    await t.test(
      'UC11.1: updates fields with the UC02 normalisation, leaving others unchanged',
      async () => {
        const response = await patch(orgs.active, {
          name: '  Công ty   Mới ',
          contactPhone: '0912 345 678',
          contactEmail: 'NEW@Example.TEST',
        });
        assert.equal(response.status, 200);
        const data = (await response.json()).data;
        assert.equal(data.name, 'Công ty Mới');
        assert.equal(data.contactPhone, '+84912345678');
        assert.equal(data.contactEmail, 'new@example.test');
        assert.equal(data.address, 'Old address');
      },
    );

    await t.test('the contact email can be cleared with null', async () => {
      const response = await patch(orgs.active, { contactEmail: null });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.contactEmail, null);
    });

    await t.test(
      'BR-55 / TN3: a valid IANA timezone is saved and served to learning and achievement',
      async () => {
        const response = await patch(orgs.active, { timezone: 'Asia/Tokyo' });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).data.timezone, 'Asia/Tokyo');
        const access = await fetch(
          `${base}/internal/organizations/${orgs.active}/access`,
          {
            headers: {
              'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
              'x-organization-id': orgs.active,
            },
          },
        );
        assert.equal((await access.json()).data.timezone, 'Asia/Tokyo');
      },
    );

    for (const timezone of [
      'Asia/Hanoi',
      'UTC+7',
      '+07:00',
      'EST',
      'asia/tokyo',
      '',
      'Asia/Ho_Chi_Minh/Extra',
    ]) {
      await t.test(`400 INVALID_TIMEZONE for "${timezone}"`, async () => {
        const response = await patch(orgs.active, { timezone });
        assert.equal(response.status, 400);
        assert.equal(await errorCode(response), 'INVALID_TIMEZONE');
      });
    }

    for (const [name, json] of [
      ['an empty body', {}],
      ['a 9-digit tax code', { taxCode: '123456789' }],
      ['a blank name', { name: '   ' }],
      ['an invalid phone', { contactPhone: 'abc' }],
      ['an invalid email', { contactEmail: 'not-an-email' }],
      ['an unknown field', { status: 'Active' }],
    ]) {
      await t.test(`400 for ${name}`, async () => {
        assert.equal((await patch(orgs.active, json)).status, 400);
      });
    }

    await t.test('Grace can still update', async () => {
      assert.equal(
        (await patch(orgs.grace, { address: 'Grace address' })).status,
        200,
      );
    });

    await t.test(
      'BR-24: Suspended is view only (GET 200, PATCH and logo 403)',
      async () => {
        const view = await fetch(`${base}/organizations/me`, {
          headers: headersFor(orgs.suspended),
        });
        assert.equal(view.status, 200);
        const response = await patch(orgs.suspended, { address: 'x' });
        assert.equal(response.status, 403);
        assert.equal(await errorCode(response), 'SUBSCRIPTION_NOT_ACTIVE');
        assert.equal(
          (await uploadLogo(orgs.suspended, PNG, 'image/png')).status,
          403,
        );
        const unchanged = await db.organization.findUnique({
          where: { id: orgs.suspended },
        });
        assert.equal(unchanged.address, 'Old address');
      },
    );

    await t.test('a non-Active organization cannot update', async () => {
      const response = await patch(orgs.cancelled, { address: 'x' });
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), 'ORGANIZATION_NOT_ACTIVE');
    });

    for (const role of ['INSTRUCTOR', 'LEARNER']) {
      await t.test(`403 for ${role}`, async () => {
        const view = await fetch(`${base}/organizations/me`, {
          headers: headersFor(orgs.active, role),
        });
        assert.equal(view.status, 403);
        assert.equal(
          (await patch(orgs.active, { address: 'x' }, role)).status,
          403,
        );
      });
    }

    for (const [name, buffer, type, fileName] of [
      ['a WebP file', WEBP, 'image/webp', 'logo.webp'],
      ['a GIF renamed to .png', GIF, 'image/png', 'logo.png'],
      ['a PDF', Buffer.from('%PDF-1.7 test'), 'application/pdf', 'logo.pdf'],
    ]) {
      await t.test(`400 LOGO_INVALID for ${name}`, async () => {
        const response = await uploadLogo(orgs.active, buffer, type, fileName);
        assert.equal(response.status, 400);
        assert.equal(await errorCode(response), 'LOGO_INVALID');
      });
    }

    await t.test('a logo over 2 MB is rejected', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
      const response = await uploadLogo(orgs.active, big, 'image/png');
      assert.ok([400, 413].includes(response.status), String(response.status));
    });

    await t.test('400 LOGO_REQUIRED without a file', async () => {
      const response = await fetch(`${base}/organizations/me/logo`, {
        method: 'PUT',
        headers: headersFor(orgs.active),
        body: new FormData(),
      });
      assert.equal(response.status, 400);
      assert.equal(await errorCode(response), 'LOGO_REQUIRED');
    });

    await t.test(
      'a valid PNG with storage not configured is 503, the profile unchanged',
      async () => {
        const response = await uploadLogo(orgs.active, PNG, 'image/png');
        assert.equal(response.status, 503);
        assert.equal(await errorCode(response), 'STORAGE_UNAVAILABLE');
        const row = await db.organization.findUnique({
          where: { id: orgs.active },
        });
        assert.equal(row.logoFileKey, null);
      },
    );

    const calls = { uploads: [], deletes: [] };
    let duringUpload = null;
    const storage = {
      upload: async (file, options) => {
        if (duringUpload) await duringUpload();
        const key = `${options.folder}/logo-${calls.uploads.length + 1}`;
        calls.uploads.push({ key, mimeType: file.mimeType, options });
        return { storageKey: key };
      },
      delete: async (key) => {
        calls.deletes.push(key);
        return { result: 'ok' };
      },
      getUrl: (key) => `https://cdn.test/${key}`,
    };
    const service = new OrganizationsService(
      db,
      new OrganizationsRepository(db),
      storage,
    );
    const organizer = {
      userId: randomUUID(),
      role: 'ORGANIZER',
      organizationId: orgs.active,
      isAuthenticated: true,
    };
    const file = (buffer, mimetype = 'image/png') => ({
      buffer,
      originalname: 'logo',
      mimetype,
      size: buffer.length,
    });

    await t.test(
      'replacing the logo stores the detected type, then deletes the old file',
      async () => {
        const first = await service.replaceLogo(organizer, file(PNG));
        assert.equal(
          first.logoUrl,
          `https://cdn.test/learnup/${orgs.active}/logos/logo-1`,
        );
        assert.equal(calls.uploads[0].mimeType, 'image/png');
        assert.deepEqual(calls.uploads[0].options.validation.allowedMimeTypes, [
          'image/png',
          'image/jpeg',
        ]);
        const second = await service.replaceLogo(
          organizer,
          file(JPEG, 'image/png'),
        );
        assert.equal(calls.uploads[1].mimeType, 'image/jpeg');
        assert.match(second.logoUrl, /logo-2$/);
        assert.deepEqual(calls.deletes, [
          `learnup/${orgs.active}/logos/logo-1`,
        ]);
      },
    );

    await t.test(
      'certificate-profile now serves the logo URL for achievement',
      async () => {
        const row = await db.organization.findUnique({
          where: { id: orgs.active },
        });
        assert.equal(row.logoFileKey, `learnup/${orgs.active}/logos/logo-2`);
      },
    );

    await t.test(
      'removing the logo clears it and deletes the file',
      async () => {
        const removed = await service.removeLogo(organizer);
        assert.equal(removed.logoUrl, null);
        assert.equal(
          calls.deletes.at(-1),
          `learnup/${orgs.active}/logos/logo-2`,
        );
      },
    );

    await t.test(
      'if the Subscription stops being active during the upload, the new file is deleted and nothing is saved',
      async () => {
        duringUpload = () =>
          db.subscription.updateMany({
            where: { organizationId: orgs.active },
            data: { status: 'Suspended' },
          });
        await assert.rejects(
          service.replaceLogo(organizer, file(PNG)),
          (error) => error.getStatus() === 403,
        );
        duringUpload = null;
        assert.equal(calls.uploads.length, 3);
        assert.equal(calls.deletes.at(-1), calls.uploads[2].key);
        const row = await db.organization.findUnique({
          where: { id: orgs.active },
        });
        assert.equal(row.logoFileKey, null);
      },
    );

    await t.test(
      'a Subscription that is no longer active blocks before uploading',
      async () => {
        const uploadsBefore = calls.uploads.length;
        await assert.rejects(
          service.replaceLogo(organizer, file(PNG)),
          (error) => error.getStatus() === 403,
        );
        assert.equal(calls.uploads.length, uploadsBefore);
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
