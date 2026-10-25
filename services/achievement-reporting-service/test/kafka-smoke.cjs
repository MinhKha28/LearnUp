// Opt-in only: starts one disposable local broker. Never part of npm test.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fork, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { event, directory } = require('./fixtures.cjs');
const { isolatedDatabase } = require('./postgres.cjs');
const {
  issuanceConfig,
  ISSUANCE_CONFIG,
} = require('../dist/src/modules/certificates/issuance.config');
const {
  CompletionConsumer,
} = require('../dist/src/modules/certificates/completion.consumer');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const {
  CertificatesRepository,
} = require('../dist/src/modules/certificates/certificates.repository');
const {
  PrismaService,
} = require('../dist/src/infrastructure/prisma/prisma.service');
const {
  ISSUANCE_DIRECTORY,
} = require('../dist/src/modules/certificates/issuance.clients');
const {
  ISSUANCE_STORAGE,
} = require('../dist/src/modules/certificates/issuance.storage');

async function service() {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.CERTIFICATE_CONSUMER_ENABLED, 'true');
  const { Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const config = {
    ...issuanceConfig((key) => process.env[key]),
    // Test-only DI overrides; production topic/group defaults are unchanged.
    topic: process.env.KAFKA_SMOKE_TOPIC,
    pollMs: 100,
  };
  class SmokeModule {}
  Module({
    providers: [
      {
        provide: PrismaService,
        useFactory: () =>
          new PrismaService({ getOrThrow: () => process.env.DATABASE_URL }),
      },
      CertificatesRepository,
      CompletionConsumer,
      IssuanceWorker,
      { provide: ISSUANCE_CONFIG, useValue: config },
      { provide: ISSUANCE_DIRECTORY, useValue: directory() },
      {
        provide: ISSUANCE_STORAGE,
        useValue: {
          upload: async () => {
            throw new Error('Unexpected storage access for no-logo fixture');
          },
          delete: async () => {
            throw new Error('Unexpected storage access for no-logo fixture');
          },
        },
      },
    ],
  })(SmokeModule);
  const app = await NestFactory.createApplicationContext(SmokeModule, {
    logger: false,
    abortOnError: false,
  });
  const consumer = app.get(CompletionConsumer);
  const handle = consumer.handle.bind(consumer);
  consumer.handle = async (...args) => {
    await handle(...args);
    process.send?.({ type: 'handled' });
  };
  process.on('message', async (message) => {
    if (message === 'stop') {
      await app.close();
      process.disconnect();
    }
  });
  process.send?.({ type: 'ready' });
}

const docker = (args, allowFailure = false) => {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0 && !allowFailure)
    throw new Error('Docker operation failed');
  return r;
};
async function until(check, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(250);
  }
  throw new Error('Smoke check timed out');
}
async function startService(connectionString, brokers, topic) {
  let handled = 0,
    ready = false,
    exited = false;
  const child = fork(__filename, ['service'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: connectionString,
      CERTIFICATE_CONSUMER_ENABLED: 'true',
      KAFKA_BROKERS: brokers,
      KAFKA_SMOKE_TOPIC: topic,
    },
    // Suppress native/Nest output: never expose connection strings or event payloads.
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  child.on('exit', () => {
    exited = true;
  });
  child.on('message', (message) => {
    if (message.type === 'ready') ready = true;
    if (message.type === 'handled') handled++;
  });
  const stop = async () => {
    if (exited) return;
    child.send('stop');
    try {
      await until(() => exited, 20000);
    } catch {
      child.kill();
      await until(() => exited, 5000);
      throw new Error('Service required forced termination');
    }
  };
  try {
    await until(() => {
      if (exited) throw new Error('Service exited');
      return ready;
    }, 15000);
  } catch (error) {
    await stop();
    throw error;
  }
  return { stop, handled: () => handled };
}

async function smoke() {
  assert.equal(
    process.env.KAFKA_SMOKE_ALLOW_DOCKER_START,
    'true',
    'Explicit Docker start approval required',
  );
  const runId = randomUUID().slice(0, 8);
  const name = 'learnup-pr1-kafka-smoke-' + runId;
  const topic = 'learnup-smoke.achievement.' + runId;
  const brokers = '127.0.0.1:19092';
  const groupId = 'achievement-reporting-certificate-v1';
  let fixture,
    admin,
    producer,
    running,
    started = false,
    created = false;
  let stage = 'prepare';
  const cleanupErrors = [];
  const clean = async (label, action) => {
    try {
      await action();
    } catch {
      cleanupErrors.push(label);
    }
  };
  try {
    fixture = await isolatedDatabase();
    stage = 'start-broker';
    docker([
      'run',
      '--rm',
      '--detach',
      '--name',
      name,
      '-p',
      '127.0.0.1:19092:9092',
      '-e',
      'KAFKA_NODE_ID=1',
      '-e',
      'KAFKA_PROCESS_ROLES=broker,controller',
      '-e',
      'KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:29093',
      '-e',
      'KAFKA_LISTENERS=INTERNAL://0.0.0.0:29092,PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:29093',
      '-e',
      'KAFKA_ADVERTISED_LISTENERS=INTERNAL://localhost:29092,PLAINTEXT://127.0.0.1:19092',
      '-e',
      'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,INTERNAL:PLAINTEXT',
      '-e',
      'KAFKA_INTER_BROKER_LISTENER_NAME=INTERNAL',
      '-e',
      'KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER',
      '-e',
      'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1',
      '-e',
      'KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0',
      '-e',
      'KAFKA_AUTO_CREATE_TOPICS_ENABLE=false',
      '-e',
      'KAFKA_DELETE_TOPIC_ENABLE=true',
      '-e',
      'CLUSTER_ID=MkU3OEVBNTcwNTJENDM2Qk',
      'confluentinc/cp-kafka:7.6.0',
    ]);
    started = true;
    await until(
      () =>
        docker(
          [
            'exec',
            name,
            'kafka-topics',
            '--bootstrap-server',
            'localhost:29092',
            '--list',
          ],
          true,
        ).status === 0,
    );
    const { KafkaJS } = require('@confluentinc/kafka-javascript');
    const kafka = new KafkaJS.Kafka({
      kafkaJS: { brokers: [brokers], logLevel: KafkaJS.logLevel.NOTHING },
    });
    admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
    });
    created = true;
    producer = kafka.producer();
    await producer.connect();
    stage = 'publish';
    const valid = [event(), event(), event()];
    const invalid = { ...event(), data: { invalid: true } };
    // A poison event between valid events demonstrates that it does not block the partition.
    const messages = [valid[0], invalid, valid[1], valid[0], valid[2]].map(
      (e) => ({
        key: e.data.enrollmentId ?? 'malformed',
        value: JSON.stringify(e),
      }),
    );
    await producer.send({ topic, messages });
    await producer.disconnect();
    producer = undefined;
    console.log(
      JSON.stringify({
        stage: 'published',
        messages: 5,
        uniqueValid: 3,
        duplicate: 1,
        malformed: 1,
      }),
    );
    const offsets = async () => {
      try {
        const result = await admin.fetchOffsets({ groupId, topics: [topic] });
        return result[0]?.partitions[0]?.offset;
      } catch {
        return undefined;
      } // Group may not exist during initial join.
    };
    const state = async () =>
      (
        await fixture.pool.query(
          "SELECT (SELECT count(*)::int FROM certificates WHERE status='Issued') AS issued,(SELECT count(*)::int FROM certificates) AS certificates,(SELECT count(*)::int FROM processed_completion_events) AS receipts,(SELECT count(*)::int FROM completion_event_quarantine) AS quarantine",
        )
      ).rows[0];
    stage = 'consume';
    running = await startService(fixture.connectionString, brokers, topic);
    await until(async () => {
      const s = await state();
      return (
        s.issued === 3 &&
        s.certificates === 3 &&
        s.receipts === 3 &&
        s.quarantine === 1 &&
        (await offsets()) === '5'
      );
    });
    const first = await state();
    const ids = (
      await fixture.pool.query(
        'SELECT id,issued_recorded_at FROM certificates ORDER BY id',
      )
    ).rows;
    assert.equal((await admin.fetchTopicOffsets(topic))[0].high, '5');
    assert.equal(running.handled(), 5);
    const q = (
      await fixture.pool.query(
        'SELECT topic,"partition","offset",event_id FROM completion_event_quarantine',
      )
    ).rows[0];
    assert.equal(q.topic, topic);
    assert.equal(q.partition, 0);
    assert.equal(String(q.offset), '1');
    assert.equal(q.event_id, invalid.eventId);
    console.log(
      JSON.stringify({
        stage: 'first-run',
        ...first,
        committedOffset: await offsets(),
        endOffset: '5',
        handled: running.handled(),
        at: new Date().toISOString(),
      }),
    );
    await running.stop();
    running = undefined;
    stage = 'restart';
    running = await startService(fixture.connectionString, brokers, topic);
    // Wait until the restarted real consumer has joined, then observe it for five seconds.
    await until(async () => {
      const result = await admin.describeGroups([groupId]);
      return (
        result.groups?.[0]?.members?.length === 1 &&
        result.groups[0].state === 3
      );
    });
    await delay(5000);
    assert.deepEqual(await state(), first);
    assert.deepEqual(
      (
        await fixture.pool.query(
          'SELECT id,issued_recorded_at FROM certificates ORDER BY id',
        )
      ).rows,
      ids,
    );
    assert.equal(await offsets(), '5');
    assert.equal(running.handled(), 0);
    console.log(
      JSON.stringify({
        stage: 'restart',
        ...(await state()),
        committedOffset: await offsets(),
        handled: running.handled(),
        unchangedIdsAndIssuedTimes: true,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    process.exitCode = 1;
    console.error(
      JSON.stringify({
        result: 'FAIL',
        stage,
        details: 'suppressed to protect connection information',
      }),
    );
  } finally {
    if (running) await clean('service', () => running.stop());
    if (producer) await clean('producer', () => producer.disconnect());
    if (admin && created) {
      await clean('topic', async () => {
        await admin.deleteTopics({ topics: [topic] });
        await until(async () => !(await admin.listTopics()).includes(topic));
      });
      await clean('group', async () => {
        const result = await admin.deleteGroups([groupId]);
        assert.ok(result.every((r) => !r.error));
      });
    }
    if (admin) await clean('admin', () => admin.disconnect());
    if (fixture) await clean('schema', () => fixture.cleanup());
    if (started)
      await clean('broker', () => {
        docker(['stop', name]);
      });
    if (cleanupErrors.length) process.exitCode = 1;
    console.log(
      JSON.stringify({
        stage: 'cleanup',
        topicDeleted: created && !cleanupErrors.includes('topic'),
        schemaDropped: !!fixture && !cleanupErrors.includes('schema'),
        brokerRemoved: started && !cleanupErrors.includes('broker'),
        failures: cleanupErrors,
      }),
    );
  }
}
if (process.argv[2] === 'service')
  service().catch(() => {
    process.exitCode = 1;
    process.disconnect?.();
  });
else
  smoke().catch(() => {
    console.error('KAFKA_SMOKE_PRECONDITION_FAILED');
    process.exitCode = 1;
  });
