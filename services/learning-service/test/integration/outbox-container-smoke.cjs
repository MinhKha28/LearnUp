// Pipe this file to docker exec -i <disposable-learning-container> node.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { KafkaJS } = require('@confluentinc/kafka-javascript');
async function main() {
  const id = randomUUID(),
    aggregate = randomUUID(),
    organization = randomUUID();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const topic = process.env.OUTBOX_TOPIC;
  const kafka = new KafkaJS.Kafka({
    kafkaJS: {
      brokers: process.env.KAFKA_BROKERS.split(','),
      logLevel: KafkaJS.logLevel.NOTHING,
    },
  });
  const consumer = kafka.consumer({
    kafkaJS: { groupId: `container-smoke-${id}`, fromBeginning: true },
  });
  let observed;
  try {
    await db.connect();
    await consumer.connect();
    await consumer.subscribe({ topics: [topic] });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const body = JSON.parse(message.value.toString());
        if (body.eventId === id)
          observed = { key: message.key.toString(), body };
      },
    });
    const at = new Date().toISOString();
    const data = {
      enrollmentId: aggregate,
      organizationId: organization,
      learnerId: randomUUID(),
      courseId: randomUUID(),
      assignedBy: randomUUID(),
      assignedAt: at,
      dueAt: '2026-12-01T00:00:00.000Z',
      kind: 'created',
    };
    await db.query(
      `INSERT INTO outbox_events(id,aggregate_type,aggregate_id,event_type,organization_id,payload,occurred_at)
      VALUES($1,'Enrollment',$2,'EnrollmentAssigned',$3,$4,$5)`,
      [id, aggregate, organization, data, at],
    );
    const deadline = Date.now() + 20000;
    while (!observed) {
      if (Date.now() > deadline)
        throw new Error('Container relay smoke timed out');
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(observed.key, aggregate);
    assert.equal(observed.body.occurredAt, at);
    assert.deepEqual(observed.body.data, data);
    while (
      !(
        await db.query('SELECT published_at FROM outbox_events WHERE id=$1', [
          id,
        ])
      ).rows[0].published_at
    ) {
      if (Date.now() > deadline)
        throw new Error('Publication commit timed out');
      await new Promise((r) => setTimeout(r, 20));
    }
    console.log('L6 container sample', JSON.stringify(observed));
  } finally {
    await consumer.disconnect();
    await db.query(
      'DELETE FROM outbox_events WHERE id=$1 AND organization_id=$2',
      [id, organization],
    );
    await db.end();
  }
}
main().catch(() => {
  console.error('OUTBOX_CONTAINER_SMOKE_FAILED');
  process.exitCode = 1;
});
