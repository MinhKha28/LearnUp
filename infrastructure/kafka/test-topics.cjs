const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: sleep } = require("node:timers/promises");

const BROKER_READY_TIMEOUT_MS = 30000;
const BROKER_PROBE_TIMEOUT_MS = 1000;
const BROKER_READY_POLL_INTERVAL_MS = 100;
const TOPIC_ADMIN_TIMEOUT_MS = 30000;
const rows = fs
  .readFileSync(path.join(__dirname, "topics.tsv"), "utf8")
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [id, name, partitions, replicationFactor] = line.split("\t");
    return {
      id,
      name,
      partitions: Number(partitions),
      replicationFactor: Number(replicationFactor),
    };
  });
function shape(id) {
  const row = rows.find((row) => row.id === id);
  if (!row) throw new Error("Unknown manifest topic: " + id);
  return row;
}
/** An Admin handle can be connected before its broker metadata is available. */
async function awaitBrokerReady(admin) {
  const deadline = Date.now() + BROKER_READY_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    try {
      await admin.listTopics({
        timeout: Math.min(BROKER_PROBE_TIMEOUT_MS, remainingMs),
      });
      return;
    } catch (error) {
      lastError = error;
    }
    await sleep(BROKER_READY_POLL_INTERVAL_MS);
  }
  throw new Error(
    "Test Kafka broker metadata was not ready within the timeout",
    {
      cause: lastError,
    },
  );
}

async function createTestTopics(admin, names) {
  await awaitBrokerReady(admin);
  for (const [id, topic] of Object.entries(names)) {
    const row = shape(id);
    await admin.createTopics({
      timeout: TOPIC_ADMIN_TIMEOUT_MS,
      topics: [
        {
          topic,
          numPartitions: row.partitions,
          replicationFactor: row.replicationFactor,
        },
      ],
    });
  }
}
async function describeTestTopics(admin, topics) {
  await awaitBrokerReady(admin);
  return admin.fetchTopicMetadata({ topics, timeout: TOPIC_ADMIN_TIMEOUT_MS });
}
module.exports = { shape, createTestTopics, describeTestTopics };
