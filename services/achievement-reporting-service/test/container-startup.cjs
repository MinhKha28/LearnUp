// Explicit opt-in Docker startup check; not part of npm test and never builds/migrates baseline.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { isolatedDatabase } = require('./postgres.cjs');
const { event, delivery } = require('./fixtures.cjs');
const docker = (args, env = process.env) => {
  const result = spawnSync('docker', args, {
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.status !== 0)
    throw new Error('Docker operation failed; details suppressed');
  return result.stdout.trim();
};
async function main() {
  const databaseContainer = process.env.CERTIFICATE_TEST_DB_CONTAINER;
  if (!databaseContainer)
    throw new Error('CERTIFICATE_TEST_DB_CONTAINER required');
  const fixture = await isolatedDatabase();
  const name = 'learnup-achievement-pr1-check-' + randomUUID().slice(0, 8);
  let started = false;
  try {
    const pending = event();
    await fixture.repository.receive(pending, delivery(pending), pending);
    const network = Object.keys(
      JSON.parse(
        docker([
          'inspect',
          '--format',
          '{{json .NetworkSettings.Networks}}',
          databaseContainer,
        ]),
      ),
    )[0];
    const url = new URL(fixture.connectionString);
    url.hostname = databaseContainer;
    url.port = '5432';
    const env = {
      ...process.env,
      DATABASE_URL: url.toString(),
      INTERNAL_SERVICE_KEY: 'synthetic-runtime-check-key',
      CERTIFICATE_CONSUMER_ENABLED: 'true',
      KAFKA_BROKERS: '127.0.0.1:1',
      TENANT_SERVICE_URL: 'http://127.0.0.1:1',
      COURSE_SERVICE_URL: 'http://127.0.0.1:1',
    };
    docker(
      [
        'run',
        '--rm',
        '--detach',
        '--name',
        name,
        '--network',
        network,
        '-p',
        '127.0.0.1::8087',
        '-e',
        'PORT=8087',
        '-e',
        'DATABASE_URL',
        '-e',
        'INTERNAL_SERVICE_KEY',
        '-e',
        'CERTIFICATE_CONSUMER_ENABLED',
        '-e',
        'KAFKA_BROKERS',
        '-e',
        'TENANT_SERVICE_URL',
        '-e',
        'COURSE_SERVICE_URL',
        process.env.CERTIFICATE_TEST_IMAGE ?? 'learnup-achievement-pr1:local',
      ],
      env,
    );
    started = true;
    const port = docker(['port', name, '8087/tcp'])
      .split('\n')[0]
      .split(':')
      .at(-1);
    let status;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(
          'http://127.0.0.1:' + port + '/docs-json',
          { signal: AbortSignal.timeout(1000) },
        );
        status = response.status;
        await response.body?.cancel();
        if (status === 200) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(status, 200);
    assert.equal(
      docker([
        'exec',
        name,
        'node',
        '-e',
        "require('@confluentinc/kafka-javascript'); process.stdout.write('NATIVE_OK')",
      ]),
      'NATIVE_OK',
    );
    let state;
    for (let attempt = 0; attempt < 20; attempt++) {
      state = (
        await fixture.pool.query(
          'SELECT status,issue_attempts FROM certificates',
        )
      ).rows[0];
      if (state.issue_attempts > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(state.status, 'Pending');
    assert.ok(state.issue_attempts > 0);
    console.log(
      JSON.stringify({
        httpStatus: status,
        nativeKafka: 'loaded in Linux runtime',
        consumerEnabled: true,
        broker: 'unavailable',
        directory: 'unavailable',
        cloudinary: 'unconfigured',
        database: 'isolated test schema',
        publicDatabaseTouched: false,
        pendingRetained: true,
      }),
    );
  } finally {
    try {
      if (started) docker(['stop', name]);
    } finally {
      await fixture.cleanup();
    }
    console.log('CONTAINER_AND_TEST_SCHEMA_CLEANED');
  }
}
main().catch(() => {
  console.error('CONTAINER_STARTUP_CHECK_FAILED; sensitive errors suppressed');
  process.exitCode = 1;
});
