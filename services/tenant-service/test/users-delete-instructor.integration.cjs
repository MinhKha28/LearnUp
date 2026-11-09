// UC12.6 - Xóa tài khoản Instructor trên Postgres thật (chỉ mục duy nhất có điều kiện, khóa, outbox, HTTP + ValidationPipe).
// course-service được thay bằng bản trong bộ nhớ (vá thẳng vào instance CourseServiceClient của app).
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
  CourseServiceClient,
} = require('../dist/src/infrastructure/clients/course/course-service.client');
const { OutboxModule } = require('../dist/src/modules/outbox/outbox.module');
const { UsersModule } = require('../dist/src/modules/users/users.module');
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

test('UC12.6 delete Instructor with isolated fixtures', async (t) => {
  process.env.INTERNAL_SERVICE_KEY = 'delete-instructor-integration-key-0123';
  class TestModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      OutboxModule,
      IntegrationsModule,
      UsersModule,
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

  // course-service trong bộ nhớ: chainId -> { instructorId, organizationId }.
  const chains = new Map();
  const course = app.get(CourseServiceClient);
  const owned = (user, instructorId) =>
    [...chains.entries()].filter(
      ([, chain]) =>
        chain.instructorId === instructorId &&
        chain.organizationId === user.organizationId,
    );
  const view = ([chainId]) => ({
    chainId,
    courseId: chainId,
    name: `Course ${chainId.slice(0, 8)}`,
    versionNumber: 1,
    status: 'Published',
    courseType: 'Standard',
    approvedAt: null,
  });
  course.countCourseChainsByInstructors = async (user, ids) =>
    Object.fromEntries(ids.map((id) => [id, owned(user, id).length]));
  course.listCourseChainsByInstructor = async (user, id) =>
    owned(user, id).map(view);
  course.transferCourseChains = async (user, from, to) => {
    const moved = owned(user, from);
    moved.forEach(([, chain]) => {
      chain.instructorId = to;
    });
    return moved.map(view);
  };
  const giveChain = (user) =>
    chains.set(randomUUID(), {
      instructorId: user.id,
      organizationId: user.organizationId,
    });

  const orgs = {
    active: randomUUID(),
    grace: randomUUID(),
    suspended: randomUUID(),
    other: randomUUID(),
    lonely: randomUUID(),
  };
  const orgIds = Object.values(orgs);
  const organizer = randomUUID();
  const tag = randomUUID().slice(0, 8);
  const email = (name) => `delete-${tag}-${name}@example.test`;
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
    assert.ok(
      await db.platformSetting.findFirst(),
      'seed platform settings first (prisma:seed)',
    );

    await db.organization.createMany({
      data: orgIds.map((id, index) => ({
        id,
        name: `Delete fixture ${index}`,
        taxCode: `97000000${index}`,
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
        subscription(orgs.active, 'Active', 9),
        subscription(orgs.grace, 'Grace', 5),
        subscription(orgs.suspended, 'Suspended', 5),
        subscription(orgs.other, 'Active', 5),
        subscription(orgs.lonely, 'Active', 5),
      ],
    });

    const active = { status: 'Active', activatedAt: new Date() };
    const createUser = (organizationId, name, extra = {}) =>
      db.user.create({
        data: {
          organizationId,
          email: email(name),
          fullName: `Fixture ${name}`,
          role: 'Instructor',
          status: 'Pending',
          ...extra,
        },
      });
    const a = await createUser(orgs.active, 'a', active); // có chuỗi
    const b = await createUser(orgs.active, 'b', active); // người tiếp nhận
    const c = await createUser(orgs.active, 'c', active); // không có chuỗi
    const x = await createUser(orgs.active, 'x', active); // xóa chéo với y
    const y = await createUser(orgs.active, 'y', active);
    const deactivated = await createUser(orgs.active, 'd', {
      status: 'Deactivated',
      activatedAt: new Date(),
    });
    const pending = await createUser(orgs.active, 'p');
    const pendingToken = await db.accountToken.create({
      data: {
        organizationId: orgs.active,
        userId: pending.id,
        purpose: 'Invitation',
        tokenHash: randomBytes(32),
        expiresAt: new Date(Date.now() + 3 * DAY_MS),
      },
    });
    const alreadyDeleted = await createUser(orgs.active, 'gone', {
      ...active,
      deletedAt: new Date(),
    });
    const otherOrg = await createUser(orgs.other, 'o', active);
    const otherOrgDeleted = await createUser(orgs.other, 'og', {
      ...active,
      deletedAt: new Date(),
    });
    const lonely = await createUser(orgs.lonely, 'l', active);
    // Còn một Instructor khác nhưng Pending: không phải người tiếp nhận hợp lệ (D2).
    await createUser(orgs.lonely, 'lp');
    const grace = await createUser(orgs.grace, 'g', active);
    const suspended = await createUser(orgs.suspended, 's', active);
    [a, a, x, y, lonely].forEach(giveChain);

    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1/users/instructors`;
    const call = (method, path, { org = orgs.active, body } = {}) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
          'x-user-id': organizer,
          'x-user-role': 'ORGANIZER',
          'x-organization-id': org,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const remove = (id, body, org) =>
      call('DELETE', `/${id}`, { body: body ?? {}, org });
    const json = async (response) => response.json();
    const row = (id) => db.user.findUnique({ where: { id } });
    const outboxOf = (aggregateId) =>
      db.outboxEvent.findMany({
        where: { aggregateId },
        orderBy: { id: 'asc' },
      });

    await t.test('400 for invalid body / id', async () => {
      assert.equal((await remove('not-a-uuid')).status, 400);
      assert.equal(
        (await remove(c.id, { receiverInstructorId: 'abc' })).status,
        400,
      );
      assert.equal((await remove(c.id, { extra: 1 })).status, 400);
      assert.equal(
        (await remove(c.id, { reason: 'x'.repeat(1001) })).status,
        400,
      );
      assert.equal((await row(c.id)).deletedAt, null);
    });

    await t.test('chains + valid receiver: transfer then soft delete', async () => {
      const seatsBefore = (await json(await call('GET', '/seats'))).data;
      const response = await remove(a.id, {
        receiverInstructorId: b.id,
        reason: '  Nghỉ   việc ',
      });
      assert.equal(response.status, 200);
      const { data, message } = await json(response);
      assert.equal(message, 'Xóa Instructor thành công');
      assert.equal(data.changed, true);
      assert.equal(data.transferredCourses.length, 2);
      assert.equal(data.receiver.id, b.id);
      assert.equal(data.seats.used, seatsBefore.used - 1);
      assert.ok((await row(a.id)).deletedAt instanceof Date);
      assert.equal(owned({ organizationId: orgs.active }, b.id).length, 2);

      const events = await outboxOf(a.id);
      assert.deepEqual(
        events.map((event) => event.eventType),
        ['EmailRequested', 'AuditRecorded'],
      );
      assert.ok(events.every((event) => event.organizationId === orgs.active));
      assert.ok(events.every((event) => event.occurredAt instanceof Date));
      assert.equal(events[1].payload.actionType, 'INSTRUCTOR_DELETED');
      assert.equal(events[1].payload.details.reason, 'Nghỉ việc');
      assert.equal(events[1].payload.details.chainIds.length, 2);
      const receiverMail = await outboxOf(b.id);
      assert.equal(receiverMail[0].payload.templateCode, 'COURSE_CHAINS_TRANSFERRED');
    });

    await t.test('repeat on a deleted id of the same organization: 200 changed:false', async () => {
      for (const id of [a.id, alreadyDeleted.id]) {
        const response = await remove(id);
        assert.equal(response.status, 200);
        assert.equal((await json(response)).data.changed, false);
      }
      assert.equal((await outboxOf(a.id)).length, 2, 'nothing new enqueued');
    });

    for (const [name, id] of [
      ['a deleted id of another organization', otherOrgDeleted.id],
      ['an active Instructor of another organization', otherOrg.id],
      ['an unknown id', randomUUID()],
    ]) {
      await t.test(`404 for ${name}`, async () => {
        const response = await remove(id);
        assert.equal(response.status, 404);
        assert.equal((await json(response)).error.code, 'INSTRUCTOR_NOT_FOUND');
      });
    }
    assert.equal((await row(otherOrg.id)).deletedAt, null);

    await t.test('the email of a deleted account can be given to a new account', async () => {
      const response = await call('POST', '', {
        body: { fullName: 'Fixture a again', email: a.email },
      });
      assert.equal(response.status, 201);
      const created = (await json(response)).data;
      assert.notEqual(created.id, a.id);
      const sameEmail = await db.user.findMany({ where: { email: a.email } });
      assert.equal(sameEmail.length, 2);
      assert.equal(sameEmail.filter((user) => user.deletedAt === null).length, 1);
    });

    for (const [name, receiver] of [
      ['another organization', otherOrg],
      ['a deactivated account', deactivated],
      ['a pending account', pending],
      ['a deleted account', alreadyDeleted],
      ['the account being deleted', x],
    ]) {
      await t.test(`400 INVALID_RECEIVER for ${name}`, async () => {
        const response = await remove(x.id, { receiverInstructorId: receiver.id });
        assert.equal(response.status, 400);
        assert.equal((await json(response)).error.code, 'INVALID_RECEIVER');
        assert.equal((await row(x.id)).deletedAt, null);
      });
    }

    await t.test('409 RECEIVER_REQUIRED / NO_VALID_RECEIVER with the course list', async () => {
      const required = await remove(x.id);
      assert.equal(required.status, 409);
      assert.equal((await json(required)).error.code, 'RECEIVER_REQUIRED');
      const blocked = await remove(lonely.id, {}, orgs.lonely);
      assert.equal(blocked.status, 409);
      const body = await json(blocked);
      assert.equal(body.error.code, 'NO_VALID_RECEIVER');
      assert.equal(body.error.courses.length, 1);
      assert.equal((await row(lonely.id)).deletedAt, null);
    });

    await t.test('crossed deletions x->y and y->x run one after the other', async () => {
      const [first, second] = await Promise.all([
        remove(x.id, { receiverInstructorId: y.id }),
        remove(y.id, { receiverInstructorId: x.id }),
      ]);
      const statuses = [first.status, second.status].sort();
      assert.deepEqual(statuses, [200, 400]);
      const deleted = [(await row(x.id)).deletedAt, (await row(y.id)).deletedAt];
      assert.equal(deleted.filter(Boolean).length, 1);
      const survivor = deleted[0] ? y : x;
      assert.equal(
        owned({ organizationId: orgs.active }, survivor.id).length,
        2,
        'no chain is left with a deleted Instructor',
      );
    });

    await t.test('a Pending account: invitation revoked, no email', async () => {
      const response = await remove(pending.id);
      assert.equal(response.status, 200);
      const token = await db.accountToken.findUnique({ where: { id: pendingToken.id } });
      assert.ok(token.revokedAt instanceof Date);
      const events = await outboxOf(pending.id);
      assert.deepEqual(events.map((event) => event.eventType), ['AuditRecorded']);
      assert.equal(events[0].payload.details.previousStatus, 'Pending');
    });

    await t.test('a Deactivated account without chains is deleted', async () => {
      assert.equal((await remove(deactivated.id)).status, 200);
      assert.ok((await row(deactivated.id)).deletedAt instanceof Date);
    });

    await t.test('Grace allows, Suspended blocks', async () => {
      assert.equal((await remove(grace.id, {}, orgs.grace)).status, 200);
      const blocked = await remove(suspended.id, {}, orgs.suspended);
      assert.equal(blocked.status, 403);
      assert.equal((await json(blocked)).error.code, 'SUBSCRIPTION_NOT_ACTIVE');
      assert.equal((await row(suspended.id)).deletedAt, null);
    });

    await t.test('GET deletion preview', async () => {
      const response = await call('GET', `/${c.id}/deletion`);
      assert.equal(response.status, 200);
      const { data } = await json(response);
      assert.deepEqual(
        [data.canDelete, data.blockReason, data.courses],
        [true, null, []],
      );
      assert.equal((await call('GET', `/${a.id}/deletion`)).status, 404);
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  }
});
