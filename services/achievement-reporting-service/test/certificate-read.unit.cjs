const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');
const { randomUUID } = require('node:crypto');
const { CloudinaryStorageProvider } = require('@learnup/ts-storage');
const {
  CertificatesService,
} = require('../dist/src/modules/certificates/certificates.service');
const {
  CertificateReadRepository,
} = require('../dist/src/modules/certificates/certificate-read.repository');
const {
  CertificatePdfQueue,
} = require('../dist/src/modules/certificates/certificate-pdf.queue');
const {
  CertificatePdfRenderer,
  unsupportedGlyphCount,
} = require('../dist/src/modules/certificates/certificate-pdf.renderer');
const {
  certificateReadConfig,
  issuedDate,
  pdfDisposition,
} = require('../dist/src/modules/certificates/certificate-read.config');
const {
  CloudinaryIssuanceStorage,
} = require('../dist/src/modules/certificates/issuance.storage');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const { config, row, directory } = require('./fixtures.cjs');
const {
  settings,
  user,
  record,
  httpApp,
  headers,
} = require('./certificate-read.helpers.cjs');
const { png, hash } = require('./signer.helpers.cjs');
const originalFetch = global.fetch;
afterEach(() => {
  mock.restoreAll();
  global.fetch = originalFetch;
});
const error = (status, code) => (e) =>
  e.getStatus() === status && e.getResponse().code === code;
const service = (repository = {}) =>
  new CertificatesService(repository, {}, settings);
test('repository applies organization, learner and Issued predicates in each database query', async () => {
  const seen = [];
  const repo = new CertificateReadRepository({
    $queryRaw: async (q) => {
      seen.push(q);
      return [];
    },
  });
  const u = user(),
    id = randomUUID();
  await repo.list(u.organizationId, u.userId, 20, {
    issuedAt: '2026-01-01T00:00:00.000Z',
    id,
  });
  await repo.detail(u.organizationId, u.userId, id);
  await repo.pdf(u.organizationId, u.userId, id);
  for (const q of seen) {
    assert.match(
      q.sql,
      /organization_id=\?::uuid AND learner_id=\?::uuid AND status='Issued'/,
    );
    assert.equal(q.values[0], u.organizationId);
    assert.equal(q.values[1], u.userId);
    assert.doesNotMatch(q.sql, /score_snapshot|SELECT \*/);
  }
  assert.match(seen[0].sql, /ORDER BY issued_at DESC,id DESC LIMIT/);
  assert.equal(seen[0].values.at(-1), 21);
});
test('context rejects missing or malformed identities before role checks and forbids non-learners', () => {
  const s = service(),
    u = user();
  for (const patch of [
    { userId: 'bad' },
    { organizationId: 'bad' },
    { userId: undefined },
    { organizationId: undefined },
    { isAuthenticated: false },
  ])
    assert.throws(
      () => s.authorize({ ...u, ...patch }),
      error(401, 'INVALID_USER_CONTEXT'),
    );
  for (const role of ['ORGANIZER', 'INSTRUCTOR', 'ADMIN'])
    assert.throws(
      () => s.authorize({ ...u, role }),
      error(403, 'FORBIDDEN_ROLE'),
    );
});
test('malformed and absent certificate identifiers consistently return 404 without leaking details', async () => {
  let calls = 0;
  const s = service({
      detail: async () => {
        calls++;
        return null;
      },
      pdf: async () => {
        calls++;
        return null;
      },
    }),
    u = user();
  for (const id of ['bad', randomUUID()]) {
    await assert.rejects(s.detail(u, id), error(404, 'CERTIFICATE_NOT_FOUND'));
    await assert.rejects(s.pdf(u, id), error(404, 'CERTIFICATE_NOT_FOUND'));
  }
  assert.equal(calls, 2);
});
test('strict paging validates cursor and size and preserves stable next cursor', async () => {
  const rows = [record(), record()];
  let args;
  const s = service({
      list: async (...a) => {
        args = a;
        return rows;
      },
    }),
    u = user();
  const first = await s.list(u, { size: '1' });
  assert.equal(first.items.length, 1);
  assert.ok(first.nextCursor);
  await s.list(u, { cursor: first.nextCursor });
  assert.equal(args[2], 20);
  assert.equal(args[3].id, rows[0].id);
  for (const query of [
    { cursor: 'bad' },
    { cursor: 'x'.repeat(300) },
    { cursor: Buffer.from('{}').toString('base64url') },
    {
      cursor: Buffer.from(JSON.stringify(['invalid', randomUUID()])).toString(
        'base64url',
      ),
    },
    { size: '101' },
    { size: '0' },
    { size: ['20'] },
    { filter: 'x' },
  ])
    await assert.rejects(s.list(u, query), (e) => e.getStatus() === 400);
});
test('safe response uses Vietnam calendar date and frozen text without technical metadata', () => {
  const result = service().response(record());
  assert.equal(result.issuedDate, '2026-11-01');
  assert.equal(result.certificateCode, '0123-4567-89AB');
  assert.equal(result.issuedAt, '2026-10-31T23:00:00.000Z');
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'recipient',
      'organizationName',
      'courseTitle',
      'versionNumber',
      'issuedAt',
      'issuedDate',
      'certificateCode',
      'completedLate',
      'signerName',
      'signerTitle',
    ].sort(),
  );
  assert.equal(
    issuedDate(new Date('2026-10-31T17:00:00Z'), settings.timezone),
    '2026-11-01',
  );
  assert.equal(certificateReadConfig(() => undefined).queueSize, 16);
  assert.throws(() =>
    certificateReadConfig((k) =>
      k === 'CERTIFICATE_DISPLAY_TIMEZONE' ? 'bad zone' : undefined,
    ),
  );
});
test('download filename supplies safe ASCII fallback and RFC 5987 encoding', () => {
  assert.equal(
    pdfDisposition('0123-4567-89AB'),
    `attachment; filename="0123-4567-89AB.pdf"; filename*=UTF-8''0123-4567-89AB.pdf`,
  );
  const value = pdfDisposition('Chứng chỉ\r\n"/');
  assert.doesNotMatch(value, /[\r\n]/);
  assert.match(value, /filename\*=UTF-8''Ch%E1%BB%A9ng/);
});
test('one render runs at a time, queue bounds reject overload and timed-out work is never rendered', async () => {
  const queue = new CertificatePdfQueue({
    ...settings,
    queueSize: 1,
    queueWaitMs: 30,
  });
  let release,
    ran = false;
  const active = queue.run(() => new Promise((r) => (release = r)));
  const waiting = queue.run(async () => {
    ran = true;
  });
  await assert.rejects(
    queue.run(async () => {}),
    error(503, 'SERVICE_UNAVAILABLE'),
  );
  await assert.rejects(waiting, error(503, 'SERVICE_UNAVAILABLE'));
  assert.equal(ran, false);
  release();
  await active;
  assert.equal(await queue.run(async () => 42), 42);
});
test('queued renders hand off ownership in arrival order', async () => {
  const queue = new CertificatePdfQueue(settings),
    order = [];
  let release;
  const a = queue.run(() => new Promise((r) => (release = r)));
  const b = queue.run(async () => order.push('b'));
  const c = queue.run(async () => order.push('c'));
  release();
  await Promise.all([a, b, c]);
  assert.deepEqual(order, ['b', 'c']);
});
test('HTTP overload returns JSON and Retry-After before any PDF headers', async () => {
  const s = service();
  s.pdf = async () => {
    throw new (require('@nestjs/common').HttpException)(
      { code: 'SERVICE_UNAVAILABLE' },
      503,
    );
  };
  const h = await httpApp(s);
  try {
    const r = await fetch(
      h.base + '/api/v1/certificates/me/' + randomUUID() + '/pdf',
      { headers: headers(user()) },
    );
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('retry-after'), '1');
    assert.match(r.headers.get('content-type'), /json/);
    assert.equal(r.headers.get('content-disposition'), null);
    assert.equal((await r.json()).error.code, 'SERVICE_UNAVAILABLE');
  } finally {
    await h.app.close();
  }
});
test('storage maps only PNG and JPEG and explicitly rejects unsupported MIME', async () => {
  const seen = [];
  mock.method(
    CloudinaryStorageProvider.prototype,
    'readBytes',
    async (_key, options) => {
      seen.push(options.format);
      return Buffer.from('x');
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
  for (const mime of ['image/png', 'image/jpeg'])
    await storage.read('synthetic/key', mime, 100, 100);
  await assert.rejects(
    storage.read('synthetic/key', 'image/webp', 100, 100),
    (e) => e.code === 'UNSUPPORTED_IMAGE_TYPE',
  );
  assert.deepEqual(seen, ['png', 'jpg']);
});
for (const [name, bytes] of [
  ['WebP', Buffer.from('RIFF0000WEBP')],
  ['SVG', Buffer.from('<svg/>')],
  ['unknown', Buffer.from('invalid')],
])
  test(
    name + ' logo is skipped without failing or retrying issuance',
    async () => {
      const warnings = [];
      mock.method(Logger.prototype, 'warn', (v) => warnings.push(v));
      const d = directory();
      d.profile = async () => ({
        name: 'Organization',
        logo: { url: 'https://res.cloudinary.com/test' },
      });
      global.fetch = async () => new Response(bytes);
      let snapshot,
        retries = 0;
      const worker = new IssuanceWorker(
        {
          issue: async (_r, s) => {
            snapshot = s;
            return true;
          },
          retry: async () => retries++,
        },
        config(),
        d,
        {
          isConfigured: () => true,
          upload: async () => {
            throw Error('Must not upload');
          },
        },
        { get: async () => null },
      );
      await worker.process(row());
      assert.equal(snapshot.logo, null);
      assert.equal(retries, 0);
      assert.ok(
        warnings.some((w) => w.code === 'CERTIFICATE_LOGO_UNSUPPORTED'),
      );
    },
  );
test('glyph coverage detection reports count without logging the unsupported characters', () => {
  const font = { hasGlyphForCodePoint: (cp) => cp < 128 };
  assert.equal(unsupportedGlyphCount(['A文🙂'], [font]), 2);
  assert.equal(unsupportedGlyphCount(['ABC'], [font]), 0);
});
test('font startup rejects missing and modified font files clearly', () => {
  const fs = require('node:fs');
  const real = fs.readFileSync;
  mock.method(fs, 'readFileSync', (p) => {
    if (String(p).endsWith('.ttf')) throw Error('missing');
    return real(p);
  });
  assert.throws(
    () =>
      new CertificatePdfRenderer(
        new CertificatePdfQueue(settings),
        {},
        config(),
      ),
    /Required certificate font missing/,
  );
  mock.restoreAll();
  mock.method(fs, 'readFileSync', (p) =>
    String(p).endsWith('.ttf') ? Buffer.from('modified') : real(p),
  );
  assert.throws(
    () =>
      new CertificatePdfRenderer(
        new CertificatePdfQueue(settings),
        {},
        config(),
      ),
    /checksum mismatch/,
  );
});
test('renderer verifies supported assets, skips unsupported assets and still renders missing glyphs', async () => {
  const warnings = [];
  mock.method(Logger.prototype, 'warn', (v) => warnings.push(v));
  mock.method(Logger.prototype, 'error', () => {});
  mock.method(Logger.prototype, 'log', () => {});
  const storage = { read: async () => Buffer.from('different') },
    renderer = new CertificatePdfRenderer(
      new CertificatePdfQueue(settings),
      storage,
      config(),
    );
  const base = record({
    logoAssetKey: 'private-key',
    logoMime: 'image/png',
    logoHash: hash(png()),
  });
  await assert.rejects(
    renderer.render(base, service().response(base)),
    error(503, 'SERVICE_UNAVAILABLE'),
  );
  storage.read = async () => {
    throw Error('private URL must not escape');
  };
  await assert.rejects(
    renderer.render(base, service().response(base)),
    error(503, 'SERVICE_UNAVAILABLE'),
  );
  const unsupported = record({
    logoAssetKey: 'private-key',
    logoMime: 'image/webp',
    logoHash: '0'.repeat(64),
    learnerName: '文🙂',
  });
  const pdf = await renderer.render(
    unsupported,
    service().response(unsupported),
  );
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from('%PDF')));
  assert.ok(warnings.some((w) => w.code === 'CERTIFICATE_ASSET_UNSUPPORTED'));
  assert.ok(warnings.some((w) => w.count === 2));
  assert.ok(warnings.every((w) => !JSON.stringify(w).includes('文')));
});
let pdfjs;
async function extract(bytes) {
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;
  return doc;
}
const renderer = () =>
  new CertificatePdfRenderer(new CertificatePdfQueue(settings), {}, config());
test('all Vietnamese vowels and tones plus đ in both cases extract exactly after NFC normalization', async () => {
  const chars =
    [...'aăâeêioôơuưy']
      .flatMap((v) =>
        ['', '\u0300', '\u0301', '\u0309', '\u0303', '\u0323'].map((t) =>
          (v + t).normalize('NFC'),
        ),
      )
      .join('') + 'đ';
  const all = chars + chars.toUpperCase();
  for (const name of [all.slice(0, 100), all.slice(100)]) {
    const row = record({
      learnerName: name.normalize('NFD'),
      courseName: all.normalize('NFD'),
    });
    const bytes = await renderer().render(row, service().response(row));
    const doc = await extract(bytes);
    try {
      const text = (await (await doc.getPage(1)).getTextContent()).items
        .map((i) => i.str)
        .join('');
      assert.ok(text.includes(name));
      assert.ok(text.includes(all));
    } finally {
      await doc.cleanup();
    }
  }
});
test('maximum database text lengths with Vietnamese diacritics fit bounded regions on one A4 landscape page', async () => {
  const row = record({
    learnerName: 'Ắ'.repeat(100),
    courseName: 'Ộ'.repeat(200),
    organizationName: 'Ễ'.repeat(200),
    signerName: 'Ữ'.repeat(100),
    signerTitle: 'Ậ'.repeat(200),
  });
  const bytes = await renderer().render(row, service().response(row)),
    doc = await extract(bytes);
  try {
    assert.equal(doc.numPages, 1);
    const page = await doc.getPage(1),
      viewport = page.getViewport({ scale: 1 }),
      content = await page.getTextContent();
    const joined = content.items.map((i) => i.str).join('');
    for (const text of [
      row.learnerName,
      row.courseName,
      row.organizationName,
      row.signerName,
      row.signerTitle,
    ])
      assert.ok(joined.includes(text));
    for (const item of content.items) {
      if (!item.str) continue;
      const x = item.transform[4],
        y = item.transform[5];
      assert.ok(x >= 25 && x + item.width <= viewport.width - 20);
      assert.ok(y >= 20 && y + item.height <= viewport.height - 20);
      assert.ok(Math.hypot(item.transform[0], item.transform[1]) >= 10);
    }
  } finally {
    await doc.cleanup();
  }
});

test('late timers cannot start renders after the queue deadline', async () => {
  const queue = new CertificatePdfQueue({ ...settings, queueWaitMs: 15 });
  let release,
    ran = false;
  const first = queue.run(() => new Promise((done) => (release = done)));
  const waiting = queue.run(async () => {
    ran = true;
  });
  const rejected = assert.rejects(waiting, error(503, 'SERVICE_UNAVAILABLE'));
  const stop = performance.now() + 30;
  let now = performance.now();
  while (now < stop) {
    now = performance.now();
  }
  release();
  await first;
  await rejected;
  assert.equal(ran, false);
});

test('renderer checks frozen magic bytes and verifies supported PNG bytes before embedding', async () => {
  const warnings = [];
  mock.method(Logger.prototype, 'warn', (value) => warnings.push(value));
  mock.method(Logger.prototype, 'log', () => {});
  let bytes = Buffer.from('RIFF0000WEBP');
  const storage = { read: async () => bytes },
    render = new CertificatePdfRenderer(
      new CertificatePdfQueue(settings),
      storage,
      config(),
    );
  const unsupported = record({
    logoAssetKey: 'synthetic/frozen',
    logoMime: 'image/png',
    logoHash: hash(bytes),
  });
  assert.equal(
    (await render.render(unsupported, service().response(unsupported)))
      .subarray(0, 4)
      .toString(),
    '%PDF',
  );
  assert.equal(warnings[0].code, 'CERTIFICATE_ASSET_UNSUPPORTED');
  bytes = png();
  const valid = record({
    logoAssetKey: 'synthetic/logo',
    logoMime: 'image/png',
    logoHash: hash(bytes),
    signatureAssetKey: 'synthetic/signature',
    signatureMime: 'image/png',
    signatureHash: hash(bytes),
  });
  assert.equal(
    (await render.render(valid, service().response(valid)))
      .subarray(0, 4)
      .toString(),
    '%PDF',
  );
  assert.equal(warnings.length, 1);
});
