import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { Client } from 'pg';
import { COURSE_STATUS } from '../src/modules/courses/course-values';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing migration tests in production.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const schema = `course_values_test_${randomUUID().replaceAll('-', '')}`;
const organizationId = randomUUID();
const initial = readFileSync(
  'prisma/migrations/20260930125513_init_course/migration.sql',
  'utf8',
);
const migration = readFileSync(
  'prisma/migrations/20261017090000_normalize_course_values/migration.sql',
  'utf8',
);

before(async () => {
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
});
after(async () => {
  await client.query('ROLLBACK');
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
});
async function reset() {
  await client.query('ROLLBACK');
  await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(initial);
}
async function insert(status: string, courseType: string) {
  const chain = randomUUID();
  await client.query(
    'INSERT INTO course_chains(id,organization_id,instructor_id,updated_at) VALUES($1,$2,$3,now())',
    [chain, organizationId, randomUUID()],
  );
  await client.query(
    `INSERT INTO courses(id,organization_id,chain_id,version_number,name,expected_completion_days,course_type,status,updated_at)
    VALUES($1,$2,$3,1,'Khóa học kiểm thử',14,$4,$5,now())`,
    [randomUUID(), organizationId, chain, courseType, status],
  );
}
test('empty database: both CHECKs added, existing indexes preserved', async () => {
  await reset();
  const indexes = () =>
    client.query(
      "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename='courses' ORDER BY indexname",
      [schema],
    );
  const beforeIndexes = await indexes();
  await client.query(migration);
  const checks = await client.query(
    "SELECT conname FROM pg_constraint WHERE conrelid='courses'::regclass AND contype='c' ORDER BY conname",
  );
  assert.deepEqual(
    checks.rows.map((r) => r.conname),
    ['ck_courses_course_type', 'ck_courses_status'],
  );
  assert.deepEqual((await indexes()).rows, beforeIndexes.rows);
});
test('maps all six uppercase statuses and both uppercase types; preserves Title Case', async () => {
  await reset();
  for (const status of Object.values(COURSE_STATUS)) {
    await insert(status.toUpperCase(), 'PUBLIC');
    await insert(status, 'PRIVATE');
    await insert(status, 'Public');
    await insert(status, 'Private');
  }
  await client.query(migration);
  const rows = await client.query(
    'SELECT status,course_type,count(*)::int AS count FROM courses WHERE organization_id=$1 GROUP BY status,course_type',
    [organizationId],
  );
  assert.equal(rows.rows.length, 12);
  assert.ok(rows.rows.every((row) => row.count === 2));
  for (const status of Object.values(COURSE_STATUS)) {
    for (const courseType of ['Public', 'Private'])
      assert.ok(
        rows.rows.some(
          (r) => r.status === status && r.course_type === courseType,
        ),
      );
  }
  await assert.rejects(insert('DRAFT', 'Public'), /ck_courses_status/);
  await assert.rejects(insert('Draft', 'PUBLIC'), /ck_courses_course_type/);
});
for (const [status, courseType] of [
  ['draft', 'Public'],
  ['Unknown', 'Public'],
  ['Draft', 'public'],
  ['Draft', 'Unknown'],
]) {
  test(`rejects unknown ${status}/${courseType} atomically`, async () => {
    await reset();
    await insert('DRAFT', 'PUBLIC');
    await insert(status, courseType);
    await assert.rejects(
      client.query(migration),
      /Unknown Course status or course_type/,
    );
    await client.query('ROLLBACK');
    const rows = await client.query(
      'SELECT status,course_type FROM courses WHERE organization_id=$1',
      [organizationId],
    );
    assert.ok(
      rows.rows.some((r) => r.status === 'DRAFT' && r.course_type === 'PUBLIC'),
    );
    const checks = await client.query(
      "SELECT conname FROM pg_constraint WHERE conrelid='courses'::regclass AND contype='c'",
    );
    assert.equal(checks.rowCount, 0);
  });
}
