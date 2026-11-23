const fs = require("node:fs");
const path = require("node:path");
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
async function createTestTopics(admin, names) {
  for (const [id, topic] of Object.entries(names)) {
    const row = shape(id);
    await admin.createTopics({
      timeout: 10000,
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
module.exports = { shape, createTestTopics };
