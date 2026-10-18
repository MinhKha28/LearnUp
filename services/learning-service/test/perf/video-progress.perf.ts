import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cpus, totalmem, platform, release } from 'node:os';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { MaterialProgressRepository } from '../../src/modules/material-progress/material-progress.repository';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing UC27.2 perf in production.');
const ORG = '27200000-0000-4000-8000-000000000010';
const id = (kind: string, n: number) =>
  `2720${kind}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sqlId = (kind: string, n: string) =>
  `('2720${kind}-0000-4000-8000-'||lpad((${n})::text,12,'0'))::uuid`;
const db = new Client({ connectionString: process.env.DATABASE_URL });
const dir = resolve('../../perf/learning/results');
const write = (name: string, data: unknown) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, name), JSON.stringify(data, null, 2));
};
const fixtureRanges = `(SELECT range_agg(int4range(1000+k*20,1005+k*20)) FROM generate_series(0,4+(i%16)) k)`;

async function cleanup() {
  await db.query('DELETE FROM enrollments WHERE organization_id=$1', [ORG]);
  // Reclaim dead progress tuples before the snapshot FK checks on this large fixture.
  await db.query('VACUUM (ANALYZE) material_progress');
  for (const table of [
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ])
    await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [ORG]);
  const remaining: Record<string, number> = {};
  for (const table of [
    'enrollments',
    'material_progress',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ]) {
    remaining[table] = (
      await db.query(
        `SELECT count(*)::integer AS n FROM ${table} WHERE organization_id=$1`,
        [ORG],
      )
    ).rows[0].n;
  }
  write('uc27.2-cleanup.json', { organizationId: ORG, remaining });
  if (Object.values(remaining).some((n) => n !== 0))
    throw new Error('UC27.2 perf cleanup is incomplete.');
}
async function seed() {
  await cleanup();
  await db.query(
    `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of)
    SELECT ${sqlId('0003', 'i')},$1,${sqlId('0003', 'i')},now(),now() FROM generate_series(1,50000) i`,
    [ORG],
  );
  await db.query(
    `INSERT INTO lesson_snapshots(lesson_id,organization_id,course_id,disabled_as_of)
    SELECT ${sqlId('0005', 'i')},$1,${sqlId('0003', 'i')},now() FROM generate_series(1,50000) i`,
    [ORG],
  );
  await db.query(
    `INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,duration_seconds,duration_as_of,disabled_as_of)
    SELECT ${sqlId('0004', '(i-1)*4+j')},$1,${sqlId('0003', 'i')},${sqlId('0005', 'i')},'Video',true,10000,now(),now()
      FROM generate_series(1,50000) i CROSS JOIN generate_series(1,4) j`,
    [ORG],
  );
  await db.query(
    `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent)
    SELECT ${sqlId('0001', 'i')},$1,${sqlId('0002', 'i')},${sqlId('0003', 'i')},'Optional','NotStarted',90 FROM generate_series(1,50000) i`,
    [ORG],
  );
  await db.query(
    `INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,watched_ranges)
    SELECT ${sqlId('0006', '(i-1)*4+j')},$1,${sqlId('0001', 'i')},${sqlId('0004', '(i-1)*4+j')},${fixtureRanges}
      FROM generate_series(1,50000) i CROSS JOIN generate_series(1,4) j`,
    [ORG],
  );
  for (const table of [
    'enrollments',
    'material_progress',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ])
    await db.query(`ANALYZE ${table}`);
  const counts: Record<string, number> = {};
  for (const table of [
    'enrollments',
    'material_progress',
    'material_snapshots',
    'lesson_snapshots',
    'course_version_snapshots',
  ])
    counts[table] = (
      await db.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE organization_id=$1`,
        [ORG],
      )
    ).rows[0].n;
  write('uc27.2-machine.json', {
    cpu: cpus()[0].model,
    logicalCpu: cpus().length,
    ramGiB: totalmem() / 2 ** 30,
    platform: platform(),
    release: release(),
    node: process.version,
    pool: 10,
    counts,
    ranges: '5–20 disjoint ranges per progress row',
    transport:
      'k6 Docker -> host.docker.internal:18085 -> native Node; PostgreSQL 16 Docker localhost:5433; no gateway/JWT',
  });
}
async function reset() {
  await db.query(
    `UPDATE material_progress p SET watched_ranges=q.ranges,last_reported_at=NULL,completed_at=NULL
    FROM (SELECT ${sqlId('0001', 'i')} AS eid,${fixtureRanges} AS ranges FROM generate_series(1,50000) i) q
    WHERE p.enrollment_id=q.eid AND p.organization_id=$1 AND p.last_reported_at IS NOT NULL`,
    [ORG],
  );
  await db.query(
    `UPDATE enrollments SET status='NotStarted',first_activity_at=NULL WHERE organization_id=$1 AND status='InProgress'`,
    [ORG],
  );
}
async function explain() {
  const queries: { query: string; params: string }[] = [];
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: [{ level: 'query', emit: 'event' }],
  });
  prisma.$on('query', (event) =>
    queries.push({ query: event.query, params: event.params }),
  );
  const repo = new MaterialProgressRepository(
    prisma as unknown as PrismaService,
  );
  try {
    await repo.access(id('0001', 1), id('0002', 1), ORG);
    await repo.material(id('0004', 1), id('0003', 1), ORG);
    await repo.disabledLesson(id('0005', 1), ORG);
    await repo.read(id('0001', 1), id('0004', 1), ORG);
    await repo.transaction(async (tx) => {
      await repo.access(id('0001', 1), id('0002', 1), ORG, tx);
      await repo.insertSnapshot(
        {
          materialId: id('0004', 1),
          organizationId: ORG,
          courseId: id('0003', 1),
          lessonId: id('0005', 1),
          materialType: 'Video',
          isRequired: false,
          durationSeconds: 10000,
          durationAsOf: new Date(),
          disabledAsOf: new Date(),
        },
        tx,
      );
      await repo.lock(id('0001', 1), id('0004', 1), ORG, tx);
      const preview = await repo.preview(
        id('0001', 1),
        id('0004', 1),
        ORG,
        [[0, 15]],
        tx,
      );
      await repo.save(
        id('0001', 1),
        id('0004', 1),
        ORG,
        preview,
        9000,
        [[0, 15]],
        tx,
      );
    });
    const results: unknown[] = [];
    const unique = new Map(
      queries
        .filter((q) => /^\s*(SELECT|INSERT|UPDATE|WITH)/i.test(q.query))
        .map((q) => [q.query, q]),
    );
    for (const q of unique.values()) {
      await db.query('BEGIN');
      try {
        await db.query(
          `UPDATE enrollments SET status='NotStarted',first_activity_at=NULL WHERE id=$1 AND organization_id=$2`,
          [id('0001', 1), ORG],
        );
        await db.query(
          `UPDATE material_progress SET watched_ranges=(SELECT range_agg(int4range(1000+k*20,1005+k*20)) FROM generate_series(0,5) k),last_reported_at=NULL,completed_at=NULL WHERE enrollment_id=$1 AND material_id=$2 AND organization_id=$3`,
          [id('0001', 1), id('0004', 1), ORG],
        );
        const plan = await db.query(
          'EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + q.query,
          JSON.parse(q.params),
        );
        results.push({
          query: q.query,
          params: JSON.parse(q.params),
          plan: plan.rows[0]['QUERY PLAN'][0],
        });
      } finally {
        await db.query('ROLLBACK');
      }
    }
    write('uc27.2-explain.json', results);
    console.log(`EXPLAIN ${results.length} actual repository queries.`);
  } finally {
    await prisma.$disconnect();
  }
}
async function verify(label: string) {
  const result = await db.query(
    `SELECT count(*)::int AS rows,min(num_ranges)::int AS min_ranges,max(num_ranges)::int AS max_ranges,
    count(*) FILTER(WHERE last_reported_at IS NOT NULL)::int AS reporters
    FROM (SELECT p.*, (SELECT count(*) FROM unnest(watched_ranges)) AS num_ranges FROM material_progress p WHERE organization_id=$1) p`,
    [ORG],
  );
  const enrollments = await db.query(
    `SELECT status,count(*)::int FROM enrollments WHERE organization_id=$1 GROUP BY status`,
    [ORG],
  );
  write(`uc27.2-${label}-db.json`, {
    ...result.rows[0],
    enrollments: enrollments.rows,
  });
  if (
    result.rows[0].rows !== 200000 ||
    result.rows[0].reporters !== Number(label) * 15 + 1 ||
    enrollments.rows.find((r) => r.status === 'InProgress')?.count !==
      Number(label) * 15 + 1
  )
    throw new Error('Perf fixture state or reporter count is incorrect.');
  console.log(JSON.stringify(result.rows[0]));
}
async function main() {
  await db.connect();
  try {
    switch (process.argv[2]) {
      case 'seed':
        await seed();
        break;
      case 'reset':
        await reset();
        break;
      case 'explain':
        await explain();
        break;
      case 'verify':
        await verify(process.argv[3]);
        break;
      case 'cleanup':
        await cleanup();
        break;
      default:
        throw new Error('Use seed/reset/explain/verify/cleanup.');
    }
  } catch (error) {
    if (process.argv[2] === 'seed') await cleanup();
    throw error;
  } finally {
    await db.end();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
