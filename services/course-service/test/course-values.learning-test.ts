import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { AppModule } from '../../learning-service/src/app.module';
import { configureApp } from '../../learning-service/src/app.setup';
import {
  TENANT_CLIENT,
  TenantClient,
} from '../../learning-service/src/infrastructure/clients/tenant/tenant.client';
import { CourseServiceClient } from '../../learning-service/src/infrastructure/clients/course/course-service.client';
import {
  ENROLL_IT_ORG as ORG,
  ENROLL_IT_PRIVATE_COURSE as PRIVATE,
  ENROLL_IT_ORGANIZER as ORGANIZER,
  resetEnrollFixture,
  courseDatabaseUrl,
} from '../../learning-service/test/integration/enroll-it-fixture';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing assignment integration test in production.');
const learningRequire = createRequire(
  require.resolve('../../learning-service/package.json'),
);
const { NestFactory } = learningRequire(
  '@nestjs/core',
) as typeof import('@nestjs/core');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const courseDb = new Client({ connectionString: courseDatabaseUrl() });
const learnerId = randomUUID();
let app: NestExpressApplication;
let url: string;
let connected = false;
async function cleanFixture() {
  await resetEnrollFixture(db, courseDb);
  await db.query(
    "DELETE FROM outbox_events WHERE organization_id=$1 AND event_type='EnrollmentAssigned'",
    [ORG],
  );
}
before(async () => {
  await db.connect();
  await courseDb.connect();
  connected = true;
  await cleanFixture();
  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'],
  });
  configureApp(app);
  app.get<TenantClient>(TENANT_CLIENT).lookupLearners = async (_user, ids) =>
    ids.map((userId) => ({
      userId,
      role: 'Learner',
      status: 'Active',
      activatedAt: null,
      deletedAt: null,
      fullName: 'Học viên kiểm thử',
      email: 'learner@example.test',
    }));
  await app.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
after(async () => {
  try {
    if (connected) await cleanFixture();
  } finally {
    if (app) await app.close();
    await Promise.all([db.end(), courseDb.end()]);
  }
});
test('UC24.2: new seed Private Course passes real I1 and creates a Required assignment', async () => {
  const seed = await courseDb.query(
    'SELECT status,course_type FROM courses WHERE id=$1 AND organization_id=$2',
    [PRIVATE, ORG],
  );
  assert.deepEqual(seed.rows, [
    { status: 'Published', course_type: 'Private' },
  ]);
  const lock = await app
    .get(CourseServiceClient)
    .lockCourse(ORGANIZER, PRIVATE, false);
  assert.equal(lock.courseType, 'Private');
  const response = await fetch(`${url}/api/v1/assignments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
      'x-user-id': ORGANIZER.userId,
      'x-organization-id': ORG,
      'x-user-role': 'ORGANIZER',
    },
    body: JSON.stringify({ courseId: PRIVATE, learnerIds: [learnerId] }),
  });
  assert.equal(response.status, 201);
  const body = (await response.json()) as { data: unknown };
  assert.deepEqual(body.data, {
    created: 1,
    converted: 0,
    completedOnAssign: 0,
    restored: 0,
  });
  const row = await db.query(
    'SELECT enrollment_type FROM enrollments WHERE organization_id=$1 AND course_id=$2 AND learner_id=$3',
    [ORG, PRIVATE, learnerId],
  );
  assert.deepEqual(row.rows, [{ enrollment_type: 'Required' }]);
});
