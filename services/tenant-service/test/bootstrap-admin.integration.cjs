const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { test } = require('node:test');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Database integration tests must not run in production.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

process.env.NODE_PATH = path.resolve(__dirname, '../dist');
require('node:module').Module._initPaths();

const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'dist/src/bootstrap/bootstrap-admin.js');
const INTERNAL_KEY = `bootstrap-test-${randomBytes(16).toString('hex')}`;
const PASSWORD = `Bootstrap-${randomBytes(6).toString('hex')}`;

const urlFor = (database) => {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
};
const connect = (url) => new PrismaService({ getOrThrow: () => url });

const fakeIdentity = async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      requests.push({
        method: req.method,
        url: req.url,
        key: req.headers['x-internal-key'],
        body: JSON.parse(body),
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"success":true}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { requests, server, url: `http://127.0.0.1:${server.address().port}` };
};

const runCommand = (env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ...env,
      },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (status) => resolve({ status, output }));
  });

test('Admin bootstrap on an empty, freshly migrated database', async (t) => {
  const database = `tenant_bootstrap_${randomBytes(4).toString('hex')}`;
  const maintenance = connect(process.env.DATABASE_URL);
  await maintenance.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
  const url = urlFor(database);
  const identity = await fakeIdentity();
  let prisma;
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    prisma = connect(url);
    const env = {
      DATABASE_URL: url,
      IDENTITY_SERVICE_URL: identity.url,
      INTERNAL_SERVICE_KEY: INTERNAL_KEY,
      ADMIN_EMAIL: ' Root@Empty.Test ',
      ADMIN_PASSWORD: PASSWORD,
    };

    await t.test(
      'first run: settings and one Admin only, password sent to identity',
      async () => {
        const run = await runCommand(env);
        assert.equal(run.status, 0, run.output);
        assert.match(run.output, /Created Admin root@empty\.test/);
        assert.match(run.output, /Created the default platform settings/);
        assert.ok(!run.output.includes(PASSWORD));

        assert.equal(await prisma.platformSetting.count(), 1);
        assert.equal(await prisma.subscriptionPlan.count(), 0);
        assert.equal(await prisma.organization.count(), 0);
        const users = await prisma.user.findMany();
        assert.equal(users.length, 1);
        const [admin] = users;
        assert.equal(admin.email, 'root@empty.test');
        assert.equal(admin.role, 'Admin');
        assert.equal(admin.status, 'Active');
        assert.equal(admin.organizationId, null);
        assert.ok(admin.activatedAt);

        assert.equal(identity.requests.length, 1);
        const [request] = identity.requests;
        assert.equal(request.method, 'POST');
        assert.equal(request.url, '/api/internal/credentials');
        assert.equal(request.key, INTERNAL_KEY);
        assert.deepEqual(request.body, {
          userId: admin.id,
          password: PASSWORD,
          email: 'root@empty.test',
          fullName: 'Quản trị viên LearnUP',
          role: 'ADMIN',
          organizationId: null,
        });
      },
    );

    await t.test(
      'second run: the same Admin, nothing new, password set again',
      async () => {
        const run = await runCommand(env);
        assert.equal(run.status, 0, run.output);
        assert.match(run.output, /Kept Admin root@empty\.test/);
        assert.match(run.output, /Platform settings already existed/);
        assert.equal(await prisma.platformSetting.count(), 1);
        assert.equal(await prisma.user.count(), 1);
        assert.equal(identity.requests.length, 2);
        assert.equal(
          identity.requests[1].body.userId,
          identity.requests[0].body.userId,
        );
      },
    );

    await t.test(
      'a second Admin email is refused without the flag, nothing written',
      async () => {
        const run = await runCommand({
          ...env,
          ADMIN_EMAIL: 'other@empty.test',
        });
        assert.equal(run.status, 1);
        assert.match(run.output, /An Admin account already exists/);
        assert.equal(await prisma.user.count(), 1);
        assert.equal(identity.requests.length, 2);
      },
    );

    await t.test(
      'two runs at the same time with a new email create one Admin',
      async () => {
        const raced = {
          ...env,
          ADMIN_EMAIL: 'race@empty.test',
          ADMIN_ALLOW_ADDITIONAL: 'true',
        };
        const runs = await Promise.all([runCommand(raced), runCommand(raced)]);
        for (const run of runs) assert.equal(run.status, 0, run.output);
        assert.equal(
          await prisma.user.count({ where: { email: 'race@empty.test' } }),
          1,
        );
        assert.equal(
          runs.filter((run) => /Created Admin/.test(run.output)).length,
          1,
        );
      },
    );
  } finally {
    identity.server.close();
    if (prisma) await prisma.$disconnect();
    await maintenance.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
    );
    await maintenance.$disconnect();
  }
});
