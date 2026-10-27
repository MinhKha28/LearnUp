// Parent owns the disposable database even if a test hangs or the child crashes.
require('dotenv/config');
require('ts-node').register({ project: 'tsconfig.seed.json' });
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { deadline, IO_TIMEOUT_MS, SUITE_TIMEOUT_MS } = require('./deadlines');

function deployedCourseTimeout() {
  const compose = readFileSync(resolve('../../docker-compose.yml'), 'utf8');
  const section = compose.match(
    /^  learning-service:\r?\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/m,
  )?.[1];
  const deployed = section?.match(
    /^\s+COURSE_SERVICE_TIMEOUT_MS:\s*["']?(\d+)/m,
  )?.[1];
  const example = readFileSync('.env.example', 'utf8').match(
    /^COURSE_SERVICE_TIMEOUT_MS=(\d+)/m,
  )?.[1];
  const value = deployed ?? example;
  if (!value || !Number.isSafeInteger(Number(value)) || Number(value) <= 0)
    throw new Error(
      'No valid deployed/example COURSE_SERVICE_TIMEOUT_MS; no code default',
    );
  console.log(
    `Course HTTP timeout: ${value} ms from ${deployed ? 'docker-compose.yml learning-service' : '.env.example'}`,
  );
  return value;
}

function child(args, env, cap, label) {
  return new Promise((resolveChild, reject) => {
    const proc = spawn(process.execPath, args, {
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, cap);
    proc.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`${label} exceeded ${cap} ms cap`));
      else if (signal) reject(new Error(`${label} stopped by ${signal}`));
      else resolveChild(code ?? 1);
    });
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production' || !process.env.DATABASE_URL)
    throw new Error('Non-production DATABASE_URL is required');
  if (!process.env.NODE_PATH)
    throw new Error('Set NODE_PATH to the absolute learning-service directory');
  const timeout = deployedCourseTimeout();
  const name = `learning_it_${randomUUID().replaceAll('-', '')}`;
  const base = new URL(process.env.DATABASE_URL);
  if (decodeURIComponent(base.pathname).replace(/^\//, '') === 'course_db')
    throw new Error('Refusing DATABASE_URL targeting course_db');
  base.pathname = '/postgres';
  base.search = '';
  const admin = new Client({
    connectionString: base.toString(),
    statement_timeout: IO_TIMEOUT_MS,
    connectionTimeoutMillis: IO_TIMEOUT_MS,
  });
  let created = false;
  try {
    await deadline(admin.connect(), 'PostgreSQL admin connect');
    // Remember the attempt before awaiting it so timeout cleanup also covers a
    // CREATE that completes just as its deadline expires.
    created = true;
    await deadline(
      admin.query(`CREATE DATABASE "${name}"`),
      'Create isolated database',
    );
    const target = new URL(base);
    target.pathname = `/${name}`;
    target.searchParams.set('options', `-c statement_timeout=${IO_TIMEOUT_MS}`);
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: target.toString(),
      PGCONNECT_TIMEOUT: String(IO_TIMEOUT_MS / 1000),
      PGOPTIONS: `-c statement_timeout=${IO_TIMEOUT_MS}`,
      LEARNING_IT_DATABASE: name,
      COURSE_SERVICE_TIMEOUT_MS: timeout,
      INTERNAL_SERVICE_KEY: 'learning-it-synthetic-key',
      TENANT_CLIENT_MODE: 'fake',
      TENANT_FAKE_TIMEZONE: 'Asia/Ho_Chi_Minh',
      TS_NODE_PROJECT: 'tsconfig.seed.json',
    };
    // Same approach as achievement-reporting/test/postgres.cjs: apply the real
    // Prisma SQL in order to an empty target, without rewriting any migration.
    const migrationDb = new Client({
      connectionString: target.toString(),
      statement_timeout: IO_TIMEOUT_MS,
      connectionTimeoutMillis: IO_TIMEOUT_MS,
    });
    try {
      await deadline(migrationDb.connect(), 'Migration database connect');
      for (const directory of readdirSync('prisma/migrations', {
        withFileTypes: true,
      })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()) {
        await deadline(
          migrationDb.query(
            readFileSync(
              `prisma/migrations/${directory}/migration.sql`,
              'utf8',
            ),
          ),
          `Apply migration ${directory}`,
        );
      }
      await migrationDb.query(`INSERT INTO platform_settings
        (id, video_completion_percent, source_as_of, updated_at)
        VALUES ('0199a000-0000-7000-8000-1f0000000002',90,now(),now())`);
    } finally {
      await deadline(migrationDb.end(), 'Migration database end');
    }
    process.exitCode = await child(
      [
        '--test',
        '--experimental-test-isolation=none',
        `--test-timeout=${SUITE_TIMEOUT_MS}`,
        ...(process.env.LEARNING_IT_TEST_NAME
          ? [`--test-name-pattern=${process.env.LEARNING_IT_TEST_NAME}`]
          : []),
        '--require',
        'ts-node/register',
        'test/integration/bootstrap.mjs',
      ],
      env,
      SUITE_TIMEOUT_MS,
      'Integration suite',
    );
  } finally {
    try {
      if (created) {
        if (!/^learning_it_[a-f0-9]{32}$/.test(name))
          throw new Error('Unsafe cleanup target');
        await deadline(
          admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
          'Drop isolated database',
        );
        console.log(`Dropped isolated database ${name}`);
      }
    } finally {
      await deadline(admin.end(), 'PostgreSQL admin end');
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
