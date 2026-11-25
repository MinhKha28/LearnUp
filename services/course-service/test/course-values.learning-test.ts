import './learning-env';
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
import type { CurrentUser } from '@learnup/ts-common';

// Run npm run test:values:learning from course-service; see README prerequisites.
// Run against freshly migrated disposable Learning and seeded Course databases.
// DATABASE_URL is Learning; COURSE_DATABASE_URL and COURSE_SERVICE_URL select Course.
// The caller owns and drops both databases; the test locks the seeded Course.
if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing assignment integration test in production.');

function disposableDatabaseUrl(variable: string): string {
  const value = process.env[variable];
  if (!value)
    throw new Error(variable + ' must select a disposable test database.');
  const name = new URL(value).pathname.slice(1);
  if (!/^(learning|course)_[a-z0-9_]+_test$/.test(name)) {
    throw new Error(variable + ' database name must end in _test.');
  }
  return value;
}

const learningDatabaseUrl = disposableDatabaseUrl('DATABASE_URL');
const courseDatabaseUrl = disposableDatabaseUrl('COURSE_DATABASE_URL');
assert.notEqual(
  new URL(learningDatabaseUrl).pathname,
  new URL(courseDatabaseUrl).pathname,
);
// PUBLISHED_PRIVATE in prisma/seed.ts (81ac5f6a); these are fixture identities.
const ORG = '01900000-0000-7000-8000-00000000a001';
const PRIVATE = '01900000-0000-7000-8000-c00200000065';
const ORGANIZER: CurrentUser = {
  userId: '01900000-0000-7000-8000-00000000a010',
  organizationId: ORG,
  role: 'ORGANIZER',
  isAuthenticated: true,
};
const learningRequire = createRequire(
  require.resolve('../../learning-service/package.json'),
);
const { NestFactory } = learningRequire(
  '@nestjs/core',
) as typeof import('@nestjs/core');
const db = new Client({ connectionString: learningDatabaseUrl });
const courseDb = new Client({ connectionString: courseDatabaseUrl });
const learnerId = randomUUID();
let app: NestExpressApplication;
let url: string;
before(async () => {
  await db.connect();
  await courseDb.connect();
  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'],
  });
  configureApp(app);
  app.get<TenantClient>(TENANT_CLIENT).lookupLearners = (_user, ids) =>
    Promise.resolve(
      ids.map((userId) => ({
        userId,
        role: 'Learner',
        status: 'Active',
        activatedAt: null,
        deletedAt: null,
        fullName: 'Học viên kiểm thử',
        email: 'learner@example.test',
      })),
    );
  await app.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
after(async () => {
  try {
    if (app) await app.close();
  } finally {
    await Promise.all([db.end(), courseDb.end()]);
  }
});
void test('UC24.2: new seed Private Course passes real I1 and creates a Required assignment', async () => {
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
