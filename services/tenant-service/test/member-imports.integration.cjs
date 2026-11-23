// UC12.8 - Import Instructor từ Excel trên Postgres thật: khóa tổ chức, số chỗ, transaction, outbox, HTTP multipart.
// Module member-imports dùng lại cho UC13.8 (Learner), nên các ca ở đây cũng là hồi quy cho UC13.8.
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

const ExcelJS = require('exceljs');
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
const { OutboxModule } = require('../dist/src/modules/outbox/outbox.module');
const {
  MemberImportsModule,
} = require('../dist/src/modules/member-imports/member-imports.module');
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

async function xlsx(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Instructors');
  sheet.addRow(['Họ tên*', 'Email*', 'Đơn vị công tác', 'Vai trò*']);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('UC12.8 import Instructors with isolated fixtures', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'member-import-integration-key-0123';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      OutboxModule,
      IntegrationsModule,
      MemberImportsModule,
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
    main: randomUUID(), // Active, 6 chỗ Instructor
    small: randomUUID(), // Active, 3 chỗ, đã dùng 1
    race: randomUUID(), // Active, hai confirm song song
    grace: randomUUID(),
    suspended: randomUUID(),
    other: randomUUID(),
  };
  const orgIds = Object.values(orgs);
  const organizer = randomUUID();
  const tag = randomUUID().slice(0, 8);
  const email = (name) => `import-${tag}-${name}@example.test`;
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.accountToken.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.subscription.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  };

  try {
    await app.init();
    const plan = await db.subscriptionPlan.findFirst();
    assert.ok(plan, 'seed a subscription plan first (prisma:seed)');
    const settings = await db.platformSetting.findFirst();
    assert.ok(settings, 'seed platform settings first (prisma:seed)');

    await db.organization.createMany({
      data: orgIds.map((id, index) => ({
        id,
        name: `Import fixture ${index}`,
        taxCode: `96000000${index}`,
        address: 'Test',
        contactPhone: '0900000000',
        status: 'Active',
      })),
    });
    const subscription = (organizationId, status, maxInstructors) => ({
      organizationId,
      planId: plan.id,
      source: 'Registration',
      status,
      price: plan.price,
      durationDays: plan.durationDays,
      maxLearners: plan.maxLearners,
      maxInstructors,
      maxCourseChains: plan.maxCourseChains,
      maxStorageBytes: plan.maxStorageBytes,
      startsAt: new Date(Date.now() - 10 * DAY_MS),
      expiresAt: new Date(Date.now() + 20 * DAY_MS),
    });
    await db.subscription.createMany({
      data: [
        subscription(orgs.main, 'Active', 6),
        subscription(orgs.small, 'Active', 3),
        subscription(orgs.race, 'Active', 10),
        subscription(orgs.grace, 'Grace', 10),
        subscription(orgs.suspended, 'Suspended', 10),
        subscription(orgs.other, 'Active', 10),
      ],
    });
    const createUser = (organizationId, name, extra = {}) =>
      db.user.create({
        data: {
          organizationId,
          email: email(name),
          fullName: `Fixture ${name}`,
          role: 'Instructor',
          status: 'Active',
          activatedAt: new Date(),
          ...extra,
        },
      });
    // Email đã dùng ở tổ chức khác (BR-38), và email của tài khoản đã xóa (BR-39: dùng lại được).
    await createUser(orgs.other, 'taken');
    await createUser(orgs.other, 'deleted', { deletedAt: new Date() });
    await createUser(orgs.small, 'seat-holder');

    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/users/instructors/imports`;
    const call = (path, { org = orgs.main, file, digest, role = 'ORGANIZER' } = {}) => {
      const form = new FormData();
      if (file) form.append('file', new Blob([file]), 'instructors.xlsx');
      if (digest !== undefined) form.append('previewDigest', digest);
      return fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
          'x-user-id': organizer,
          'x-user-role': role,
          'x-organization-id': org,
        },
        body: form,
      });
    };
    const preview = async (file, org) => {
      const response = await call('/preview', { file, org });
      assert.equal(response.status, 200);
      return (await response.json()).data;
    };
    const confirm = (file, digest, org) => call('', { file, digest, org });
    const countOf = async (organizationId) => ({
      users: await db.user.count({ where: { organizationId } }),
      tokens: await db.accountToken.count({ where: { organizationId } }),
      outbox: await db.outboxEvent.count({ where: { organizationId } }),
    });

    const mainFile = await xlsx([
      ['  Trần   Minh ', ` ${email('Minh').toUpperCase()} `, 'Phòng A', 'Instructor'],
      ['Lê Lan', email('lan'), '', 'instructor'],
      ['Taken', email('taken'), '', 'Instructor'], // BR-38
      ['Reuse', email('deleted'), '', 'Instructor'], // BR-39
      ['Dup 1', email('dup'), '', 'Instructor'],
      ['Dup 2', email('DUP'), '', 'Instructor'],
      ['', 'not-an-email', '', 'Learner'], // ba lỗi trên một dòng
    ]);

    let mainPreview;
    await t.test('preview: valid and invalid rows with reasons, seats, nothing written', async () => {
      const before = await countOf(orgs.main);
      mainPreview = await preview(mainFile);
      assert.deepEqual(await countOf(orgs.main), before);

      assert.equal(mainPreview.role, 'Instructor');
      assert.equal(mainPreview.totalRows, 7);
      assert.deepEqual(
        mainPreview.validRows.map((row) => [row.rowNumber, row.email, row.fullName]),
        [
          [2, email('minh'), 'Trần Minh'],
          [3, email('lan'), 'Lê Lan'],
          [5, email('deleted'), 'Reuse'],
        ],
      );
      assert.deepEqual(
        mainPreview.invalidRows.map((row) => [row.rowNumber, row.errors.map((e) => e.code)]),
        [
          [4, ['EMAIL_ALREADY_USED']],
          [6, ['DUPLICATE_EMAIL_IN_FILE']],
          [7, ['DUPLICATE_EMAIL_IN_FILE']],
          [8, ['MISSING_REQUIRED_FIELD', 'INVALID_EMAIL', 'INVALID_ROLE']],
        ],
      );
      // BR-38: không lộ tổ chức đang dùng email.
      assert.ok(!JSON.stringify(mainPreview.invalidRows).includes(orgs.other));
      assert.deepEqual(
        [mainPreview.seats.used, mainPreview.seats.max, mainPreview.seats.remaining],
        [0, 6, 6],
      );
      assert.equal(mainPreview.exceedsSeats, false);
      assert.equal(mainPreview.canConfirm, true);
      assert.match(mainPreview.previewDigest, /^[0-9a-f]{64}$/);
    });

    await t.test('400 for a missing file, a bad digest, a renamed file; 403 for a non-Organizer', async () => {
      const noFile = await call('', { digest: mainPreview.previewDigest });
      assert.equal(noFile.status, 400);
      assert.equal((await noFile.json()).error.code, 'IMPORT_FILE_REQUIRED');
      assert.equal((await confirm(mainFile, 'abc')).status, 400);
      assert.equal((await call('', { file: mainFile })).status, 400);
      const csv = await call('/preview', { file: Buffer.from('a,b\n1,2\n') });
      assert.equal(csv.status, 400);
      assert.equal((await csv.json()).error.code, 'INVALID_IMPORT_FILE');
      const learner = await call('/preview', { file: mainFile, role: 'LEARNER' });
      assert.equal(learner.status, 403);
      assert.equal((await countOf(orgs.main)).users, 0);
    });

    await t.test('confirm creates Pending users, hashed invitation tokens, one email each and one audit row', async () => {
      const response = await confirm(mainFile, mainPreview.previewDigest);
      assert.equal(response.status, 201);
      const { data } = await response.json();
      assert.equal(data.createdCount, 3);
      assert.equal(data.skippedCount, 4);
      assert.deepEqual(data.accounts.map((a) => a.rowNumber), [2, 3, 5]);

      const users = await db.user.findMany({
        where: { organizationId: orgs.main },
        orderBy: { email: 'asc' },
      });
      assert.deepEqual(
        users.map((u) => [u.email, u.role, u.status, u.activatedAt, u.deletedAt]),
        [
          [email('deleted'), 'Instructor', 'Pending', null, null],
          [email('lan'), 'Instructor', 'Pending', null, null],
          [email('minh'), 'Instructor', 'Pending', null, null],
        ],
      );
      assert.equal(users.find((u) => u.email === email('minh')).department, 'Phòng A');
      assert.equal(users.find((u) => u.email === email('lan')).department, null);

      const tokens = await db.accountToken.findMany({ where: { organizationId: orgs.main } });
      assert.equal(tokens.length, 3);
      for (const token of tokens) {
        const user = users.find((u) => u.id === token.userId);
        assert.ok(user);
        assert.equal(token.purpose, 'Invitation');
        assert.equal(token.tokenHash.length, 32, 'only a SHA-256 hash is stored');
        assert.equal(
          token.expiresAt.getTime() - user.createdAt.getTime(),
          settings.invitationLinkTtlDays * DAY_MS,
        );
      }

      const events = await db.outboxEvent.findMany({
        where: { organizationId: orgs.main },
        orderBy: { id: 'asc' },
      });
      const emails = events.filter((e) => e.eventType === 'EmailRequested');
      const audits = events.filter((e) => e.eventType === 'AuditRecorded');
      assert.equal(events.length, 4);
      assert.equal(emails.length, 3);
      assert.deepEqual(
        emails.map((e) => e.aggregateId).sort(),
        users.map((u) => u.id).sort(),
      );
      assert.ok(emails.every((e) => e.payload.templateCode === 'INSTRUCTOR_INVITATION'));
      // Mã thô chỉ nằm trong link của thư, không nằm trong bảng token.
      for (const event of emails) {
        assert.match(event.payload.body, /\/activate\/[A-Za-z0-9_-]{20,}/);
      }
      assert.equal(audits.length, 1);
      assert.equal(audits[0].aggregateId, orgs.main);
      assert.equal(audits[0].payload.actionType, 'MEMBER_IMPORTED');
      assert.equal(audits[0].payload.actorUserId, organizer);
      assert.deepEqual(
        [audits[0].payload.details.createdCount, audits[0].payload.details.skippedCount],
        [3, 4],
      );
      assert.deepEqual(
        [...audits[0].payload.details.userIds].sort(),
        users.map((u) => u.id).sort(),
      );
    });

    await t.test('the same file again: IMPORT_CHANGED with the new preview, nothing created', async () => {
      const before = await countOf(orgs.main);
      const response = await confirm(mainFile, mainPreview.previewDigest);
      assert.equal(response.status, 409);
      const { error } = await response.json();
      assert.equal(error.code, 'IMPORT_CHANGED');
      assert.equal(error.preview.validRows.length, 0);
      assert.equal(error.preview.seats.used, 3);
      assert.deepEqual(await countOf(orgs.main), before);
    });

    await t.test('IMPORT_CHANGED when an email is taken after the preview; nothing created', async () => {
      const file = await xlsx([
        ['Ba', email('late-1'), '', 'Instructor'],
        ['Bốn', email('late-2'), '', 'Instructor'],
      ]);
      const { previewDigest, validRows } = await preview(file);
      assert.equal(validRows.length, 2);
      // Một tổ chức khác lấy email late-2 giữa preview và confirm.
      await createUser(orgs.other, 'late-2');

      const before = await countOf(orgs.main);
      const response = await confirm(file, previewDigest);
      assert.equal(response.status, 409);
      const { error } = await response.json();
      assert.equal(error.code, 'IMPORT_CHANGED');
      assert.deepEqual(error.preview.validRows.map((row) => row.email), [email('late-1')]);
      assert.deepEqual(error.preview.invalidRows[0].errors.map((e) => e.code), ['EMAIL_ALREADY_USED']);
      assert.deepEqual(await countOf(orgs.main), before);
      assert.equal(await db.user.count({ where: { email: email('late-1') } }), 0);

      // Xác nhận lại với preview mới thì chỉ dòng còn hợp lệ được tạo.
      const retry = await confirm(file, error.preview.previewDigest);
      assert.equal(retry.status, 201);
      assert.equal((await retry.json()).data.createdCount, 1);
    });

    await t.test('BR-33: more valid rows than remaining seats blocks the whole import', async () => {
      const file = await xlsx(
        [1, 2, 3].map((n) => [`Seat ${n}`, email(`seat-${n}`), '', 'Instructor']),
      );
      const shown = await preview(file, orgs.small);
      assert.deepEqual([shown.seats.used, shown.seats.remaining], [1, 2]);
      assert.equal(shown.exceedsSeats, true);
      assert.equal(shown.canConfirm, false);

      const before = await countOf(orgs.small);
      const response = await confirm(file, shown.previewDigest, orgs.small);
      assert.equal(response.status, 409);
      const { error } = await response.json();
      assert.equal(error.code, 'IMPORT_EXCEEDS_SEATS');
      assert.deepEqual([error.validCount, error.remaining], [3, 2]);
      assert.deepEqual(await countOf(orgs.small), before);
    });

    await t.test('seats taken after the preview are counted inside the lock', async () => {
      const file = await xlsx([['Fits', email('fits'), '', 'Instructor']]);
      const shown = await preview(file, orgs.small);
      assert.equal(shown.canConfirm, true);
      await createUser(orgs.small, 'manual-1');
      await createUser(orgs.small, 'manual-2'); // 3/3 chỗ
      const response = await confirm(file, shown.previewDigest, orgs.small);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'IMPORT_EXCEEDS_SEATS');
      assert.equal(await db.user.count({ where: { email: email('fits') } }), 0);
    });

    for (const [name, org] of [
      ['Grace', orgs.grace],
      ['Suspended', orgs.suspended],
    ]) {
      await t.test(`${name} subscription: confirm refused, nothing created`, async () => {
        const file = await xlsx([[name, email(`status-${name}`), '', 'Instructor']]);
        const shown = await preview(file, org);
        assert.equal(shown.seats.subscriptionStatus, name);
        assert.equal(shown.canConfirm, false, 'the UI disables confirm');
        const response = await confirm(file, shown.previewDigest, org);
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error.code, 'SUBSCRIPTION_NOT_ACTIVE');
        assert.deepEqual(await countOf(org), { users: 0, tokens: 0, outbox: 0 });
      });
    }

    await t.test('two confirms of the same file at once: one imports, the other gets the conflict', async () => {
      const file = await xlsx(
        [1, 2, 3, 4, 5].map((n) => [`Race ${n}`, email(`race-${n}`), '', 'Instructor']),
      );
      const { previewDigest } = await preview(file, orgs.race);
      const responses = await Promise.all([
        confirm(file, previewDigest, orgs.race),
        confirm(file, previewDigest, orgs.race),
      ]);
      const statuses = responses.map((r) => r.status).sort();
      assert.deepEqual(statuses, [201, 409]);
      const loser = responses.find((r) => r.status === 409);
      assert.equal((await loser.json()).error.code, 'IMPORT_CHANGED');
      assert.deepEqual(await countOf(orgs.race), { users: 5, tokens: 5, outbox: 6 });
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  }
});
