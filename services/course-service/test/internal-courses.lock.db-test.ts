import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { InternalCoursesService } from '../src/modules/internal-courses/internal-courses.service';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing database tests: NODE_ENV=production.');
}

const org = '25039000-0000-4000-8000-000000000001';
const courseId = '25039001-0000-4000-8000-000000000001';
const chainId = '25039002-0000-4000-8000-000000000001';
const fixtureIds = Array.from(
  { length: 20_000 },
  (_, n) => `25039001-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
);
const queries: string[] = [];
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  log: [{ emit: 'event', level: 'query' }],
});
prisma.$on('query', (event) => queries.push(event.query));
const service = new InternalCoursesService(prisma as unknown as PrismaService);

async function cleanup() {
  await prisma.course.deleteMany({
    where: { id: { in: fixtureIds }, organizationId: org },
  });
  await prisma.courseChain.deleteMany({
    where: { id: chainId, organizationId: org },
  });
}

before(async () => {
  await cleanup();
  await prisma.courseChain.create({
    data: { id: chainId, organizationId: org, instructorId: org },
  });
  await prisma.course.createMany({
    data: fixtureIds.map((id, n) => ({
      id,
      organizationId: org,
      chainId,
      versionNumber: n + 1,
      name: 'I1 concurrency test',
      learningOutcomes: [],
      expectedCompletionDays: 30,
      status: 'Published',
      courseType: 'Public',
    })),
  });
  await prisma.$executeRawUnsafe('ANALYZE courses');
});

after(async () => {
  try {
    await cleanup();
    await prisma.$executeRawUnsafe('ANALYZE courses');
  } finally {
    await prisma.$disconnect();
  }
});

test('20 concurrent first calls succeed and update locked_at exactly once', async () => {
  queries.length = 0;
  const results = await Promise.all(
    Array.from({ length: 20 }, () => service.lock(org, courseId, true)),
  );
  assert.equal(results.length, 20);
  assert.equal(new Set(results.map((r) => r.lockedAt.toISOString())).size, 1);
  assert.equal(
    queries.filter((sql) => /UPDATE courses\s+SET locked_at/.test(sql)).length,
    1,
  );
  const row = await prisma.course.findFirstOrThrow({
    where: { id: courseId, organizationId: org },
  });
  assert.equal(row.lockedAt!.toISOString(), results[0].lockedAt.toISOString());
});

test('locked calls execute one ordinary SELECT without transaction or row lock', async () => {
  queries.length = 0;
  await service.lock(org, courseId, true);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /SELECT id, organization_id/);
  assert.doesNotMatch(queries[0], /FOR UPDATE|BEGIN|UPDATE courses/);
});

test('explain the fast-path query with fixture data', async () => {
  const plan = await prisma.$queryRawUnsafe<Record<string, string>[]>(
    'EXPLAIN (ANALYZE, BUFFERS) SELECT id, organization_id, chain_id, expected_completion_days, course_type, status, locked_at FROM courses WHERE id = $1::uuid AND organization_id = $2::uuid',
    courseId,
    org,
  );
  const text = plan.map((row) => row['QUERY PLAN']).join('\n');
  console.log(text);
  assert.doesNotMatch(
    text,
    /Seq Scan/,
    'CẦN QUYẾT ĐỊNH: fast-path query uses Seq Scan on courses.',
  );
  assert.match(text, /Index Scan using courses_pkey/);
});
