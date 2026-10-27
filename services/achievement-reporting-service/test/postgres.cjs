const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Pool } = require('pg');
const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');
const {
  CertificatesRepository,
} = require('../dist/src/modules/certificates/certificates.repository');
async function isolatedDatabase() {
  if (process.env.NODE_ENV === 'production' || !process.env.DATABASE_URL)
    throw new Error('Non-production DATABASE_URL required');
  const schema = 'ar1_test_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: url.toString() });
  try {
    await pool.query(
      readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261024000000_certificate_issuance/migration.sql',
        ),
        'utf8',
      ).replace(/^CREATE SCHEMA IF NOT EXISTS "public";\s*/m, ''),
    );
    await pool.query(
      readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261025000000_certificate_signer_settings/migration.sql',
        ),
        'utf8',
      ),
    );
    const db = new PrismaService({ getOrThrow: () => url.toString() });
    await db.$connect();
    return {
      pool,
      db,
      repository: new CertificatesRepository(db),
      schema,
      connectionString: url.toString(),
      async cleanup() {
        await db.$disconnect();
        await pool.end();
        if (!/^ar1_test_[a-f0-9]{32}$/.test(schema))
          throw new Error('Invalid cleanup schema');
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
      },
    };
  } catch (error) {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    throw error;
  }
}
module.exports = { isolatedDatabase };
