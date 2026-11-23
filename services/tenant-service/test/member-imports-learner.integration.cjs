// UC13.8 - Import Learner từ Excel trên Postgres thật: route learners/imports/*, số chỗ Learner,
// lời mời LEARNER_INVITATION, chặn zip bomb qua HTTP. Phần chung với UC12.8 nằm ở member-imports.integration.cjs.
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
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Trần giải nén nhỏ cho riêng tệp test này (mỗi tệp test chạy một process riêng).
const UNCOMPRESSED_CAP = 256 * 1024;

async function xlsx(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Learners');
  sheet.addRow(['Họ tên*', 'Email*', 'Đơn vị công tác', 'Vai trò*']);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('UC13.8 import Learners with isolated fixtures', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'member-import-learner-integration-key-0123';
  process.env.IMPORT_MAX_UNCOMPRESSED_BYTES = String(UNCOMPRESSED_CAP);
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
    main: randomUUID(), // Active, 4 chỗ Learner, đã có 1 Learner + 1 Instructor
    other: randomUUID(),
  };
  const orgIds = Object.values(orgs);
  const organizer = randomUUID();
  const tag = randomUUID().slice(0, 8);
  const email = (name) => `learner-import-${tag}-${name}@example.test`;
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

    await db.organization.createMany({
      data: orgIds.map((id, index) => ({
        id,
        name: `Learner import fixture ${index}`,
        taxCode: `97000000${index}`,
        address: 'Test',
        contactPhone: '0900000000',
        status: 'Active',
      })),
    });
    await db.subscription.createMany({
      data: orgIds.map((organizationId) => ({
        organizationId,
        planId: plan.id,
        source: 'Registration',
        status: 'Active',
        price: plan.price,
        durationDays: plan.durationDays,
        maxLearners: 4,
        maxInstructors: 10,
        maxCourseChains: plan.maxCourseChains,
        maxStorageBytes: plan.maxStorageBytes,
        startsAt: new Date(Date.now() - 10 * DAY_MS),
        expiresAt: new Date(Date.now() + 20 * DAY_MS),
      })),
    });
    const createUser = (organizationId, name, role) =>
      db.user.create({
        data: {
          organizationId,
          email: email(name),
          fullName: `Fixture ${name}`,
          role,
          status: 'Active',
          activatedAt: new Date(),
        },
      });
    await createUser(orgs.main, 'existing-learner', 'Learner');
    await createUser(orgs.main, 'existing-instructor', 'Instructor'); // không tính vào chỗ Learner
    await createUser(orgs.other, 'taken', 'Learner');

    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/api/v1/users`;
    const headers = (role = 'ORGANIZER') => ({
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
      'x-user-id': organizer,
      'x-user-role': role,
      'x-organization-id': orgs.main,
    });
    const call = (path, { file, digest, role, member = 'learners' } = {}) => {
      const form = new FormData();
      if (file) form.append('file', new Blob([file]), 'learners.xlsx');
      if (digest !== undefined) form.append('previewDigest', digest);
      return fetch(`${root}/${member}/imports${path}`, {
        method: 'POST',
        headers: headers(role),
        body: form,
      });
    };
    const preview = async (file) => {
      const response = await call('/preview', { file });
      assert.equal(response.status, 200);
      return (await response.json()).data;
    };
    const confirm = (file, digest) => call('', { file, digest });
    const countOf = async () => ({
      users: await db.user.count({ where: { organizationId: orgs.main } }),
      tokens: await db.accountToken.count({
        where: { organizationId: orgs.main },
      }),
      outbox: await db.outboxEvent.count({
        where: { organizationId: orgs.main },
      }),
    });

    let template;
    await t.test('template: Learner file, role column only offers "Learner"', async () => {
      const response = await fetch(`${root}/learners/imports/template`, {
        headers: headers(),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), XLSX_MIME);
      assert.match(
        response.headers.get('content-disposition'),
        /learnup-learner-import-template\.xlsx/,
      );
      assert.equal(response.headers.get('cache-control'), 'no-store');
      template = Buffer.from(await response.arrayBuffer());

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(template);
      const sheet = workbook.worksheets[0];
      assert.deepEqual(sheet.getRow(1).values.slice(1), [
        'Họ tên *',
        'Email *',
        'Đơn vị công tác',
        'Vai trò *',
      ]);
      assert.deepEqual(sheet.getCell('D2').dataValidation.formulae, ['"Learner"']);

      // Tệp mẫu chưa điền: không có dòng dữ liệu.
      const empty = await call('/preview', { file: template });
      assert.equal(empty.status, 400);
      assert.equal((await empty.json()).error.code, 'EMPTY_IMPORT_FILE');
    });

    await t.test('403 for a non-Organizer on every Learner route', async () => {
      for (const role of ['INSTRUCTOR', 'LEARNER']) {
        const templateResponse = await fetch(`${root}/learners/imports/template`, {
          headers: headers(role),
        });
        assert.equal(templateResponse.status, 403, `template as ${role}`);
        const previewResponse = await call('/preview', {
          file: await xlsx([['A', email('a'), '', 'Learner']]),
          role,
        });
        assert.equal(previewResponse.status, 403, `preview as ${role}`);
        const confirmResponse = await call('', {
          file: await xlsx([['A', email('a'), '', 'Learner']]),
          digest: '0'.repeat(64),
          role,
        });
        assert.equal(confirmResponse.status, 403, `confirm as ${role}`);
      }
      assert.deepEqual(await countOf(), { users: 2, tokens: 0, outbox: 0 });
    });

    // Điền vào chính tệp mẫu vừa tải (luồng thật của Organizer), bắt đầu từ dòng 2.
    // Không dùng addRows: data validation dòng 2..501 của tệp mẫu làm addRows ghi từ dòng 502.
    const filled = new ExcelJS.Workbook();
    await filled.xlsx.load(template ?? (await xlsx([])));
    [
      ['  Phạm   Học ', ` ${email('Hoc').toUpperCase()} `, 'Lớp 10A', 'learner'],
      ['Ngô Vy', email('vy'), '', 'Learner'],
      ['Sai vai trò', email('wrong-role'), '', 'Instructor'], // BR-34: tệp Learner chỉ nhận Learner
      ['Đã dùng', email('taken'), '', 'Learner'], // BR-38
    ].forEach((values, index) => {
      filled.worksheets[0].getRow(index + 2).values = values;
    });
    const mainFile = Buffer.from(await filled.xlsx.writeBuffer());

    let mainPreview;
    await t.test('preview: Learner rows, INVALID_ROLE for Instructor, Learner seats only, nothing written', async () => {
      const before = await countOf();
      mainPreview = await preview(mainFile);
      assert.deepEqual(await countOf(), before);

      assert.equal(mainPreview.role, 'Learner');
      assert.equal(mainPreview.totalRows, 4);
      assert.deepEqual(
        mainPreview.validRows.map((row) => [row.rowNumber, row.email, row.fullName, row.department]),
        [
          [2, email('hoc'), 'Phạm Học', 'Lớp 10A'],
          [3, email('vy'), 'Ngô Vy', null],
        ],
      );
      assert.deepEqual(
        mainPreview.invalidRows.map((row) => [row.rowNumber, row.errors.map((e) => `${e.field}:${e.code}`)]),
        [
          [4, ['role:INVALID_ROLE']],
          [5, ['email:EMAIL_ALREADY_USED']],
        ],
      );
      // Instructor của tổ chức không chiếm chỗ Learner.
      assert.deepEqual(
        [mainPreview.seats.used, mainPreview.seats.max, mainPreview.seats.remaining],
        [1, 4, 3],
      );
      assert.equal(mainPreview.canConfirm, true);
    });

    await t.test('a Learner previewDigest cannot confirm on the Instructor route', async () => {
      const before = await countOf();
      const response = await call('', {
        member: 'instructors',
        file: mainFile,
        digest: mainPreview.previewDigest,
      });
      assert.equal(response.status, 409);
      const { error } = await response.json();
      assert.equal(error.code, 'IMPORT_CHANGED');
      // Digest gắn với role: ở route Instructor, chỉ dòng ghi "Instructor" mới hợp lệ.
      assert.equal(error.preview.role, 'Instructor');
      assert.deepEqual(error.preview.validRows.map((row) => row.email), [email('wrong-role')]);
      assert.deepEqual(await countOf(), before);
      assert.equal(await db.user.count({ where: { email: email('wrong-role') } }), 0);
    });

    await t.test('confirm creates Pending Learners, hashed tokens, LEARNER_INVITATION emails and one audit row', async () => {
      const response = await confirm(mainFile, mainPreview.previewDigest);
      assert.equal(response.status, 201);
      const { data } = await response.json();
      assert.equal(data.createdCount, 2);
      assert.equal(data.skippedCount, 2);
      assert.deepEqual(data.accounts.map((a) => a.rowNumber), [2, 3]);

      const created = await db.user.findMany({
        where: { organizationId: orgs.main, email: { in: [email('hoc'), email('vy')] } },
        orderBy: { email: 'asc' },
      });
      assert.deepEqual(
        created.map((u) => [u.email, u.role, u.status, u.activatedAt]),
        [
          [email('hoc'), 'Learner', 'Pending', null],
          [email('vy'), 'Learner', 'Pending', null],
        ],
      );
      assert.equal(await db.user.count({ where: { email: email('wrong-role') } }), 0);

      const tokens = await db.accountToken.findMany({ where: { organizationId: orgs.main } });
      assert.deepEqual(tokens.map((tk) => tk.userId).sort(), created.map((u) => u.id).sort());
      assert.ok(tokens.every((tk) => tk.purpose === 'Invitation' && tk.tokenHash.length === 32));

      const events = await db.outboxEvent.findMany({ where: { organizationId: orgs.main } });
      const emails = events.filter((e) => e.eventType === 'EmailRequested');
      const audits = events.filter((e) => e.eventType === 'AuditRecorded');
      assert.equal(emails.length, 2);
      assert.ok(emails.every((e) => e.payload.templateCode === 'LEARNER_INVITATION'));
      assert.equal(audits.length, 1);
      assert.equal(audits[0].payload.actionType, 'MEMBER_IMPORTED');
      assert.equal(audits[0].payload.actorUserId, organizer);
      assert.deepEqual(
        [audits[0].payload.details.createdCount, audits[0].payload.details.skippedCount],
        [2, 2],
      );
    });

    await t.test('BR-33: more valid Learner rows than remaining Learner seats blocks the whole import', async () => {
      const file = await xlsx([
        ['Seat 1', email('seat-1'), '', 'Learner'],
        ['Seat 2', email('seat-2'), '', 'Learner'],
      ]);
      const shown = await preview(file);
      assert.deepEqual([shown.seats.used, shown.seats.remaining], [3, 1]);
      assert.equal(shown.exceedsSeats, true);
      assert.equal(shown.canConfirm, false);

      const before = await countOf();
      const response = await confirm(file, shown.previewDigest);
      assert.equal(response.status, 409);
      const { error } = await response.json();
      assert.equal(error.code, 'IMPORT_EXCEEDS_SEATS');
      assert.deepEqual([error.validCount, error.remaining], [2, 1]);
      assert.deepEqual(await countOf(), before);
    });

    await t.test('a small .xlsx that expands past IMPORT_MAX_UNCOMPRESSED_BYTES is refused with 400', async () => {
      // Mỗi ô một chuỗi khác nhau (sharedStrings không gộp được) nhưng nén rất tốt.
      const bomb = await xlsx(
        Array.from({ length: 40 }, (_, n) => [`B${n}`, email(`bomb-${n}`), `${n}`.padEnd(30_000, 'x'), 'Learner']),
      );
      assert.ok(bomb.length < 128 * 1024, `the file itself is small (${bomb.length} bytes)`);

      const before = await countOf();
      for (const [path, digest] of [['/preview', undefined], ['', '0'.repeat(64)]]) {
        const response = await call(path, { file: bomb, digest });
        assert.equal(response.status, 400, path || 'confirm');
        const { error } = await response.json();
        assert.equal(error.code, 'INVALID_IMPORT_FILE');
        assert.match(error.message, /quá lớn sau khi giải nén/);
      }
      assert.deepEqual(await countOf(), before);
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  }
});
