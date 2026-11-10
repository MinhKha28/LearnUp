const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { isolatedDatabase } = require('./postgres.cjs');
const {
  user,
  headers,
  httpApp,
  seed,
  services,
} = require('./certificate-read.helpers.cjs');
const { hash, png } = require('./signer.helpers.cjs');
test('real PostgreSQL HTTP learner list, keyset detail and buffered PDF enforce ownership and issued state', async (t) => {
  const f = await isolatedDatabase();
  let app;
  try {
    const u = user(),
      other = user(),
      crossOrg = { ...u, organizationId: randomUUID() };
    const own = await seed(f, u),
      sameDate = await seed(f, u),
      foreignLearner = await seed(f, { ...u, userId: other.userId }),
      foreignOrg = await seed(f, crossOrg);
    const pending = await seed(f, u, { pending: true });
    const { service } = services(f);
    const http = await httpApp(service);
    app = http.app;
    const url = http.base + '/api/v1/certificates/me';
    const get = (path = '', h = headers(u)) =>
      fetch(url + path, { headers: h });
    await t.test(
      'list keyset handles timestamp ties, default and maximum sizes and invalid cursors',
      async () => {
        const first = await get('?size=1'),
          a = (await first.json()).data;
        assert.equal(first.status, 200);
        assert.equal(a.items.length, 1);
        assert.ok(a.nextCursor);
        assert.equal(a.items[0].issuedDate, '2026-11-01');
        const b = (await (await get('?size=1&cursor=' + a.nextCursor)).json())
          .data;
        assert.equal(b.items.length, 1);
        assert.equal(b.nextCursor, null);
        assert.deepEqual(
          new Set([a.items[0].id, b.items[0].id]),
          new Set([own, sameDate]),
        );
        assert.equal((await (await get()).json()).data.items.length, 2);
        assert.equal(
          (await (await get('?size=100')).json()).data.items.length,
          2,
        );
        for (const path of ['?cursor=bad', '?size=101', '?filter=x'])
          assert.equal((await get(path)).status, 400);
        const text = JSON.stringify(a);
        assert.doesNotMatch(
          text,
          /learnerId|organizationId|scoreSnapshot|AssetKey|Hash|issuedRecordedAt/,
        );
      },
    );
    await t.test(
      'foreign learner, foreign organization, Pending, unknown and malformed return 404 for detail and PDF',
      async () => {
        for (const id of [
          foreignLearner,
          foreignOrg,
          pending,
          randomUUID(),
          'not-a-uuid',
        ])
          for (const suffix of ['', '/pdf']) {
            const r = await get('/' + id + suffix);
            assert.equal(r.status, 404);
            assert.equal((await r.json()).error.code, 'CERTIFICATE_NOT_FOUND');
          }
      },
    );
    await t.test(
      'HTTP identity and role validation returns 401 and 403 in the existing envelope',
      async () => {
        for (const patch of [
          { 'x-user-id': 'bad' },
          { 'x-organization-id': 'bad' },
          { 'x-internal-key': 'bad' },
        ])
          assert.equal(
            (await get('', { ...headers(u), ...patch })).status,
            401,
          );
        const missing = headers(u);
        delete missing['x-user-id'];
        assert.equal((await get('', missing)).status, 401);
        for (const role of ['ADMIN', 'ORGANIZER', 'INSTRUCTOR'])
          for (const suffix of [
            '',
            '?cursor=bad',
            '/' + own,
            '/' + own + '/pdf',
          ]) {
            const r = await get(suffix, { ...headers(u), 'x-user-role': role });
            assert.equal(r.status, 403);
            assert.equal((await r.json()).error.code, 'FORBIDDEN_ROLE');
          }
      },
    );
    await t.test(
      'detail has only frozen public text and PDF headers describe the completed buffer',
      async () => {
        const detail = (await (await get('/' + own)).json()).data;
        assert.equal(detail.recipient, 'Nguyễn Thị Ánh');
        assert.equal(detail.issuedDate, '2026-11-01');
        assert.equal(detail.id, undefined);
        const r = await get('/' + own + '/pdf'),
          bytes = Buffer.from(await r.arrayBuffer());
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('content-type'), 'application/pdf');
        assert.equal(Number(r.headers.get('content-length')), bytes.length);
        assert.equal(r.headers.get('cache-control'), 'private, no-store');
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.match(
          r.headers.get('content-disposition'),
          /attachment; filename="[A-Z0-9-]+\.pdf"; filename\*=UTF-8''/,
        );
        assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
        const missing = (await (await get('', headers(user()))).json()).data;
        assert.deepEqual(missing, { items: [], nextCursor: null });
      },
    );
  } finally {
    await app?.close();
    await f.cleanup();
  }
});
test('real PostgreSQL asset read and verification failures return JSON 503 without PDF headers', async () => {
  const f = await isolatedDatabase();
  let app;
  try {
    const u = user(),
      id = await seed(f, u, {
        assets: {
          logo: {
            key: 'synthetic/private/logo',
            mime: 'image/png',
            hash: hash(png()),
            size: png().length,
          },
        },
      });
    const storage = {
        read: async () => {
          throw Error('synthetic read failure');
        },
      },
      http = await httpApp(services(f, storage).service);
    app = http.app;
    for (const read of [
      async () => {
        throw Error('unavailable');
      },
      async () => Buffer.from('mismatch'),
    ]) {
      storage.read = read;
      const r = await fetch(
        http.base + '/api/v1/certificates/me/' + id + '/pdf',
        { headers: headers(u) },
      );
      assert.equal(r.status, 503);
      assert.equal(r.headers.get('retry-after'), '1');
      assert.equal(r.headers.get('content-disposition'), null);
      assert.match(r.headers.get('content-type'), /json/);
      assert.equal((await r.json()).error.code, 'SERVICE_UNAVAILABLE');
    }
  } finally {
    await app?.close();
    await f.cleanup();
  }
});

test('full service starts with storage unconfigured and Kafka unreachable', async () => {
  const { spawn } = require('node:child_process'),
    { createServer } = require('node:net'),
    { resolve } = require('node:path');
  const f = await isolatedDatabase();
  let child;
  try {
    const reserve = createServer();
    await new Promise((done) => reserve.listen(0, '127.0.0.1', done));
    const port = reserve.address().port;
    await new Promise((done) => reserve.close(done));
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: f.connectionString,
      INTERNAL_SERVICE_KEY: 'synthetic-certificate-http-test-key',
      PORT: String(port),
      CERTIFICATE_CONSUMER_ENABLED: 'true',
      KAFKA_BROKERS: '127.0.0.1:1',
    };
    for (const key of [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ])
      delete env[key];
    child = spawn(
      process.execPath,
      [resolve(__dirname, '../dist/src/main.js')],
      {
        cwd: resolve(__dirname, '..'),
        env,
        stdio: 'ignore',
        windowsHide: true,
      },
    );
    let response;
    const stop = Date.now() + 20000;
    while (Date.now() < stop && child.exitCode === null) {
      try {
        response = await fetch(
          'http://127.0.0.1:' + port + '/api/v1/certificates/me',
          { headers: headers(user()), signal: AbortSignal.timeout(1000) },
        );
        if (response.status === 200) break;
      } catch {
        response = undefined;
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    assert.equal(response?.status, 200);
    assert.deepEqual((await response.json()).data, {
      items: [],
      nextCursor: null,
    });
  } finally {
    if (child && child.exitCode === null) {
      const exited = new Promise((done) => child.once('exit', done));
      child.kill();
      await exited;
    }
    await f.cleanup();
  }
});
