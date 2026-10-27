const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');
const { CloudinaryStorageProvider } = require('@learnup/ts-storage');
const { event, delivery, config, row, directory } = require('./fixtures.cjs');
const {
  decodeCompletion,
  fingerprint,
} = require('../dist/src/modules/certificates/completion-event');
const {
  issuanceConfig,
  retrySeconds,
  IssuanceError,
} = require('../dist/src/modules/certificates/issuance.config');
const {
  certificateCode,
  normalizeCertificateCode,
} = require('../dist/src/modules/certificates/certificate-code');
const {
  HttpIssuanceDirectory,
  downloadLogo,
  detectLogoMime,
} = require('../dist/src/modules/certificates/issuance.clients');
const {
  CloudinaryIssuanceStorage,
} = require('../dist/src/modules/certificates/issuance.storage');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const {
  CompletionConsumer,
} = require('../dist/src/modules/certificates/completion.consumer');
const oldFetch = global.fetch;
afterEach(() => {
  global.fetch = oldFetch;
  mock.restoreAll();
});
test('valid completion preserves versioned snapshot and canonical fingerprint ignores object key order', () => {
  const e = event();
  assert.deepEqual(decodeCompletion(delivery(e)).event.data, e.data);
  assert.equal(fingerprint({ b: 1, a: 2 }), fingerprint({ a: 2, b: 1 }));
});
for (const [name, mutate] of [
  ['array snapshot', (e) => (e.data.scoreSnapshot = [])],
  ['wrong schemaVersion', (e) => (e.data.scoreSnapshot.schemaVersion = 2)],
  ['wrong organization', (e) => (e.data.organizationId = e.data.learnerId)],
  ['wrong envelope version', (e) => (e.version = 2)],
  [
    'wrong snapshot identity',
    (e) => (e.data.scoreSnapshot.learnerId = e.data.courseId),
  ],
  ['invalid date', (e) => (e.data.completedAt = 'bad')],
  ['ineligible snapshot', (e) => (e.data.scoreSnapshot.eligible = false)],
  [
    'wrong score type',
    (e) => (e.data.scoreSnapshot.quizzes[0].recordedScore = 90),
  ],
  [
    'inconsistent passing score',
    (e) => (e.data.scoreSnapshot.quizzes[0].passed = false),
  ],
  ['missing completedLate', (e) => delete e.data.completedLate],
  ['bad UUID', (e) => (e.data.enrollmentId = 'bad')],
  ['mismatched event time', (e) => (e.occurredAt = new Date(0).toISOString())],
  [
    'zero components',
    (e) => {
      e.data.scoreSnapshot.requiredComponentCount = 0;
      e.data.scoreSnapshot.quizzes = [];
    },
  ],
])
  test(`quarantines ${name}`, () => {
    const e = event();
    mutate(e);
    assert.ok(decodeCompletion(delivery(e)).reason);
  });
test('malformed JSON is retained as base64 in quarantine; null/unpaired Unicode cannot block PostgreSQL', () => {
  for (const value of [
    Buffer.from('{bad'),
    Buffer.from([0x22, 0xff, 0x22]),
    Buffer.from('"\\u0000"'),
    Buffer.from('"\\ud800"'),
  ]) {
    const d = decodeCompletion({ ...delivery(null), value });
    assert.ok(d.reason);
    assert.equal(Buffer.from(d.payload.rawBase64, 'base64').compare(value), 0);
  }
});
test('valid unrelated event is ignored; wrong enrollment key is quarantined', () => {
  const e = event();
  e.eventType = 'EnrollmentAssigned';
  assert.equal(decodeCompletion(delivery(e)).ignored, true);
  e.eventType = 'EnrollmentCompleted';
  assert.ok(
    decodeCompletion({ ...delivery(e), key: Buffer.from('wrong') }).reason,
  );
});
test('Optional requires no deadline and no late flag', () => {
  const e = event({
    enrollmentType: 'Optional',
    dueAt: null,
    completedLate: false,
  });
  assert.ok(decodeCompletion(delivery(e)).event);
  e.data.completedLate = true;
  assert.ok(decodeCompletion(delivery(e)).reason);
});
test('consumer is disabled by default and retry delay is capped/jittered', () => {
  const c = issuanceConfig(() => undefined);
  assert.equal(c.tenantUrl, 'http://tenant-service:8084');
  assert.equal(c.enabled, false);
  assert.equal(c.concurrency, 4);
  assert.deepEqual(
    [1, 2, 3, 4, 100].map((n) => retrySeconds(n, () => 0.5)),
    [60, 120, 240, 300, 300],
  );
  assert.equal(
    retrySeconds(1, () => 0),
    54,
  );
  assert.equal(
    retrySeconds(4, () => 1),
    300,
  );
});
for (const key of [
  'CERTIFICATE_PROFILE_CLIENT_MODE',
  'CERTIFICATE_COURSE_CLIENT_MODE',
])
  test(`fake ${key} forbidden in production`, () =>
    assert.throws(
      () =>
        issuanceConfig((k) => ({ NODE_ENV: 'production', [key]: 'fake' })[k]),
      /forbidden/,
    ));
test('invalid configuration is explicit and codes are random Crockford with bounded input normalization', () => {
  assert.throws(() =>
    issuanceConfig((k) => (k === 'CERTIFICATE_CONCURRENCY' ? '0' : undefined)),
  );
  const codes = Array.from({ length: 1000 }, certificateCode);
  assert.equal(new Set(codes).size, 1000);
  codes.forEach((c) => assert.match(c, /^[0-9A-HJKMNP-TV-Z]{12}$/));
  assert.equal(normalizeCertificateCode('O1IL-2345-6789'), '011123456789');
  assert.throws(() => normalizeCertificateCode('U'.repeat(12)));
  assert.throws(() => normalizeCertificateCode('0'.repeat(15)));
});
test('fake clients require explicit development/test environment even when NODE_ENV is missing', () => {
  assert.throws(
    () =>
      issuanceConfig((key) =>
        key === 'CERTIFICATE_PROFILE_CLIENT_MODE' ? 'fake' : undefined,
      ),
    /forbidden/,
  );
  for (const environment of ['test', 'development']) {
    assert.equal(
      issuanceConfig(
        (key) =>
          ({ NODE_ENV: environment, CERTIFICATE_PROFILE_CLIENT_MODE: 'fake' })[
            key
          ],
      ).profileMode,
      'fake',
    );
  }
});
test('lookup sends matching header/body organization and no user headers; deleted learner name remains available', async () => {
  const r = row();
  global.fetch = async (_url, opts) => {
    assert.equal(opts.headers['x-organization-id'], r.organization_id);
    assert.equal(JSON.parse(opts.body).organizationId, r.organization_id);
    assert.equal(opts.headers['x-user-role'], undefined);
    assert.equal(opts.headers['x-user-id'], undefined);
    return Response.json({
      data: {
        items: [
          {
            userId: r.learner_id,
            fullName: '  Nguyễn Văn Kiểm  ',
            deletedAt: new Date().toISOString(),
          },
        ],
      },
    });
  };
  assert.equal(
    await new HttpIssuanceDirectory(config()).learnerName(
      r.organization_id,
      r.learner_id,
    ),
    'Nguyễn Văn Kiểm',
  );
});
test('fake profile/course are opt-in and HTTP failure never falls back', async () => {
  global.fetch = async () => new Response('', { status: 503 });
  const r = row();
  const client = new HttpIssuanceDirectory(config());
  await assert.rejects(
    client.profile(r.organization_id),
    (e) => e.code === 'DIRECTORY_UNAVAILABLE',
  );
  const fake = new HttpIssuanceDirectory(
    config({ profileMode: 'fake', courseMode: 'fake' }),
  );
  assert.equal((await fake.profile(r.organization_id)).logo, null);
  assert.equal(
    (await fake.course(r.organization_id, r.course_id)).versionNumber,
    1,
  );
});
for (const [status, code] of [
  [404, 'DIRECTORY_NOT_FOUND'],
  [401, 'DIRECTORY_AUTH_CONFIGURATION'],
  [503, 'DIRECTORY_UNAVAILABLE'],
])
  test(`profile HTTP ${status} is retryable safe error`, async () => {
    global.fetch = async () => new Response('sensitive URL', { status });
    await assert.rejects(
      new HttpIssuanceDirectory(config()).profile(row().organization_id),
      (e) => e.code === code && !String(e).includes('sensitive'),
    );
  });
test('profile response must match the requested organization', async () => {
  global.fetch = async () =>
    Response.json({
      data: {
        organizationId: row().organization_id,
        name: 'wrong',
        logo: null,
      },
    });
  await assert.rejects(
    new HttpIssuanceDirectory(config()).profile(row().organization_id),
    /INVALID_DIRECTORY_RESPONSE/,
  );
});
for (const url of [
  'http://res.cloudinary.com/logo',
  'https://evil.invalid/logo',
  'https://res.cloudinary.com.evil.invalid/logo',
  'https://user:pass@res.cloudinary.com/logo',
  'https://res.cloudinary.com:444/logo',
])
  test(`logo URL rejected: ${url.replace(/user:pass@/, '')}`, async () => {
    let called = false;
    global.fetch = async () => {
      called = true;
    };
    await assert.rejects(
      downloadLogo(url, config()),
      (e) => e.code === 'LOGO_HOST_REJECTED',
    );
    assert.equal(called, false);
  });
test('logo magic bytes override declared MIME; redirects forbidden and streamed size capped', async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  global.fetch = async (_url, opts) => {
    assert.equal(opts.redirect, 'error');
    return new Response(png, { headers: { 'content-type': 'text/html' } });
  };
  assert.equal(
    (await downloadLogo('https://res.cloudinary.com/logo', config())).mime,
    'image/png',
  );
  global.fetch = async () => new Response(Buffer.alloc(2048));
  await assert.rejects(
    downloadLogo('https://res.cloudinary.com/logo', config()),
    /HTTP_BODY_TOO_LARGE/,
  );
  assert.equal(detectLogoMime(Buffer.from([255, 216, 255])), 'image/jpeg');
  assert.equal(detectLogoMime(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.throws(() => detectLogoMime(Buffer.from('<svg>')));
});
test('logo 404 is distinct; timeouts/network errors are sanitized', async () => {
  global.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(
    downloadLogo('https://res.cloudinary.com/logo', config()),
    /LOGO_NOT_FOUND/,
  );
  global.fetch = async () => {
    throw new Error('signed-secret-URL');
  };
  await assert.rejects(
    downloadLogo('https://res.cloudinary.com/logo', config()),
    (e) => e.code === 'LOGO_UNAVAILABLE' && e.cause === undefined,
  );
});
test('missing Cloudinary configuration does not prevent construction and fails only on upload', async () => {
  const storage = new CloudinaryIssuanceStorage(() => undefined);
  await assert.rejects(
    storage.upload(
      row(),
      { bytes: Buffer.from('fixture'), mime: 'image/png' },
      'fixture-key',
    ),
    /CLOUDINARY_UNCONFIGURED/,
  );
});

const configuredStorage = () =>
  new CloudinaryIssuanceStorage(
    (name) =>
      ({
        CLOUDINARY_CLOUD_NAME: 'fixture-cloud',
        CLOUDINARY_API_KEY: 'fixture-key',
        CLOUDINARY_API_SECRET: 'fixture-secret',
      })[name],
  );

for (const status of ['deleted', 'not_found']) {
  test(`authenticated cleanup accepts ${status} through adapter and worker`, async () => {
    const calls = [];
    mock.method(
      CloudinaryStorageProvider.prototype,
      'delete',
      async (key, options) => {
        calls.push({ key, options });
        return { status };
      },
    );
    mock.method(
      CloudinaryStorageProvider.prototype,
      'upload',
      async (_file, options) => ({
        storageKey: `${options.folder}/${options.publicId}`,
        deliveryType: 'authenticated',
      }),
    );
    const storage = configuredStorage();
    assert.equal(await storage.delete('fixture/key'), undefined);
    assert.deepEqual(calls.shift(), {
      key: 'fixture/key',
      options: { resourceType: 'image', deliveryType: 'authenticated' },
    });
    const f = workerFixture({ issue: async () => false });
    f.worker.storage = storage;
    f.worker.directory.profile = async (org) => ({
      organizationId: org,
      name: 'Fixture',
      logo: { url: 'https://res.cloudinary.com/logo' },
    });
    global.fetch = async () =>
      new Response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const pending = row();
    await f.worker.process(pending);
    assert.equal(calls.length, 1);
    assert.ok(
      calls[0].key.startsWith(
        `achievement/${pending.organization_id}/certificates/${pending.id}/logo/`,
      ),
    );
    assert.deepEqual(calls[0].options, {
      resourceType: 'image',
      deliveryType: 'authenticated',
    });
    assert.equal(f.warnings.length, 0);
  });

  test(`key mismatch cleanup accepts ${status} before reporting the original mismatch`, async () => {
    const calls = [];
    mock.method(CloudinaryStorageProvider.prototype, 'upload', async () => ({
      storageKey: 'fixture/returned-key',
    }));
    mock.method(
      CloudinaryStorageProvider.prototype,
      'delete',
      async (key, options) => {
        calls.push({ key, options });
        return { status };
      },
    );
    await assert.rejects(
      configuredStorage().upload(
        row(),
        { bytes: Buffer.from('fixture'), mime: 'image/png' },
        'fixture/expected-key',
      ),
      /CLOUDINARY_KEY_MISMATCH/,
    );
    assert.deepEqual(calls, [
      {
        key: 'fixture/returned-key',
        options: { resourceType: 'image', deliveryType: 'authenticated' },
      },
    ]);
  });
}

test('authenticated cleanup provider failures remain failures without leaking causes', async () => {
  mock.method(CloudinaryStorageProvider.prototype, 'delete', async () => {
    throw new Error('https://fixture?signature=secret');
  });
  await assert.rejects(
    configuredStorage().delete('fixture/key'),
    (error) =>
      error instanceof IssuanceError &&
      error.code === 'CLOUDINARY_CLEANUP_FAILED' &&
      error.cause === undefined &&
      !String(error).includes('signature'),
  );
});
function workerFixture(overrides = {}) {
  const issued = [],
    deleted = [],
    warnings = [];
  const repository = {
    issue: async (_r, s) => {
      issued.push(s);
      return true;
    },
    retry: async () => {},
    assetIsReferenced: async () => false,
    ...overrides,
  };
  mock.method(Logger.prototype, 'warn', (v) => warnings.push(v));
  const worker = new IssuanceWorker(
    repository,
    config(),
    directory(),
    {
      upload: async (_r, image, key) => ({
        key,
        hash: '0'.repeat(64),
        mime: image.mime,
        size: image.bytes.length,
      }),
      delete: async (key) => deleted.push(key),
    },
    { get: async () => null, enqueue: async () => {} },
  );
  return { worker, repository, issued, deleted, warnings };
}
test('no signer configuration and no logo still issue, without touching storage', async () => {
  const f = workerFixture();
  await f.worker.process(row());
  assert.equal(f.issued.length, 1);
  assert.equal(f.issued[0].logo, null);
  assert.equal(f.issued[0].signerName, undefined);
});
test('logo 404 refreshes profile exactly once; no-logo refresh can still issue', async () => {
  const f = workerFixture();
  let reads = 0;
  f.worker.directory.profile = async (org) => ({
    organizationId: org,
    name: 'Fixture',
    logo: ++reads === 1 ? { url: 'https://res.cloudinary.com/missing' } : null,
  });
  global.fetch = async () => new Response('', { status: 404 });
  await f.worker.process(row());
  assert.equal(reads, 2);
  assert.equal(f.issued[0].logo, null);
});
test('dependency failure persists retry, then recovery issues', async () => {
  let attempts = 0;
  const f = workerFixture({ retry: async () => attempts++ });
  f.worker.directory.learnerName = async () => {
    throw new IssuanceError('DIRECTORY_UNAVAILABLE');
  };
  await f.worker.process(row());
  assert.equal(attempts, 1);
  assert.equal(f.issued.length, 0);
  f.worker.directory = directory();
  await f.worker.process(row());
  assert.equal(f.issued.length, 1);
});
for (const mode of ['lost lease', 'commit failed', 'commit acknowledged late'])
  test(`orphan cleanup ownership: ${mode}`, async () => {
    const f = workerFixture({
      issue: async () => {
        if (mode === 'lost lease') return false;
        throw new Error('DB unavailable');
      },
      assetIsReferenced: async () => mode === 'commit acknowledged late',
    });
    f.worker.directory.profile = async (org) => ({
      organizationId: org,
      name: 'Fixture',
      logo: { url: 'https://res.cloudinary.com/logo' },
    });
    global.fetch = async () =>
      new Response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const r = row();
    await f.worker.process(r);
    assert.equal(f.deleted.length, mode === 'commit acknowledged late' ? 0 : 1);
    if (f.deleted[0])
      assert.ok(
        f.deleted[0].startsWith(
          `achievement/${r.organization_id}/certificates/${r.id}/logo/`,
        ),
      );
  });
test('quarantine transaction completes before commit, and next valid message proceeds', async () => {
  const actions = [],
    warnings = [];
  mock.method(Logger.prototype, 'warn', (v) => warnings.push(v));
  const repo = {
    quarantineInvalid: async () => actions.push('quarantine committed'),
    receive: async () => {
      actions.push('pending committed');
      return { id: row().id };
    },
  };
  const consumer = new CompletionConsumer(
    repo,
    { kick: () => actions.push('kick') },
    config(),
  );
  await consumer.handle(
    { ...delivery(null), value: Buffer.from('{secret-payload') },
    async () => actions.push('offset'),
  );
  await consumer.handle(delivery(event(), '1'), async (offsets) => {
    assert.equal(offsets[0].offset, '2');
    actions.push('offset');
  });
  assert.deepEqual(actions, [
    'quarantine committed',
    'offset',
    'pending committed',
    'offset',
    'kick',
  ]);
  assert.ok(!JSON.stringify(warnings).includes('secret-payload'));
});
test('DB or quarantine failure never commits offset', async () => {
  let commits = 0;
  const consumer = new CompletionConsumer(
    {
      quarantineInvalid: async () => {
        throw new Error('DB');
      },
      receive: async () => {
        throw new Error('DB');
      },
    },
    { kick() {} },
    config(),
  );
  await assert.rejects(consumer.handle(delivery(null), async () => commits++));
  await assert.rejects(
    consumer.handle(delivery(event()), async () => commits++),
  );
  assert.equal(commits, 0);
});
test('disabled consumer does not load native Kafka or block startup', async () => {
  const consumer = new CompletionConsumer({}, {}, config({ enabled: false }));
  consumer.onModuleInit();
  await consumer.onModuleDestroy();
});
test('native Kafka loader failure does not reject startup; retry can recover without leaking errors', async () => {
  const warnings = [];
  mock.method(Logger.prototype, 'warn', (v) => warnings.push(v));
  const consumer = new CompletionConsumer({}, {}, config());
  let loads = 0;
  consumer.loadKafka = async () => {
    loads++;
    throw new Error(
      'synthetic native binding missing; signed URL must not leak',
    );
  };
  assert.doesNotThrow(() => consumer.onModuleInit());
  await consumer.connecting;
  assert.equal(loads, 1);
  assert.equal(consumer.consumer, undefined);
  assert.deepEqual(warnings, ['CERTIFICATE_KAFKA_UNAVAILABLE']);
  const calls = [];
  consumer.loadKafka = async () => ({
    KafkaJS: {
      logLevel: { NOTHING: 0 },
      Kafka: class {
        consumer(options) {
          assert.equal(options.kafkaJS.autoCommit, false);
          assert.equal(options.kafkaJS.fromBeginning, true);
          return {
            connect: async () => calls.push('connect'),
            subscribe: async () => calls.push('subscribe'),
            run: async () => calls.push('run'),
            disconnect: async () => calls.push('disconnect'),
          };
        }
      },
    },
  });
  consumer.connect();
  await consumer.connecting;
  assert.deepEqual(calls, ['connect', 'subscribe', 'run']);
  await consumer.onModuleDestroy();
  assert.equal(calls.at(-1), 'disconnect');
});
test('deep JSON, nonfinite JSON numbers and unknown completion fields are quarantined without throwing', () => {
  for (const value of [
    Buffer.from('['.repeat(100) + '0' + ']'.repeat(100)),
    Buffer.from('1e999'),
  ])
    assert.ok(decodeCompletion({ ...delivery(null), value }).reason);
  const e = event();
  e.data.unexpected = 'future field';
  assert.ok(decodeCompletion(delivery(e)).reason);
});
