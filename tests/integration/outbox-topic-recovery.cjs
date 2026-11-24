/**
 * Opt-in real service/PostgreSQL/Kafka regression. Run once per OUTBOX_TEST_SERVICE
 * with ts-node registered and NODE_PATH pointing at that service. The controller
 * provisions the private manifest through kafka-init after the ready marker, then
 * writes the provisioned marker. No production topics or databases are modified.
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} = require('node:fs');
const { resolve, join } = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { test } = require('node:test');

const service = process.env.OUTBOX_TEST_SERVICE;
const control = process.env.OUTBOX_TEST_CONTROL_DIR;
const scenario = process.env.OUTBOX_TEST_SCENARIO || 'missing';
if (
  !['course', 'assessment', 'learning'].includes(service) ||
  !control ||
  process.env.NODE_ENV !== 'test'
)
  throw new Error(
    'Explicit test service, control directory and NODE_ENV=test required',
  );
const root = resolve(__dirname, '../../services', `${service}-service`);
const load = (name) => require(require.resolve(name, { paths: [root] }));
const { Client } = load('pg');
const { KafkaJS } = load('@confluentinc/kafka-javascript');
const { Logger } = load('@nestjs/common');
const { NestFactory } = load('@nestjs/core');
const { RelayService } = require(
  join(root, 'src/modules/outbox/relay.service'),
);
const clientModule = require(
  join(
    root,
    'src/modules/outbox',
    service === 'assessment' ? 'relay.kafka-gate' : 'relay.producer',
  ),
);
const RelayClient = clientModule.KafkaOutboxGate || clientModule.RelayProducer;
const marker = (suffix) => join(control, `${service}-${scenario}.${suffix}`);
const topic = `learnup.test.outbox-topic.${service}.${scenario}`;
const topics =
  service === 'assessment'
    ? [topic, `${topic}.peer`, `${topic}.finalized`]
    : [topic];

async function until(check, label, timeout = 90000) {
  const end = Date.now() + timeout;
  while (!(await check())) {
    assert.ok(Date.now() < end, `deadline: ${label}`);
    await sleep(50);
  }
}

test(
  `${service}: pending without topic, late kafka-init and ${scenario} recovery`,
  { timeout: 180000 },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/postgres';
    const adminDb = new Client({ connectionString: url.toString() });
    await adminDb.connect();
    const database = `outbox_topic_test_${randomUUID().replaceAll('-', '')}`;
    await adminDb.query(`CREATE DATABASE "${database}"`);
    url.pathname = `/${database}`;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    let app, consumer;
    t.after(async () => {
      await consumer?.disconnect();
      await app?.close();
      await db.end();
      await adminDb.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      await adminDb.end();
    });
    const migrations = join(root, 'prisma/migrations');
    for (const dir of readdirSync(migrations).sort()) {
      const file = join(migrations, dir, 'migration.sql');
      if (existsSync(file)) await db.query(readFileSync(file, 'utf8'));
    }
    Object.assign(process.env, {
      DATABASE_URL: url.toString(),
      OUTBOX_RELAY_ENABLED: 'true',
      OUTBOX_TOPIC: topic,
      OUTBOX_PEER_REVIEW_TOPIC: topics[1] || `${topic}.peer`,
      OUTBOX_SUBMISSION_FINALIZED_TOPIC: topics[2] || `${topic}.finalized`,
      OUTBOX_POLL_INTERVAL_MS: '1000',
      OUTBOX_PROBE_TIMEOUT_MS: '1000',
      OUTBOX_DELIVERY_TIMEOUT_MS: '1000',
      OUTBOX_TRANSACTION_TIMEOUT_MS: '10000',
      INTERNAL_SERVICE_KEY: 'isolated-outbox-topic-test-internal-key',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      COURSE_CLIENT_MODE: 'fake',
      COURSE_SERVICE_URL: 'http://127.0.0.1:9',
      COURSE_SERVICE_TIMEOUT_MS: '3000',
      TENANT_CLIENT_MODE: 'fake',
      TENANT_FAKE_TIMEZONE: 'Asia/Ho_Chi_Minh',
      ASSESSMENT_SERVICE_URL: 'http://127.0.0.1:9',
      ASSESSMENT_RESULTS_CLIENT_MODE: 'fake',
      TENANT_SERVICE_URL: 'http://127.0.0.1:9',
      ASSESSMENT_CLIENT_MODE: 'fake',
      VIDEO_PLAYBACK_MODE: 'course',
      COMPLETION_WORKER_ENABLED: 'false',
      ASSESSMENT_COMPLETION_CLIENT_MODE: 'fake',
      ASSESSMENT_CONSUMER_ENABLED: 'false',
      PROMPT_FILE_VERIFY: 'off',
    });
    const org = randomUUID();
    const id = randomUUID();
    const aggregate = randomUUID();
    const occurredAt = new Date();
    const event =
      service === 'course'
        ? 'CourseDisabled'
        : service === 'learning'
          ? 'EnrollmentAssigned'
          : 'LearnerAssessmentStatusChanged';
    const payload =
      service === 'course'
        ? {
            courseId: aggregate,
            organizationId: org,
            occurredAt: occurredAt.toISOString(),
          }
        : { learnerId: aggregate, enrollmentId: aggregate };
    await db.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, organization_id, payload, occurred_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [
        id,
        service === 'course' ? 'Course' : 'Enrollment',
        aggregate,
        event,
        org,
        payload,
        occurredAt,
      ],
    );
    const warnings = [];
    t.mock.method(Logger.prototype, 'warn', (message) =>
      warnings.push(String(message)),
    );
    let polls = 0,
      replacements = 0,
      transactions = 0;
    const ready = RelayClient.prototype.ready;
    t.mock.method(RelayClient.prototype, 'ready', async function () {
      polls++;
      return ready.call(this);
    });
    if (service === 'assessment') {
      const replace = RelayClient.prototype.replaceClients;
      t.mock.method(RelayClient.prototype, 'replaceClients', function () {
        replacements++;
        return replace.call(this);
      });
    }
    const { AppModule } = require(join(root, 'src/app.module'));
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    const relay = app.get(RelayService);
    const repository = relay.repository;
    const transaction = repository.transaction.bind(repository);
    t.mock.method(repository, 'transaction', (...args) => {
      transactions++;
      return transaction(...args);
    });
    const startedAt = Date.now();
    await assert.doesNotReject(
      () => app.listen(0, '127.0.0.1'),
      'HTTP starts while Kafka is unavailable',
    );
    const response = await fetch(await app.getUrl());
    assert.ok(
      response.status < 500,
      'HTTP starts while Kafka/topic is unavailable',
    );
    const startupMs = Date.now() - startedAt;
    if (scenario === 'missing') {
      await until(() => polls >= 6, 'six unavailable polls');
      // Finish the sixth probe before asserting its effects.
      await relay.tick();
    } else {
      // Native initial connects may keep retrying while the HTTP API is already up.
      // Restore Kafka after startup, then assert delivery without blocking on that connect.
      await until(
        () => polls >= 1,
        'broker probe started while HTTP is available',
      );
    }
    const before = (
      await db.query(
        'SELECT attempts, published_at, next_attempt_at FROM outbox_events WHERE id=$1',
        [id],
      )
    ).rows[0];
    assert.equal(before.published_at, null, 'row must stay pending');
    assert.equal(before.attempts, 0, 'preflight must not increment attempts');
    assert.equal(
      before.next_attempt_at,
      null,
      'preflight must not schedule row backoff',
    );
    assert.equal(transactions, 0, 'preflight must not claim rows');
    if (scenario === 'missing') {
      assert.equal(replacements, 0, 'missing-only must not replace clients');
      for (const name of topics)
        assert.equal(
          warnings.filter(
            (line) =>
              line ===
              `OUTBOX_TOPIC_MISSING topic=${name} hint="run kafka-init"`,
          ).length,
          1,
          'one precise warning per missing topic',
        );
    }
    const pollsBefore = polls;
    writeFileSync(
      marker('manifest.tsv'),
      topics
        .map(
          (name, i) =>
            `test-${i}\t${name}\t3\t1\tfixtureId\tOUTBOX_TEST_TOPIC_${i}`,
        )
        .join('\n') + '\n',
    );
    writeFileSync(
      marker('ready'),
      JSON.stringify({ polls, replacements, before, startupMs }),
    );
    await until(
      () => existsSync(marker('provisioned')),
      'controller kafka-init completion',
    );
    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: process.env.KAFKA_BROKERS.split(','),
        logLevel: KafkaJS.logLevel.NOTHING,
      },
    });
    consumer = kafka.consumer({
      kafkaJS: {
        groupId: `outbox-topic-test-${randomUUID()}`,
        fromBeginning: true,
        allowAutoTopicCreation: false,
      },
    });
    await consumer.connect();
    await consumer.subscribe({ topic });
    const received = [];
    await consumer.run({
      eachMessage: async ({ message }) => {
        received.push(JSON.parse(message.value.toString()));
      },
    });
    await until(
      async () =>
        (
          await db.query('SELECT published_at FROM outbox_events WHERE id=$1', [
            id,
          ])
        ).rows[0].published_at !== null,
      'row drained',
    );
    await until(
      () => received.some((message) => message.eventId === id),
      'published envelope consumed',
    );
    const after = (
      await db.query(
        'SELECT attempts, published_at FROM outbox_events WHERE id=$1',
        [id],
      )
    ).rows[0];
    assert.equal(after.attempts, 0, 'recovery preserves attempts');
    const result = {
      service,
      scenario,
      pollsBefore,
      replacements,
      transactions,
      warnings,
      startupMs,
      before,
      after,
      envelopes: received.length,
    };
    writeFileSync(marker('result.json'), JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify({
        service,
        scenario,
        replacements,
        pendingAttempts: before.attempts,
        drained: true,
        envelopes: received.length,
        startupMs,
      }),
    );
  },
);
