const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');
const {
  StorageProviderError,
  CloudinaryStorageProvider,
} = require('@learnup/ts-storage');
const {
  png,
  hash,
  file,
  user,
  body,
  setting,
} = require('./signer.helpers.cjs');
const { config, row, directory } = require('./fixtures.cjs');
const {
  validateSigner,
  signatureImage,
  expectedVersion,
} = require('../dist/src/modules/certificates/signer.validation');
const {
  signerConfig,
} = require('../dist/src/modules/certificates/signer.config');
const {
  SignerService,
  signerResponse,
} = require('../dist/src/modules/certificates/signer.service');
const {
  SignerAccess,
} = require('../dist/src/modules/certificates/signer.access');
const {
  StorageCleanupWorker,
} = require('../dist/src/modules/certificates/storage-cleanup.worker');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const {
  CloudinaryIssuanceStorage,
} = require('../dist/src/modules/certificates/issuance.storage');
const oldFetch = global.fetch;
afterEach(() => {
  global.fetch = oldFetch;
  mock.restoreAll();
});
const error = (status, code) => (e) =>
  e.getStatus() === status && e.getResponse().code === code;
const sc = () =>
  signerConfig(
    (k) =>
      ({ NODE_ENV: 'test', CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE: 'fake' })[k],
    config(),
  );
test('configuration defaults and guardrails', () => {
  assert.equal(sc().cleanupDelayMs, 600000);
  assert.equal(sc().cleanupEnabled, true);
  assert.equal(
    signerConfig(() => undefined, config({ enabled: false })).cleanupEnabled,
    false,
  );
  for (const env of [
    { CERTIFICATE_CLEANUP_DELAY_MS: '120100' },
    { CERTIFICATE_CLEANUP_LEASE_MS: '100' },
    { CERTIFICATE_CLEANUP_ENABLED: 'yes' },
    { CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE: 'fake', NODE_ENV: 'production' },
    { CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE: 'wrong' },
  ])
    assert.throws(() => signerConfig((k) => env[k], config()));
});
test('If-Match strong numeric tag, mandatory and bounded', () => {
  assert.equal(expectedVersion('"0"'), 0);
  assert.equal(expectedVersion('"42"'), 42);
  assert.throws(
    () => expectedVersion(undefined),
    error(428, 'PRECONDITION_REQUIRED'),
  );
  for (const v of ['0', 'W/"1"', '"01"', '"-1"', '"2147483647"', ['"1"']])
    assert.throws(() => expectedVersion(v), error(400, 'INVALID_IF_MATCH'));
});
test('NFC trim, Unicode code point lengths, boundaries and controls', () => {
  assert.equal(
    validateSigner({ ...body(), signerName: '  Nguyễn  ' }).signerName,
    'Nguyễn',
  );
  for (const [key, max] of [
    ['signerName', 100],
    ['signerTitle', 200],
  ]) {
    assert.equal(
      [...validateSigner({ ...body(), [key]: '😀'.repeat(max) })[key]].length,
      max,
    );
    for (const value of [
      '',
      '  ',
      'a'.repeat(max + 1),
      'a\n',
      'a\u0000',
      'a\u007f',
      '\ud800',
      12,
      [],
    ])
      assert.throws(
        () => validateSigner({ ...body(), [key]: value }),
        error(400, 'SIGNER_NAME_INVALID'),
      );
  }
});
test('multipart action/file/field consistency and repeated fields', () => {
  assert.equal(validateSigner(body('replace'), file()).image.mime, 'image/png');
  for (const [b, f] of [
    [body('replace'), undefined],
    [body('keep'), file()],
    [body('remove'), file()],
    [body('wrong'), undefined],
    [{ ...body(), organizationId: 'x' }, undefined],
    [{ ...body(), signerName: ['a', 'b'] }, undefined],
    [body('replace'), { ...file(), size: 0 }],
    [body('replace'), { ...file(), fieldname: 'file' }],
  ])
    assert.throws(() => validateSigner(b, f));
});
test('PNG IHDR dimensions, byte and pixel boundaries; header invalid', () => {
  const b = png();
  b.writeUInt32BE(4096, 16);
  b.writeUInt32BE(3906, 20);
  assert.equal(signatureImage(b).mime, 'image/png');
  b.writeUInt32BE(3907, 20);
  assert.throws(
    () => signatureImage(b),
    error(400, 'SIGNATURE_DIMENSIONS_TOO_LARGE'),
  );
  b.writeUInt32BE(4097, 16);
  assert.throws(
    () => signatureImage(b),
    error(400, 'SIGNATURE_DIMENSIONS_TOO_LARGE'),
  );
  for (const mutate of [
    (b) => b.writeUInt32BE(0, 16),
    (b) => b.writeUInt32BE(12, 8),
    (b) => (b[25] = 9),
    (b) => (b[28] = 2),
    (b) => (b[24] = 3),
  ]) {
    const x = png();
    mutate(x);
    assert.throws(
      () => signatureImage(x),
      error(400, 'SIGNATURE_IMAGE_INVALID'),
    );
  }
  assert.throws(
    () => signatureImage(png().subarray(0, 28)),
    error(400, 'SIGNATURE_IMAGE_INVALID'),
  );
  assert.throws(
    () => signatureImage(Buffer.alloc(2097153)),
    error(413, 'SIGNATURE_TOO_LARGE'),
  );
  assert.equal(
    signatureImage(Buffer.concat([png(), Buffer.alloc(2097152 - png().length)]))
      .mime,
    'image/png',
  );
});
test('JPEG SOF header scanning supports baseline/progressive; malformed bounded', () => {
  const jpeg = Buffer.from([
    255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 11, 8, 0, 10, 0, 20, 1, 1, 17,
    0, 255, 217,
  ]);
  assert.equal(signatureImage(jpeg).mime, 'image/jpeg');
  jpeg[9] = 194;
  assert.equal(signatureImage(jpeg).mime, 'image/jpeg');
  for (const bytes of [
    jpeg.subarray(0, 14),
    Buffer.from([255, 216, 255, 218]),
    Buffer.from([255, 216, 255, 224, 0, 0]),
    Buffer.from([255, 216, 255]),
  ])
    assert.throws(
      () => signatureImage(bytes),
      error(400, 'SIGNATURE_IMAGE_INVALID'),
    );
});
for (const bytes of [
  Buffer.from('GIF89a'),
  Buffer.from('<svg/>'),
  Buffer.from('RIFFxxxxWEBP'),
])
  test('unsupported magic bytes ' + bytes.toString(), () =>
    assert.throws(
      () => signatureImage(bytes),
      error(415, 'SIGNATURE_UNSUPPORTED_TYPE'),
    ),
  );
test('tenant HTTP uses service-call headers; Active/Grace allowed; readonly denied; dependency errors sanitized', async () => {
  const org = user().organizationId;
  const client = new SignerAccess(config(), { ...sc(), accessMode: 'http' });
  for (const status of ['Active', 'Grace', 'Suspended', 'Ended']) {
    global.fetch = async (url, opts) => {
      assert.ok(url.endsWith(`/internal/organizations/${org}/access`));
      assert.equal(opts.headers['x-organization-id'], org);
      assert.equal(opts.headers['x-user-id'], undefined);
      return Response.json({
        data: {
          organizationId: org,
          organizationStatus: 'Active',
          subscriptionStatus: status,
        },
      });
    };
    if (['Active', 'Grace'].includes(status)) await client.assertWritable(org);
    else
      await assert.rejects(
        client.assertWritable(org),
        error(403, 'ORGANIZATION_READ_ONLY'),
      );
  }
  global.fetch = async () =>
    Response.json({
      data: {
        organizationId: org,
        organizationStatus: 'Suspended',
        subscriptionStatus: 'Active',
      },
    });
  await assert.rejects(
    client.assertWritable(org),
    error(403, 'ORGANIZATION_READ_ONLY'),
  );
  for (const f of [
    async () => {
      throw new Error('secret');
    },
    async () => new Response('', { status: 503 }),
    async () => Response.json({ data: { organizationId: 'other' } }),
    async () => new Response('x'.repeat(65537)),
  ]) {
    global.fetch = f;
    await assert.rejects(
      client.assertWritable(org),
      error(503, 'TENANT_UNAVAILABLE'),
    );
  }
});
function serviceFixture() {
  const calls = [];
  const repo = {
    get: async () => null,
    put: async () => {
      calls.push('db');
      return setting();
    },
    enqueue: async () => calls.push('cleanup'),
  };
  const access = { assertWritable: async () => calls.push('tenant') };
  const storage = {
    upload: async (r, img, key) => {
      calls.push('upload');
      return {
        key,
        hash: hash(img.bytes),
        mime: img.mime,
        size: img.bytes.length,
      };
    },
  };
  return {
    calls,
    repo,
    access,
    storage,
    service: new SignerService(repo, access, sc(), config(), storage),
  };
}
test('service enforces role/UUID, GET never calls tenant, PUT validation before dependencies', async () => {
  const f = serviceFixture();
  for (const role of ['ADMIN', 'LEARNER', 'INSTRUCTOR'])
    await assert.rejects(
      f.service.get({ ...user(), role }),
      error(403, 'FORBIDDEN_ROLE'),
    );
  await assert.rejects(
    f.service.get({ ...user(), organizationId: 'bad' }),
    error(400, 'INVALID_USER_CONTEXT'),
  );
  assert.deepEqual(await f.service.get(user()), {
    configured: false,
    signerName: null,
    signerTitle: null,
    signature: null,
    version: 0,
    updatedAt: null,
  });
  assert.deepEqual(f.calls, []);
  await assert.rejects(
    f.service.put(user(), undefined, body()),
    error(428, 'PRECONDITION_REQUIRED'),
  );
  assert.deepEqual(f.calls, []);
  await f.service.put(user(), '"0"', body('replace'), file());
  assert.deepEqual(f.calls, ['tenant', 'upload', 'db']);
});
for (const status of [412, 500])
  test('upload followed by DB failure queues cleanup ' + status, async () => {
    const f = serviceFixture();
    const { HttpException } = require('@nestjs/common');
    f.repo.put = async () => {
      throw new HttpException(
        { code: status === 412 ? 'VERSION_CONFLICT' : 'DB_FAILED' },
        status,
      );
    };
    await assert.rejects(
      f.service.put(user(), '"0"', body('replace'), file()),
      (e) => e.getStatus() === status,
    );
    assert.deepEqual(f.calls, ['tenant', 'upload', 'cleanup']);
  });
test('storage upload failure queues known key and exposes 503; task failure logs only safe code', async () => {
  const f = serviceFixture();
  f.storage.upload = async () => {
    throw new Error('sensitive URL');
  };
  f.repo.enqueue = async () => {
    throw new Error('DB');
  };
  const logs = [];
  mock.method(Logger.prototype, 'warn', (x) => logs.push(x));
  await assert.rejects(
    f.service.put(user(), '"0"', body('replace'), file()),
    error(503, 'STORAGE_UNAVAILABLE'),
  );
  assert.equal(logs[0].code, 'CERTIFICATE_SIGNER_ORPHAN_CLEANUP_REQUIRED');
  assert.ok(!JSON.stringify(logs).includes('sensitive'));
});
test('preview no image 404; authenticated read/hash check and refresh on NOT_FOUND', async () => {
  const f = serviceFixture();
  await assert.rejects(
    f.service.signature(user()),
    error(404, 'SIGNATURE_NOT_FOUND'),
  );
  f.repo.get = async () => setting();
  let n = 0;
  f.storage.read = async () => {
    if (++n === 1) throw new StorageProviderError('absent', 'NOT_FOUND');
    return png();
  };
  assert.equal((await f.service.signature(user())).mime, 'image/png');
  assert.equal(n, 2);
  f.storage.read = async () => Buffer.from('wrong');
  await assert.rejects(
    f.service.signature(user()),
    error(503, 'STORAGE_UNAVAILABLE'),
  );
});
test('storage adapter read explicitly authenticated and safe timeout/size', async () => {
  const seen = [];
  mock.method(
    CloudinaryStorageProvider.prototype,
    'readBytes',
    async (k, o) => {
      seen.push([k, o]);
      return png();
    },
  );
  const storage = new CloudinaryIssuanceStorage(
    (k) =>
      ({
        CLOUDINARY_CLOUD_NAME: 'synthetic',
        CLOUDINARY_API_KEY: 'synthetic',
        CLOUDINARY_API_SECRET: 'synthetic',
      })[k],
  );
  await storage.read('key', 'image/jpeg', 500, 2097152);
  assert.equal(seen[0][1].deliveryType, 'authenticated');
  assert.equal(seen[0][1].format, 'jpg');
  assert.equal(seen[0][1].maxSizeBytes, 2097152);
});
test('cleanup referenced guard; success/missing completes; error retries with bounded backoff', async () => {
  const calls = [];
  let referenced = true,
    failed = false;
  const repo = {
    referenced: async () => referenced,
    done: async () => calls.push('done'),
    retry: async (t, s, c) => {
      assert.ok(s <= 300);
      calls.push(c);
    },
  };
  const worker = new StorageCleanupWorker(repo, sc(), {
    delete: async () => {
      calls.push('delete');
      if (failed) throw new Error();
    },
  });
  const task = { asset_key: 'key', attempts: 0 };
  await worker.process(task);
  assert.deepEqual(calls, ['ASSET_REFERENCED']);
  referenced = false;
  await worker.process(task);
  assert.deepEqual(calls.slice(-2), ['delete', 'done']);
  failed = true;
  await worker.process(task);
  assert.equal(calls.at(-1), 'STORAGE_UNAVAILABLE');
});
function issuanceFixture() {
  const issued = [],
    deleted = [],
    queued = [],
    retries = [];
  const repo = {
    issue: async (r, s) => {
      issued.push(s);
      return true;
    },
    retry: async (r, c) => retries.push(c),
    retryVersionChange: async () => retries.push('version'),
    assetIsReferenced: async () => false,
  };
  const signers = {
    get: async () => setting(),
    enqueue: async (k) => queued.push(k),
  };
  const storage = {
    read: async () => png(),
    upload: async (r, i, key) => ({
      key,
      hash: hash(i.bytes),
      mime: i.mime,
      size: i.bytes.length,
    }),
    delete: async (k) => deleted.push(k),
  };
  const worker = new IssuanceWorker(
    repo,
    config(),
    directory(),
    storage,
    signers,
  );
  return { issued, deleted, queued, retries, repo, signers, storage, worker };
}
test('issuance copies signer bytes into per-attempt key and preserves version/name', async () => {
  const f = issuanceFixture();
  const r = row();
  await f.worker.process(r);
  assert.equal(f.issued[0].signer.version, 1);
  assert.equal(f.issued[0].signer.name, 'A');
  assert.ok(
    f.issued[0].signer.asset.key.startsWith(
      `achievement/${r.organization_id}/certificates/${r.id}/signature/`,
    ),
  );
  assert.deepEqual(f.deleted, []);
});
test('issuance no configuration produces null snapshot', async () => {
  const f = issuanceFixture();
  f.signers.get = async () => null;
  await f.worker.process(row());
  assert.deepEqual(f.issued[0].signer, {
    version: 0,
    name: null,
    title: null,
    asset: null,
  });
});
test('issuance hash mismatch stays Pending; NOT_FOUND reloads once; other failures retry', async () => {
  mock.method(Logger.prototype, 'warn', () => {});
  const f = issuanceFixture();
  f.storage.read = async () => Buffer.from('wrong');
  await f.worker.process(row());
  assert.deepEqual(f.retries, ['SIGNATURE_HASH_MISMATCH']);
  assert.equal(f.issued.length, 0);
  let calls = 0;
  f.storage.read = async () => {
    if (++calls === 1) throw new StorageProviderError('missing', 'NOT_FOUND');
    return png();
  };
  await f.worker.process(row());
  assert.equal(calls, 2);
  assert.equal(f.issued.length, 1);
  f.storage.read = async () => {
    throw new StorageProviderError('timeout', 'TIMEOUT');
  };
  await f.worker.process(row());
  assert.equal(f.retries.length, 2);
});
test('version change retries early without infrastructure counter and queues/deletes attempt asset', async () => {
  const f = issuanceFixture();
  f.repo.issue = async () => 'version_changed';
  await f.worker.process(row());
  assert.deepEqual(f.retries, ['version']);
  assert.equal(f.queued.length, 1);
  assert.deepEqual(f.deleted, f.queued);
});

test('tenant denial and outage stop PUT before storage or DB', async () => {
  const { HttpException } = require('@nestjs/common');
  for (const [status, code] of [
    [403, 'ORGANIZATION_READ_ONLY'],
    [503, 'TENANT_UNAVAILABLE'],
  ]) {
    const f = serviceFixture();
    f.access.assertWritable = async () => {
      throw new HttpException({ code }, status);
    };
    await assert.rejects(
      f.service.put(user(), '"0"', body('replace'), file()),
      error(status, code),
    );
    assert.deepEqual(f.calls, []);
  }
});
test('cleanup worker poll warning and storage failure remains recoverable', async () => {
  const logs = [];
  mock.method(Logger.prototype, 'warn', (v) => logs.push(v));
  let claimed = 0;
  const repo = {
    claim: async () => {
      claimed++;
      return [];
    },
    backlog: async () => ({ count: 2, oldest: 5000 }),
  };
  const worker = new StorageCleanupWorker(
    repo,
    { ...sc(), cleanupPollMs: 60000 },
    { delete: async () => {} },
  );
  await worker.tick();
  assert.equal(logs[0].code, 'CERTIFICATE_CLEANUP_BACKLOG');
  const disabled = new StorageCleanupWorker(
    repo,
    { ...sc(), cleanupEnabled: false },
    {},
  );
  disabled.onModuleInit();
  disabled.kick();
  assert.equal(claimed, 1);
  await disabled.onModuleDestroy();
});
test('NOT_FOUND refresh to removed image snapshots signer text without image; repeated NOT_FOUND never issues', async () => {
  mock.method(Logger.prototype, 'warn', () => {});
  const f = issuanceFixture();
  let reads = 0;
  f.signers.get = async () =>
    ++reads === 1
      ? setting()
      : setting({
          version: 2,
          signature_asset_key: null,
          signature_hash: null,
          signature_mime: null,
          signature_size_bytes: null,
        });
  f.storage.read = async () => {
    throw new StorageProviderError('absent', 'NOT_FOUND');
  };
  await f.worker.process(row());
  assert.equal(reads, 2);
  assert.equal(f.issued[0].signer.version, 2);
  assert.equal(f.issued[0].signer.asset, null);
  const repeated = issuanceFixture();
  let n = 0;
  repeated.storage.read = async () => {
    n++;
    throw new StorageProviderError('absent', 'NOT_FOUND');
  };
  await repeated.worker.process(row());
  assert.equal(n, 2);
  assert.equal(repeated.issued.length, 0);
  assert.equal(repeated.retries.length, 1);
});
