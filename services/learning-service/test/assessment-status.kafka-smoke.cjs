// Opt-in real Kafka/PostgreSQL smoke. Requires explicit Docker start approval.
// Resources are retained for review; remove only at the owner's request after merge.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fork, spawnSync } = require('node:child_process');
const { readFileSync, readdirSync, createWriteStream } = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('pg');

async function service() {
  require('ts-node').register({ project: 'tsconfig.seed.json' });
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../src/app.module');
  const { configureApp } = require('../src/app.setup');
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  process.on('message', async (message) => {
    if (message === 'stop') {
      await app.close();
      process.exit(0);
    }
  });
  await app.listen(0, '127.0.0.1');
  process.send({ port: app.getHttpServer().address().port });
}
async function until(check, label, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await check()) return;
    } catch {
      /* A broker starting up is expected. */
    }
    await delay(250);
  }
  throw new Error('Timed out: ' + label);
}
function docker(args) {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  });
  if (r.status !== 0)
    throw new Error('Docker command failed: ' + (r.stderr || r.error?.code));
  return r.stdout.trim();
}
async function smoke() {
  assert.equal(
    process.env.KAFKA_SMOKE_ALLOW_DOCKER_START,
    'true',
    'Explicit Docker start approval required',
  );
  assert.notEqual(process.env.NODE_ENV, 'production');
  const kafkaPort = Number(process.env.KAFKA_SMOKE_PORT ?? '19098');
  assert.ok(
    Number.isInteger(kafkaPort) && kafkaPort > 1023 && kafkaPort < 65536,
  );
  const run = randomUUID().slice(0, 8),
    name = 'learnup-l18-kafka-' + run;
  const topic = 'learnup-smoke.learning-assessment.' + run,
    groupId = 'learning-assessment-smoke-' + run;
  const database = 'l18_smoke_' + run,
    brokers = '127.0.0.1:' + kafkaPort;
  const base = new URL(process.env.DATABASE_URL);
  base.pathname = '/postgres';
  const adminDb = new Client({ connectionString: base.toString() });
  await adminDb.connect();
  await adminDb.query(`CREATE DATABASE "${database}"`);
  await adminDb.end();
  base.pathname = '/' + database;
  const db = new Client({ connectionString: base.toString() });
  await db.connect();
  for (const d of readdirSync('prisma/migrations', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort())
    await db.query(
      readFileSync(`prisma/migrations/${d}/migration.sql`, 'utf8'),
    );
  const org = randomUUID(),
    learner = randomUUID(),
    course = randomUUID(),
    enrollment = randomUUID();
  await db.query(
    `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES ($1,$2,$1,now(),now())`,
    [course, org],
  );
  await db.query(
    `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent) VALUES ($1,$2,$3,$4,'Optional','NotStarted',80)`,
    [enrollment, org, learner, course],
  );
  let child, admin, producer;
  const log = createWriteStream('assessment-kafka-smoke.log');
  console.log(
    JSON.stringify({
      container: name,
      topic,
      groupId,
      database,
      removeAfter: 'L18 PR merges',
    }),
  );
  try {
    // Prove the selected Kafka port is down before starting the real application.
    const net = require('node:net');
    await new Promise((resolve, reject) => {
      const socket = net.connect(kafkaPort, '127.0.0.1');
      socket.setTimeout(2000);
      socket.once('connect', () => {
        socket.destroy();
        reject(new Error('Smoke Kafka port already in use'));
      });
      socket.once('error', () => {
        socket.destroy();
        resolve();
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve();
      });
    });
    child = fork(__filename, ['--service'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        VIDEO_PLAYBACK_MODE: 'course',
        READING_ACCESS_MODE: 'course',
        NODE_PATH: process.cwd(),
        DATABASE_URL: base.toString(),
        INTERNAL_SERVICE_KEY: 'l18-smoke-synthetic-key',
        TENANT_CLIENT_MODE: 'fake',
        TENANT_FAKE_TIMEZONE: 'Asia/Ho_Chi_Minh',
        TENANT_SERVICE_URL: 'http://127.0.0.1:1',
        COURSE_SERVICE_URL: 'http://127.0.0.1:1',
        COURSE_SERVICE_TIMEOUT_MS: '1000',
        ASSESSMENT_CLIENT_MODE: 'fake',
        ASSESSMENT_COMPLETION_CLIENT_MODE: 'fake',
        OUTBOX_RELAY_ENABLED: 'false',
        COMPLETION_WORKER_ENABLED: 'false',
        ASSESSMENT_CONSUMER_ENABLED: 'true',
        ASSESSMENT_CONSUMER_TOPIC: topic,
        ASSESSMENT_CONSUMER_GROUP_ID: groupId,
        KAFKA_BROKERS: brokers,
      },
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let port;
    child.on('message', (m) => {
      port = m.port;
    });
    await until(
      () => {
        assert.equal(child.exitCode, null);
        return !!port;
      },
      'HTTP listening',
      30000,
    );
    const http = async () =>
      (
        await fetch(
          `http://127.0.0.1:${port}/api/v1/enrollments/me/course-ids`,
          {
            headers: {
              'x-internal-key': 'l18-smoke-synthetic-key',
              'x-organization-id': org,
              'x-user-id': learner,
              'x-user-role': 'LEARNER',
            },
            signal: AbortSignal.timeout(5000),
          },
        )
      ).status;
    assert.equal(await http(), 200);
    await delay(6000);
    assert.equal(await http(), 200);
    console.log('PASS HTTP 200 with Kafka down, including startup retry');
    docker([
      'run',
      '--detach',
      '--name',
      name,
      '-p',
      '127.0.0.1:' + kafkaPort + ':9092',
      '-e',
      'KAFKA_NODE_ID=1',
      '-e',
      'KAFKA_PROCESS_ROLES=broker,controller',
      '-e',
      'KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:29093',
      '-e',
      'KAFKA_LISTENERS=INTERNAL://0.0.0.0:29092,PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:29093',
      '-e',
      'KAFKA_ADVERTISED_LISTENERS=INTERNAL://localhost:29092,PLAINTEXT://' +
        brokers,
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
      'CLUSTER_ID=MkU3OEVBNTcwNTJENDM2Qk',
      'confluentinc/cp-kafka:7.6.0',
    ]);
    const { KafkaJS } = require('@confluentinc/kafka-javascript');
    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: [brokers],
        clientId: 'l18-smoke',
        connectionTimeout: 2000,
        retry: { retries: 0 },
        logLevel: KafkaJS.logLevel.NOTHING,
      },
    });
    await until(async () => {
      const candidate = kafka.admin();
      try {
        await candidate.connect();
        admin = candidate;
        return true;
      } catch {
        await candidate.disconnect().catch(() => {});
        return false;
      }
    }, 'broker available');
    await delay(6000);
    assert.equal(await http(), 200);
    assert.ok(
      !(await admin.listTopics()).includes(topic),
      'consumer must not create missing topic',
    );
    console.log(
      'PASS HTTP 200 with missing topic; no automatic topic creation',
    );
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
    });
    producer = kafka.producer();
    await producer.connect();
    const event = {
      eventId: randomUUID(),
      eventType: 'LearnerAssessmentStatusChanged',
      version: 1,
      occurredAt: '2026-10-30T12:00:00.000Z',
      organizationId: org,
      producer: 'assessment-service',
      data: {
        assessmentId: randomUUID(),
        learnerId: learner,
        courseId: course,
        organizationId: org,
        kind: 'ASSIGNMENT',
        status: 'Submitted',
        firstActivityAt: '2026-10-29T12:00:00.000Z',
        revision: 'unordered',
      },
    };
    await producer.send({
      topic,
      messages: [event, {}, event].map((e) => ({
        key: learner,
        value: JSON.stringify(e),
      })),
    });
    await until(async () => {
      const {
        rows: [row],
      } = await db.query(
        `SELECT e.status,e.first_activity_at,q.generation,q.source,(SELECT count(*)::integer FROM assessment_event_quarantine) AS quarantine
        FROM enrollments e JOIN completion_evaluation_requests q ON q.enrollment_id=e.id WHERE e.id=$1`,
        [enrollment],
      );
      const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
      return (
        row?.status === 'InProgress' &&
        row.first_activity_at.toISOString() === event.data.firstActivityAt &&
        row.generation === '1' &&
        row.source === 'assessment' &&
        row.quarantine === 1 &&
        offsets[0]?.partitions[0]?.offset === '3'
      );
    }, 'activation, coalesced queue, quarantine, committed offset 3');
    assert.equal(await http(), 200);
    console.log(
      'PASS recovered consumer: activation, duplicate queue generation 1, poison quarantine 1, committed offset 3',
    );
  } finally {
    await producer?.disconnect().catch(() => {});
    await admin?.disconnect().catch(() => {});
    if (child && child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.send('stop');
      await Promise.race([exited, delay(10000)]);
      if (child.exitCode === null) child.kill();
    }
    await db.end();
    log.end();
    // Deliberately retain Kafka container/topic and smoke database for review.
  }
}
if (process.argv.includes('--service')) service().catch(() => process.exit(1));
else
  smoke().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
