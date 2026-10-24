const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory, Reflector } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { isolatedDatabase } = require('./postgres.cjs');
const { event, delivery, directory, config } = require('./fixtures.cjs');
const { png, hash, user, body } = require('./signer.helpers.cjs');
const {
  SignerRepository,
} = require('../dist/src/modules/certificates/signer.repository');
const {
  SignerService,
} = require('../dist/src/modules/certificates/signer.service');
const {
  SignerController,
} = require('../dist/src/modules/certificates/signer.controller');
const {
  StorageCleanupWorker,
} = require('../dist/src/modules/certificates/storage-cleanup.worker');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const {
  InternalAuthGuard,
} = require('../dist/src/common/guards/internal-auth.guard');
const {
  TransformInterceptor,
} = require('../dist/src/common/interceptors/transform.interceptor');
const {
  HttpExceptionFilter,
} = require('../dist/src/common/filters/http-exception.filter');
const {
  signerConfig,
} = require('../dist/src/modules/certificates/signer.config');
const settingsConfig = () =>
  signerConfig(
    (k) =>
      ({ NODE_ENV: 'test', CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE: 'fake' })[k],
    config(),
  );
function memoryStorage() {
  const assets = new Map();
  return {
    assets,
    upload: async (r, i, key) => {
      assets.set(key, Buffer.from(i.bytes));
      return { key, hash: hash(i.bytes), mime: i.mime, size: i.bytes.length };
    },
    read: async (key) => {
      if (!assets.has(key))
        throw Object.assign(new Error('missing'), { code: 'NOT_FOUND' });
      return assets.get(key);
    },
    delete: async (key) => {
      assets.delete(key);
    },
  };
}
async function httpApp(service) {
  class TestModule {}
  Module({
    controllers: [SignerController],
    providers: [{ provide: SignerService, useValue: service }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  const reflector = new Reflector();
  app.setGlobalPrefix('api/v1');
  app.useGlobalGuards(
    new InternalAuthGuard(
      reflector,
      new ConfigService({ INTERNAL_SERVICE_KEY: 'synthetic-isolated-test' }),
    ),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(reflector));
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl() };
}
function headers(u, version) {
  return {
    'x-internal-key': 'synthetic-isolated-test',
    'x-user-id': u.userId,
    'x-organization-id': u.organizationId,
    'x-user-role': u.role,
    ...(version === undefined ? {} : { 'if-match': `"${version}"` }),
  };
}
function form(action = 'keep', bytes) {
  const f = new FormData();
  for (const [k, v] of Object.entries(body(action))) f.append(k, v);
  if (bytes)
    f.append(
      'signature',
      new Blob([bytes], { type: 'text/plain' }),
      'signature.png',
    );
  return f;
}
test('real HTTP + PostgreSQL signer API, CAS race, binary privacy and cleanup lifecycle', async (t) => {
  const f = await isolatedDatabase(),
    repo = new SignerRepository(f.db),
    storage = memoryStorage(),
    cfg = settingsConfig();
  const u = user();
  const service = new SignerService(
    repo,
    { assertWritable: async () => {} },
    cfg,
    config(),
    storage,
  );
  let server;
  try {
    server = await httpApp(service);
    const url = server.base + '/api/v1/certificates/signer-settings';
    const put = (v, formData, actor = u) =>
      fetch(url, { method: 'PUT', headers: headers(actor, v), body: formData });
    await t.test(
      'GET unconfigured, 428 precondition, roles and cross-org isolation',
      async () => {
        let r = await fetch(url, { headers: headers(u) });
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('etag'), '"0"');
        assert.equal((await r.json()).data.configured, false);
        r = await put(undefined, form());
        assert.equal(r.status, 428);
        assert.equal((await r.json()).error.code, 'PRECONDITION_REQUIRED');
        r = await put(0, form(), { ...u, role: 'LEARNER' });
        assert.equal(r.status, 403);
        r = await fetch(url + '/signature', { headers: headers(user()) });
        assert.equal(r.status, 404);
      },
    );
    await t.test('two concurrent PUT version 0: one 200, one 412', async () => {
      const responses = await Promise.all([put(0, form()), put(0, form())]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 412]);
      for (const response of responses) {
        const json = await response.json();
        if (response.status === 200) {
          assert.equal(response.headers.get('etag'), '"1"');
          assert.equal(json.data.version, 1);
        } else assert.equal(json.error.code, 'VERSION_CONFLICT');
      }
    });
    await t.test(
      'multipart limits and action/unknown-field errors through Nest',
      async () => {
        let r = await put(1, form('replace', Buffer.alloc(2097153)));
        assert.equal(r.status, 413);
        assert.equal((await r.json()).error.code, 'SIGNATURE_TOO_LARGE');
        const extra = form();
        extra.append('organizationId', u.organizationId);
        r = await put(1, extra);
        assert.equal(r.status, 400);
        const wrong = form();
        wrong.append('file', new Blob([png()]), 'x.png');
        r = await put(1, wrong);
        assert.equal(r.status, 400);
        const duplicate = form('replace', png());
        duplicate.append('signature', new Blob([png()]), 'x.png');
        r = await put(1, duplicate);
        assert.equal(r.status, 400);
        r = await put(1, form('replace'));
        assert.equal(r.status, 400);
        r = await put(1, form('keep', png()));
        assert.equal(r.status, 400);
        r = await put(1, form('replace', Buffer.from('GIF89a')));
        assert.equal(r.status, 415);
      },
    );
    let oldKey;
    await t.test(
      'upload ignores client MIME, preview is exact bytes without JSON or storage URL',
      async () => {
        const r = await put(1, form('replace', png()));
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('etag'), '"2"');
        const json = await r.json();
        assert.equal(json.data.signature.mimeType, 'image/png');
        assert.ok(!JSON.stringify(json).includes('achievement/'));
        const preview = await fetch(url + '/signature', {
          headers: headers(u),
        });
        assert.equal(preview.status, 200);
        assert.equal(preview.headers.get('content-type'), 'image/png');
        assert.equal(preview.headers.get('cache-control'), 'no-store');
        assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
        assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png());
        oldKey = (await repo.get(u.organizationId)).signature_asset_key;
      },
    );
    await t.test(
      'replace queues old key; stale upload queues new orphan; worker honors delay',
      async () => {
        const replaced = await put(2, form('replace', png()));
        assert.equal(replaced.status, 200);
        const stale = await put(2, form('replace', png()));
        assert.equal(stale.status, 412);
        const tasks = (
          await f.pool.query('SELECT * FROM storage_cleanup_tasks')
        ).rows;
        assert.equal(tasks.length, 2);
        assert.ok(tasks.some((x) => x.asset_key === oldKey));
        assert.ok(
          tasks.every((x) => x.not_before.getTime() > Date.now() + 590000),
        );
        assert.equal((await repo.claim(10, 1000)).length, 0);
        await f.pool.query(
          "UPDATE storage_cleanup_tasks SET not_before=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second'",
        );
        const [a, b] = await Promise.all([
          repo.claim(1, 10000),
          repo.claim(10, 10000),
        ]);
        assert.equal(a.length + b.length, 2);
        assert.equal(new Set([...a, ...b].map((x) => x.id)).size, 2);
        const cleanup = new StorageCleanupWorker(repo, cfg, storage);
        for (const task of [...a, ...b]) await cleanup.process(task);
        assert.equal(
          (
            await f.pool.query(
              'SELECT count(*)::int AS n FROM storage_cleanup_tasks',
            )
          ).rows[0].n,
          0,
        );
        assert.equal(storage.assets.size, 1);
      },
    );
    await t.test(
      'remove preserves required signer text, schedules old image and preview becomes 404',
      async () => {
        assert.equal((await put(3, form('remove'))).status, 200);
        const current = await repo.get(u.organizationId);
        assert.equal(current.signer_name, body().signerName);
        assert.equal(current.signature_asset_key, null);
        assert.equal(
          (await fetch(url + '/signature', { headers: headers(u) })).status,
          404,
        );
      },
    );
    await t.test(
      'DB enforces paired image fields, positive version and PNG/JPEG only',
      async () => {
        for (const sql of [
          "UPDATE certificate_signer_settings SET signature_mime='image/png'",
          'UPDATE certificate_signer_settings SET version=0',
          "UPDATE certificate_signer_settings SET signer_name=' '",
        ])
          await assert.rejects(f.pool.query(sql), (e) => e.code === '23514');
      },
    );
    await t.test(
      'cleanup lease fencing, live references and retry persistence',
      async () => {
        const ref = await repo.get(u.organizationId);
        const asset = {
          key: `achievement/${u.organizationId}/certificate-signer/signature/${randomUUID()}`,
          hash: hash(png()),
          mime: 'image/png',
          size: png().length,
        };
        storage.assets.set(asset.key, png());
        await repo.put(
          u.organizationId,
          u.userId,
          ref.version,
          { signerName: 'A', signerTitle: 'Director', action: 'replace' },
          asset,
          600000,
        );
        await repo.enqueue(asset.key, 'AMBIGUOUS_ACK', 1);
        await f.pool.query(
          "UPDATE storage_cleanup_tasks SET not_before=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second'",
        );
        const tasks = await repo.claim(10, 10000);
        const guarded = tasks.find((x) => x.asset_key === asset.key);
        assert.ok(guarded);
        await new StorageCleanupWorker(repo, cfg, storage).process(guarded);
        assert.ok(storage.assets.has(asset.key));
        const kept = (
          await f.pool.query(
            'SELECT * FROM storage_cleanup_tasks WHERE id=$1',
            [guarded.id],
          )
        ).rows[0];
        assert.equal(kept.attempts, 1);
        assert.equal(kept.last_error, 'ASSET_REFERENCED');
        const task = tasks.find((x) => x.asset_key !== asset.key);
        assert.ok(task);
        await f.pool.query(
          "UPDATE storage_cleanup_tasks SET lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [task.id],
        );
        const reclaimed = (await repo.claim(10, 10000)).find(
          (x) => x.id === task.id,
        );
        assert.ok(reclaimed);
        assert.notEqual(reclaimed.lease_token, task.lease_token);
        await repo.done(task);
        assert.equal(
          (
            await f.pool.query(
              'SELECT count(*)::int AS n FROM storage_cleanup_tasks WHERE id=$1',
              [task.id],
            )
          ).rows[0].n,
          1,
        );
        await new StorageCleanupWorker(repo, cfg, {
          delete: async () => {
            throw new Error('network');
          },
        }).process(reclaimed);
        const retried = (
          await f.pool.query(
            'SELECT * FROM storage_cleanup_tasks WHERE id=$1',
            [task.id],
          )
        ).rows[0];
        assert.equal(retried.attempts, 1);
        assert.equal(retried.last_error, 'STORAGE_UNAVAILABLE');
        assert.equal(retried.lease_token, null);
      },
    );
  } finally {
    if (server) await server.app.close();
    await f.cleanup();
  }
});
test('real PostgreSQL snapshot version fencing, absent config and Issued immutability', async (t) => {
  const f = await isolatedDatabase(),
    signers = new SignerRepository(f.db),
    storage = memoryStorage();
  const u = user(),
    org = u.organizationId;
  const write = (v, name) =>
    signers.put(
      org,
      u.userId,
      v,
      { signerName: name, signerTitle: 'Director', action: 'remove' },
      null,
      600000,
    );
  const receive = async () => {
    const e = event({ organizationId: org });
    await f.repository.receive(e, delivery(e), e);
    return (await f.repository.claimDueAcrossOrganizations(1, 120000))[0];
  };
  const snapshot = (version) => ({
    learnerName: 'Learner',
    organizationName: 'Org',
    courseName: 'Course',
    versionNumber: 1,
    chainId: randomUUID(),
    logo: null,
    signer: {
      version,
      name: version ? 'Signer ' + version : null,
      title: version ? 'Director' : null,
      asset: null,
    },
  });
  try {
    await t.test(
      'version 0 cannot issue if first settings row was created; early retry leaves attempts unchanged',
      async () => {
        const row = await receive();
        await write(0, 'Signer 1');
        assert.equal(
          await f.repository.issue(row, snapshot(0)),
          'version_changed',
        );
        await f.repository.retryVersionChange(row);
        const c = (
          await f.pool.query('SELECT * FROM certificates WHERE id=$1', [row.id])
        ).rows[0];
        assert.equal(c.status, 'Pending');
        assert.equal(c.issue_attempts, 0);
        assert.equal(c.lease_token, null);
        const claim = (
          await f.repository.claimDueAcrossOrganizations(1, 120000)
        )[0];
        assert.equal(await f.repository.issue(claim, snapshot(1)), true);
      },
    );
    await t.test(
      'concurrent issuance and update: old version issues first or is rejected, never mixed',
      async () => {
        const row = await receive();
        const results = await Promise.all([
          f.repository.issue(row, snapshot(1)),
          write(1, 'Signer 2'),
        ]);
        let cert = (
          await f.pool.query('SELECT * FROM certificates WHERE id=$1', [row.id])
        ).rows[0];
        if (results[0] === true) {
          assert.equal(cert.signer_name, 'Signer 1');
          assert.equal(cert.signer_title, 'Director');
        } else {
          assert.equal(results[0], 'version_changed');
          assert.equal(cert.status, 'Pending');
          await f.repository.retryVersionChange(row);
          const next = (
            await f.repository.claimDueAcrossOrganizations(1, 120000)
          )[0];
          assert.equal(await f.repository.issue(next, snapshot(2)), true);
          cert = (
            await f.pool.query('SELECT * FROM certificates WHERE id=$1', [
              row.id,
            ])
          ).rows[0];
          assert.equal(cert.signer_name, 'Signer 2');
        }
        for (const sql of [
          "UPDATE certificates SET signer_name='Changed' WHERE id=$1",
          "UPDATE certificates SET signature_mime='image/png' WHERE id=$1",
          'DELETE FROM certificates WHERE id=$1',
        ])
          await assert.rejects(
            f.pool.query(sql, [row.id]),
            (e) => e.code === '23514',
          );
      },
    );
    await t.test(
      'worker retries changed version and cleans copied asset, then issues matching image snapshot',
      async () => {
        const bytes = png(),
          assetKey = `achievement/${org}/certificate-signer/signature/${randomUUID()}`;
        storage.assets.set(assetKey, bytes);
        await signers.put(
          org,
          u.userId,
          2,
          {
            signerName: 'Signer 3',
            signerTitle: 'Director',
            action: 'replace',
          },
          {
            key: assetKey,
            hash: hash(bytes),
            mime: 'image/png',
            size: bytes.length,
          },
          600000,
        );
        const row = await receive();
        let changed = false;
        const originalUpload = storage.upload;
        storage.upload = async (...args) => {
          const a = await originalUpload(...args);
          if (!changed) {
            changed = true;
            await write(3, 'Signer 4');
          }
          return a;
        };
        const worker = new IssuanceWorker(
          f.repository,
          config(),
          directory(),
          storage,
          signers,
        );
        await worker.process(row);
        let c = (
          await f.pool.query('SELECT * FROM certificates WHERE id=$1', [row.id])
        ).rows[0];
        assert.equal(c.status, 'Pending');
        assert.equal(c.issue_attempts, 0);
        assert.ok(
          (await f.pool.query('SELECT * FROM storage_cleanup_tasks')).rows.some(
            (x) => x.reason === 'ISSUANCE_ATTEMPT_UNUSED',
          ),
        );
        const next = (
          await f.repository.claimDueAcrossOrganizations(1, 120000)
        )[0];
        await worker.process(next);
        c = (
          await f.pool.query('SELECT * FROM certificates WHERE id=$1', [row.id])
        ).rows[0];
        assert.equal(c.status, 'Issued');
        assert.equal(c.signer_name, 'Signer 4');
        assert.equal(c.signature_asset_key, null);
      },
    );
  } finally {
    await f.cleanup();
  }
});
test('full service starts and serves API with Kafka unreachable and tenant fake', async () => {
  const f = await isolatedDatabase();
  let app;
  const keys = [
    'DATABASE_URL',
    'NODE_ENV',
    'INTERNAL_SERVICE_KEY',
    'CERTIFICATE_CONSUMER_ENABLED',
    'KAFKA_BROKERS',
    'CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    Object.assign(process.env, {
      DATABASE_URL: f.connectionString,
      NODE_ENV: 'test',
      INTERNAL_SERVICE_KEY: 'synthetic-isolated-test',
      CERTIFICATE_CONSUMER_ENABLED: 'true',
      KAFKA_BROKERS: '127.0.0.1:1',
      CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE: 'fake',
    });
    const { AppModule } = require('../dist/src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    const r = await fetch(
      (await app.getUrl()) + '/api/v1/certificates/signer-settings',
      { headers: headers(user()) },
    );
    assert.equal(r.status, 200);
    await r.text();
  } finally {
    if (app) await app.close();
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await f.cleanup();
  }
});
