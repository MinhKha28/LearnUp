import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from './test-runner';
import { TestClient as Client } from './test-io';
import { databaseUrl } from './enroll-it-fixture';

const migration = '20261029160000_freeze_deadline_timezone';

void test('deadline timezone migration backfills only dated rows and rejects either NULL mismatch', async () => {
  const db = new Client({ connectionString: databaseUrl() });
  const schema = `deadline_migration_${randomUUID().replaceAll('-', '')}`;
  await db.connect();
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    for (const directory of readdirSync('prisma/migrations').sort()) {
      if (directory >= migration) continue;
      await db.query(
        readFileSync(`prisma/migrations/${directory}/migration.sql`, 'utf8'),
      );
    }
    const organization = randomUUID(),
      course = randomUUID();
    await db.query(
      `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of)
      VALUES ($1,$2,$1,now(),now())`,
      [course, organization],
    );
    const required = randomUUID(),
      optional = randomUUID();
    // Deliberately run against develop's schema BEFORE due_timezone exists.
    await db.query(
      `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,
      assigned_at,expected_completion_days,base_due_at,due_at,video_completion_percent)
      VALUES ($1,$3,$1,$4,'Required','NotStarted',now(),1,now()+interval '1 day',now()+interval '1 day',90),
        ($2,$3,$2,$4,'Optional','NotStarted',NULL,NULL,NULL,NULL,90)`,
      [required, optional, organization, course],
    );
    const before = (
      await db.query<{ id: string; due_at: Date | null }>(
        'SELECT id,due_at FROM enrollments ORDER BY id',
      )
    ).rows;
    await db.query(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'),
    );
    const after = (
      await db.query<{
        id: string;
        due_at: Date | null;
        due_timezone: string | null;
      }>('SELECT id,due_at,due_timezone FROM enrollments ORDER BY id')
    ).rows;
    assert.deepEqual(
      after.map(({ id, due_at }) => ({ id, due_at })),
      before,
    );
    assert.equal(
      after.find((row) => row.id === required)?.due_timezone,
      'Asia/Ho_Chi_Minh',
    );
    assert.equal(after.find((row) => row.id === optional)?.due_timezone, null);
    const check = (
      await db.query(
        `SELECT convalidated FROM pg_constraint
      WHERE conname='enrollments_due_timezone_check' AND connamespace=$1::regnamespace`,
        [schema],
      )
    ).rows;
    assert.deepEqual(check, [{ convalidated: true }]);
    const column = (
      await db.query(
        `SELECT data_type,is_nullable,column_default FROM information_schema.columns
      WHERE table_schema=$1 AND table_name='enrollments' AND column_name='due_timezone'`,
        [schema],
      )
    ).rows;
    assert.deepEqual(column, [
      { data_type: 'text', is_nullable: 'YES', column_default: null },
    ]);
    await db.query('BEGIN');
    for (const [id, zone] of [
      [required, null],
      [optional, 'Pacific/Auckland'],
    ]) {
      await db.query('SAVEPOINT mismatch');
      await assert.rejects(
        db.query('UPDATE enrollments SET due_timezone=$1 WHERE id=$2', [
          zone,
          id,
        ]),
        (error: unknown) => {
          assert.equal((error as { code: string }).code, '23514');
          assert.equal(
            (error as { constraint: string }).constraint,
            'enrollments_due_timezone_check',
          );
          return true;
        },
      );
      await db.query('ROLLBACK TO SAVEPOINT mismatch');
    }
  } finally {
    await db.query('ROLLBACK');
    await db.query('SET search_path TO public');
    assert.match(schema, /^deadline_migration_[a-f0-9]{32}$/);
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.end();
  }
});
