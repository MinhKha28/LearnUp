const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const {
  ConflictException,
  ServiceUnavailableException,
} = require('@nestjs/common');
const {
  bootstrapAdmin,
  readBootstrapAdminInput,
  runBootstrapAdmin,
  BootstrapAdminError,
  BOOTSTRAP_ADMIN_LOCK_NAMESPACE,
  DEFAULT_ADMIN_FULL_NAME,
} = require('../dist/src/bootstrap/bootstrap-admin');

const PASSWORD = 'Bootstrap-Unit-Pass-42';
const input = (overrides = {}) => ({
  email: 'admin@empty.test',
  fullName: 'Quản trị viên',
  password: PASSWORD,
  allowAdditionalAdmin: false,
  ...overrides,
});

const fakeDb = ({ settings = 0, users = [] } = {}) => {
  const state = { settings, users: [...users], log: [] };
  const tx = {
    $queryRaw: async (strings, ...values) => {
      state.log.push(['lock', strings.join('?'), values]);
      return [{ locked: 1 }];
    },
    platformSetting: {
      count: async () => state.settings,
      create: async () => {
        state.log.push(['createSettings']);
        state.settings += 1;
      },
    },
    user: {
      findFirst: async ({ where }) => {
        state.log.push(['findFirst', where]);
        return (
          state.users.find(
            (u) =>
              u.deletedAt === null &&
              (where.email === undefined || u.email === where.email) &&
              (where.role === undefined || u.role === where.role),
          ) ?? null
        );
      },
      create: async ({ data }) => {
        state.log.push(['createUser', data]);
        state.users.push({ deletedAt: null, ...data });
        return data;
      },
    },
  };
  const prisma = { $transaction: async (fn) => fn(tx) };
  return { prisma, state };
};

const fakeIdentity = (behaviour) => {
  const calls = [];
  return {
    calls,
    setCredentials: async (params) => {
      calls.push(params);
      if (behaviour) throw behaviour;
    },
  };
};

const user = (overrides) => ({
  id: '01900000-0000-7000-8000-0000000000aa',
  email: 'admin@empty.test',
  role: 'Admin',
  status: 'Active',
  organizationId: null,
  deletedAt: null,
  ...overrides,
});

test('empty stack: default platform settings, one Admin, and the password set in identity', async () => {
  const { prisma, state } = fakeDb();
  const identity = fakeIdentity();
  const now = new Date('2026-11-10T01:00:00Z');

  const result = await bootstrapAdmin(prisma, identity, input(), () => now);

  assert.equal(state.log[0][0], 'lock');
  assert.deepEqual(state.log[0][2], [BOOTSTRAP_ADMIN_LOCK_NAMESPACE]);
  assert.equal(state.settings, 1);
  const created = state.log.find(([step]) => step === 'createUser')[1];
  assert.deepEqual(
    { ...created, id: undefined },
    {
      id: undefined,
      organizationId: null,
      email: 'admin@empty.test',
      fullName: 'Quản trị viên',
      role: 'Admin',
      status: 'Active',
      activatedAt: now,
    },
  );
  assert.deepEqual(identity.calls, [
    {
      userId: created.id,
      password: PASSWORD,
      email: 'admin@empty.test',
      fullName: 'Quản trị viên',
      role: 'Admin',
      organizationId: null,
    },
  ]);
  assert.deepEqual(result, {
    adminId: created.id,
    email: 'admin@empty.test',
    adminCreated: true,
    platformSettingsCreated: true,
  });
  assert.ok(!JSON.stringify(result).includes(PASSWORD));
});

test('running again with the same email keeps the Admin and only sets the password again', async () => {
  const existing = user();
  const { prisma, state } = fakeDb({ settings: 1, users: [existing] });
  const identity = fakeIdentity();

  const result = await bootstrapAdmin(prisma, identity, input());

  assert.equal(result.adminCreated, false);
  assert.equal(result.platformSettingsCreated, false);
  assert.equal(result.adminId, existing.id);
  assert.ok(
    !state.log.some(
      ([step]) => step === 'createUser' || step === 'createSettings',
    ),
  );
  assert.equal(identity.calls.length, 1);
  assert.equal(identity.calls[0].userId, existing.id);
});

test('the email of a non-Admin account is refused and identity is not called', async () => {
  const { prisma, state } = fakeDb({
    settings: 1,
    users: [
      user({
        role: 'Organizer',
        organizationId: '01900000-0000-7000-8000-00000000a001',
      }),
    ],
  });
  const identity = fakeIdentity();

  await assert.rejects(bootstrapAdmin(prisma, identity, input()), (error) => {
    assert.ok(error instanceof BootstrapAdminError);
    assert.match(error.message, /non-Admin account/);
    return true;
  });
  assert.equal(identity.calls.length, 0);
  assert.ok(!state.log.some(([step]) => step === 'createUser'));
});

test('a deactivated Admin with this email is not changed', async () => {
  const { prisma } = fakeDb({
    settings: 1,
    users: [user({ status: 'Deactivated' })],
  });
  const identity = fakeIdentity();

  await assert.rejects(bootstrapAdmin(prisma, identity, input()), /not Active/);
  assert.equal(identity.calls.length, 0);
});

test('another Admin already exists: refused unless ADMIN_ALLOW_ADDITIONAL is set', async () => {
  const other = user({ email: 'first@empty.test' });

  const refused = fakeDb({ settings: 1, users: [other] });
  const identity = fakeIdentity();
  await assert.rejects(
    bootstrapAdmin(refused.prisma, identity, input()),
    /ADMIN_ALLOW_ADDITIONAL=true/,
  );
  assert.equal(identity.calls.length, 0);

  const allowed = fakeDb({ settings: 1, users: [other] });
  const result = await bootstrapAdmin(
    allowed.prisma,
    fakeIdentity(),
    input({ allowAdditionalAdmin: true }),
  );
  assert.equal(result.adminCreated, true);
  assert.equal(allowed.state.users.filter((u) => u.role === 'Admin').length, 2);
});

test('a deleted account with the same email does not block a new Admin', async () => {
  const { prisma } = fakeDb({
    settings: 1,
    users: [user({ role: 'Learner', deletedAt: new Date() })],
  });
  const result = await bootstrapAdmin(prisma, fakeIdentity(), input());
  assert.equal(result.adminCreated, true);
});

for (const [label, failure, pattern] of [
  [
    'identity 409',
    new ConflictException({ code: 'IDENTITY_CREDENTIAL_CONFLICT' }),
    /409/,
  ],
  [
    'identity unavailable',
    new ServiceUnavailableException({ code: 'IDENTITY_UNAVAILABLE' }),
    /run the command again/,
  ],
]) {
  test(`${label}: a clear error that keeps the tenant row and never shows the password`, async () => {
    const { prisma, state } = fakeDb();
    await assert.rejects(
      bootstrapAdmin(prisma, fakeIdentity(failure), input()),
      (error) => {
        assert.ok(error instanceof BootstrapAdminError);
        assert.match(error.message, pattern);
        assert.match(error.message, /Admin row is kept/);
        assert.ok(!error.message.includes(PASSWORD));
        return true;
      },
    );
    assert.equal(state.users.length, 1);
  });
}

test('input: email normalized, default name, flag read only when exactly "true"', () => {
  const parsed = readBootstrapAdminInput({
    ADMIN_EMAIL: '  Admin@Empty.TEST ',
    ADMIN_PASSWORD: PASSWORD,
    ADMIN_ALLOW_ADDITIONAL: 'yes',
  });
  assert.deepEqual(parsed, {
    email: 'admin@empty.test',
    fullName: DEFAULT_ADMIN_FULL_NAME,
    password: PASSWORD,
    allowAdditionalAdmin: false,
  });
  assert.equal(
    readBootstrapAdminInput({
      ADMIN_EMAIL: 'a@b.vn',
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_FULL_NAME: '  Lê   Văn  An ',
      ADMIN_ALLOW_ADDITIONAL: 'true',
    }).fullName,
    'Lê Văn An',
  );
});

for (const [label, env, pattern] of [
  ['missing email', { ADMIN_PASSWORD: PASSWORD }, /ADMIN_EMAIL/],
  [
    'invalid email',
    { ADMIN_EMAIL: 'admin', ADMIN_PASSWORD: PASSWORD },
    /ADMIN_EMAIL/,
  ],
  ['missing password', { ADMIN_EMAIL: 'a@b.vn' }, /ADMIN_PASSWORD/],
  [
    'short password',
    { ADMIN_EMAIL: 'a@b.vn', ADMIN_PASSWORD: 'Short-pass1' },
    /12 to 128/,
  ],
  [
    'password with outer spaces',
    { ADMIN_EMAIL: 'a@b.vn', ADMIN_PASSWORD: ` ${PASSWORD} ` },
    /spaces/,
  ],
  [
    'name too long',
    {
      ADMIN_EMAIL: 'a@b.vn',
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_FULL_NAME: 'x'.repeat(101),
    },
    /ADMIN_FULL_NAME/,
  ],
]) {
  test(`input refused: ${label}`, () => {
    assert.throws(
      () => readBootstrapAdminInput(env),
      (error) => {
        assert.ok(error instanceof BootstrapAdminError);
        assert.match(error.message, pattern);
        assert.ok(!error.message.includes(PASSWORD));
        return true;
      },
    );
  });
}

for (const key of [
  'DATABASE_URL',
  'IDENTITY_SERVICE_URL',
  'INTERNAL_SERVICE_KEY',
]) {
  test(`run refuses without ${key} (no stub mode, no database call)`, async () => {
    const env = {
      DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/none',
      IDENTITY_SERVICE_URL: 'http://127.0.0.1:1',
      INTERNAL_SERVICE_KEY: 'k'.repeat(40),
      ADMIN_EMAIL: 'a@b.vn',
      ADMIN_PASSWORD: PASSWORD,
    };
    delete env[key];
    await assert.rejects(
      runBootstrapAdmin(env),
      new RegExp(`${key} is required`),
    );
  });
}

test('the command exits 1 with the reason and never prints the password', () => {
  const script = path.resolve(
    __dirname,
    '../dist/src/bootstrap/bootstrap-admin.js',
  );
  const run = spawnSync(process.execPath, [script], {
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      NODE_PATH: path.resolve(__dirname, '../dist'),
      DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/none',
      INTERNAL_SERVICE_KEY: 'k'.repeat(40),
      ADMIN_EMAIL: 'a@b.vn',
      ADMIN_PASSWORD: PASSWORD,
    },
    encoding: 'utf8',
  });
  assert.equal(run.status, 1);
  assert.match(
    run.stderr,
    /Admin bootstrap failed: IDENTITY_SERVICE_URL is required\./,
  );
  assert.ok(!`${run.stdout}${run.stderr}`.includes(PASSWORD));
});
