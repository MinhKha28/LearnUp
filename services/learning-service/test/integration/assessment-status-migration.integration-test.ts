import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { test } from './test-runner';

test('assessment migration upgrades the latest develop schema in PostgreSQL', async () => {
  // Historical migrations contain their own BEGIN/COMMIT, so a schema with
  // SET LOCAL search_path would leak subsequent statements into public.
  const target = new URL(process.env.DATABASE_URL!);
  target.pathname = '/postgres';
  const admin = new Client({ connectionString: target.toString() });
  const schema = 'l18_upgrade_' + randomUUID().replaceAll('-', '');
  await admin.connect();
  await admin.query(`CREATE DATABASE "${schema}"`);
  target.pathname = '/' + schema;
  const db = new Client({ connectionString: target.toString() });
  await db.connect();
  try {
    const migration = '20261103120000_assessment_status_consumer';
    const directories = readdirSync('prisma/migrations', {
      withFileTypes: true,
    })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    assert.ok(directories.includes(migration));
    for (const d of directories.filter((d) => d < migration))
      await db.query(
        readFileSync(`prisma/migrations/${d}/migration.sql`, 'utf8'),
      );
    const constraint = async () =>
      (
        await db.query(
          `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE connamespace=$1::regnamespace AND conname='completion_evaluation_requests_source_check'`,
          ['public'],
        )
      ).rows[0].definition as string;
    assert.ok(!(await constraint()).includes('assessment'));
    await db.query(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'),
    );
    assert.ok((await constraint()).includes('assessment'));
    await db.query(
      `INSERT INTO assessment_event_quarantine(id,topic,partition,"offset",reason,payload)
      VALUES ($1,'migration-test',0,1,'INVALID_ENVELOPE','null'::jsonb)`,
      [randomUUID()],
    );
    await db.query(
      `INSERT INTO assessment_event_quarantine(id,topic,partition,"offset",reason,payload)
      VALUES ($1,'migration-test',0,1,'INVALID_ENVELOPE','null'::jsonb) ON CONFLICT(topic,partition,"offset") DO NOTHING`,
      [randomUUID()],
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::integer AS count FROM assessment_event_quarantine',
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await db.end();
    try {
      await admin.query(`DROP DATABASE "${schema}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
});
